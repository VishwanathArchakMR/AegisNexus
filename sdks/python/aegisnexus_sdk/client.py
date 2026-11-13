import functools
import inspect
import logging
import os
import queue
import threading
import time
from contextlib import contextmanager
from typing import Any, Callable, Dict, Generator, List, Optional, Union

from aegisnexus_sdk.exceptions import ConfigurationError
from aegisnexus_sdk.models import CapabilityDefinition, TelemetryEvent, utc_now
from aegisnexus_sdk.redaction import redact_sensitive_data
from aegisnexus_sdk.transport import Transport

logger = logging.getLogger("aegisnexus_sdk")


class AegisNexusClient:
    """
    Core AegisNexus SDK Client for external AI agents.
    Provides automated heartbeat daemon, asynchronous telemetry event batching,
    tool instrumentation, and capability synchronization.
    """

    def __init__(
        self,
        base_url: str,
        agent_id: str,
        api_key: str,
        heartbeat_interval: float = 30.0,
        batch_size: int = 25,
        batch_flush_interval: float = 2.0,
        max_queue_size: int = 1000,
        fail_open: bool = True,
        auto_start: bool = False,
    ):
        if not base_url:
            raise ConfigurationError("base_url is required")
        if not agent_id:
            raise ConfigurationError("agent_id is required")
        if not api_key:
            raise ConfigurationError("api_key is required")

        self.base_url = base_url.rstrip("/")
        self.agent_id = agent_id
        self.api_key = api_key
        self.heartbeat_interval = max(5.0, float(heartbeat_interval))
        self.batch_size = max(1, int(batch_size))
        self.batch_flush_interval = max(0.5, float(batch_flush_interval))
        self.fail_open = fail_open

        self._transport = Transport(
            base_url=self.base_url,
            agent_id=self.agent_id,
            api_key=self.api_key,
        )

        self._event_queue: queue.Queue[TelemetryEvent] = queue.Queue(maxsize=max_queue_size)
        self._stop_event = threading.Event()
        self._heartbeat_thread: Optional[threading.Thread] = None
        self._flush_thread: Optional[threading.Thread] = None
        self._is_running = False
        self._lock = threading.Lock()

        if auto_start:
            self.start()

    @classmethod
    def from_env(cls, **kwargs) -> "AegisNexusClient":
        """Factory method reading connection settings from environment variables."""
        base_url = kwargs.get("base_url") or os.environ.get("AEGISNEXUS_BASE_URL", "http://localhost:8000")
        agent_id = kwargs.get("agent_id") or os.environ.get("AEGISNEXUS_AGENT_ID")
        api_key = kwargs.get("api_key") or os.environ.get("AEGISNEXUS_API_KEY")

        if not agent_id or not api_key:
            raise ConfigurationError(
                "Missing environment configuration: AEGISNEXUS_AGENT_ID and AEGISNEXUS_API_KEY must be set"
            )

        interval = kwargs.get("heartbeat_interval") or float(
            os.environ.get("AEGISNEXUS_HEARTBEAT_INTERVAL", "30.0")
        )
        fail_open = kwargs.get("fail_open", os.environ.get("AEGISNEXUS_FAIL_OPEN", "true").lower() in ("true", "1"))

        return cls(
            base_url=base_url,
            agent_id=agent_id,
            api_key=api_key,
            heartbeat_interval=interval,
            fail_open=fail_open,
            **{k: v for k, v in kwargs.items() if k not in ("base_url", "agent_id", "api_key", "heartbeat_interval", "fail_open")},
        )

    def start(self) -> "AegisNexusClient":
        """Starts background threads for automated heartbeats and telemetry flushing."""
        with self._lock:
            if self._is_running:
                return self
            self._is_running = True
            self._stop_event.clear()

            # Initial heartbeat immediately
            try:
                self.heartbeat()
            except Exception as e:
                logger.warning("Initial heartbeat warning: %s", e)
                if not self.fail_open:
                    raise

            # Start Heartbeat Daemon
            self._heartbeat_thread = threading.Thread(
                target=self._heartbeat_worker,
                name="AegisNexus-HeartbeatWorker",
                daemon=True,
            )
            self._heartbeat_thread.start()

            # Start Flush Worker
            self._flush_thread = threading.Thread(
                target=self._flush_worker,
                name="AegisNexus-FlushWorker",
                daemon=True,
            )
            self._flush_thread.start()

            logger.info("AegisNexus SDK client started for agent '%s'", self.agent_id)
            return self

    def stop(self, timeout: float = 3.0) -> None:
        """Flushes remaining queued telemetry and cleanly shuts down background workers."""
        with self._lock:
            if not self._is_running:
                return
            self._is_running = False
            self._stop_event.set()

        # Emit Agent Shutdown Event
        try:
            self._transport.send_event(
                TelemetryEvent(
                    event_type="AGENT_SHUTDOWN",
                    status="SUCCESS",
                    metadata={"reason": "clean_stop"},
                )
            )
        except Exception as e:
            logger.debug("Shutdown notice error: %s", e)

        # Flush remaining events
        self.flush()

        # Join worker threads
        if self._heartbeat_thread and self._heartbeat_thread.is_alive():
            self._heartbeat_thread.join(timeout=timeout)
        if self._flush_thread and self._flush_thread.is_alive():
            self._flush_thread.join(timeout=timeout)

        self._transport.close()
        logger.info("AegisNexus SDK client stopped for agent '%s'", self.agent_id)

    def heartbeat(self, status: str = "ACTIVE", metrics: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Sends a heartbeat ping to AegisNexus."""
        try:
            return self._transport.send_heartbeat(status=status, metrics=metrics)
        except Exception as e:
            logger.warning("Heartbeat failed: %s", e)
            if not self.fail_open:
                raise
            return {"status": "error", "error": str(e)}

    def report_capabilities(
        self, capabilities: List[Union[Dict[str, Any], CapabilityDefinition]]
    ) -> Dict[str, Any]:
        """Synchronizes declared agent capabilities with AegisNexus."""
        defs: List[CapabilityDefinition] = []
        for c in capabilities:
            if isinstance(c, CapabilityDefinition):
                defs.append(c)
            elif isinstance(c, dict):
                defs.append(
                    CapabilityDefinition(
                        name=c.get("name") or c.get("capability_name", "unknown"),
                        resource_type=c.get("resource_type", "API"),
                        permission_level=c.get("permission_level") or c.get("permission", "READ"),
                        is_sensitive=c.get("is_sensitive", False),
                        description=c.get("description", ""),
                    )
                )

        try:
            resp = self._transport.sync_capabilities(defs)
            logger.info("Synchronized %d capabilities for agent '%s'", len(defs), self.agent_id)
            return resp
        except Exception as e:
            logger.error("Failed to synchronize capabilities: %s", e)
            if not self.fail_open:
                raise
            return {"status": "error", "error": str(e)}

    def emit_event(self, event: TelemetryEvent) -> None:
        """
        Enqueues an event into the bounded in-memory buffer.
        Applies data minimization and redaction to metadata.
        """
        if event.metadata:
            event.metadata = redact_sensitive_data(event.metadata)

        try:
            self._event_queue.put_nowait(event)
        except queue.Full:
            logger.warning(
                "AegisNexus telemetry queue full (limit %d). Dropping event %s to preserve agent memory.",
                self._event_queue.maxsize, event.event_type
            )

    def flush(self) -> None:
        """Synchronously flushes all pending events in the queue."""
        batch: List[TelemetryEvent] = []
        while not self._event_queue.empty():
            try:
                batch.append(self._event_queue.get_nowait())
                if len(batch) >= self.batch_size:
                    self._send_batch(batch)
                    batch = []
            except queue.Empty:
                break
        if batch:
            self._send_batch(batch)

    def _send_batch(self, batch: List[TelemetryEvent]) -> None:
        try:
            self._transport.send_events_batch(batch)
        except Exception as e:
            logger.warning("Batch telemetry delivery error (%d events): %s", len(batch), e)
            if not self.fail_open:
                raise

    def report_interaction(
        self,
        target_agent_id: str,
        interaction_type: str = "CALLS",  # CALLS | DELEGATES
        action: Optional[str] = None,
        status: str = "SUCCESS",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Reports an observed agent-to-agent delegation or communication interaction."""
        event_type = "AGENT_DELEGATION" if interaction_type.upper() == "DELEGATES" else "AGENT_COMMUNICATION"
        event = TelemetryEvent(
            event_type=event_type,
            target_agent_id=target_agent_id,
            action=action or interaction_type.lower(),
            resource_type="AGENT_COMMS",
            permission_level="WRITE",
            status=status.upper(),
            metadata=metadata or {},
        )
        self.emit_event(event)

    @contextmanager
    def track_tool_call(
        self,
        tool: str,
        action: str,
        resource_type: str = "API",
        permission_level: str = "EXECUTE",
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Generator[None, None, None]:
        """
        Context manager for instrumenting tool calls.
        Captures start timestamp, duration, outcomes, and exceptions.
        """
        start_time = time.perf_counter()
        meta = metadata.copy() if metadata else {}
        try:
            yield
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            self.emit_event(
                TelemetryEvent(
                    event_type="TOOL_CALL_COMPLETED",
                    tool=tool,
                    action=action,
                    resource_type=resource_type,
                    permission_level=permission_level,
                    status="SUCCESS",
                    duration_ms=round(duration_ms, 2),
                    trace_id=trace_id,
                    span_id=span_id,
                    metadata=meta,
                )
            )
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            meta["error_type"] = exc.__class__.__name__
            meta["error_message"] = str(exc)[:200]
            self.emit_event(
                TelemetryEvent(
                    event_type="TOOL_CALL_FAILED",
                    tool=tool,
                    action=action,
                    resource_type=resource_type,
                    permission_level=permission_level,
                    status="FAILURE",
                    duration_ms=round(duration_ms, 2),
                    trace_id=trace_id,
                    span_id=span_id,
                    metadata=meta,
                )
            )
            raise

    def instrument_tool(
        self,
        tool: str,
        action: str,
        resource_type: str = "API",
        permission_level: str = "EXECUTE",
    ) -> Callable:
        """Decorator for instrumenting functions with tool call tracking."""
        def decorator(func: Callable) -> Callable:
            if inspect.iscoroutinefunction(func):
                @functools.wraps(func)
                async def async_wrapper(*args, **kwargs):
                    with self.track_tool_call(
                        tool=tool,
                        action=action,
                        resource_type=resource_type,
                        permission_level=permission_level,
                    ):
                        return await func(*args, **kwargs)
                return async_wrapper
            else:
                @functools.wraps(func)
                def sync_wrapper(*args, **kwargs):
                    with self.track_tool_call(
                        tool=tool,
                        action=action,
                        resource_type=resource_type,
                        permission_level=permission_level,
                    ):
                        return func(*args, **kwargs)
                return sync_wrapper
        return decorator

    # ── Background Workers ──────────────────────────────────────────────────

    def _heartbeat_worker(self) -> None:
        while not self._stop_event.is_set():
            if self._stop_event.wait(self.heartbeat_interval):
                break
            try:
                self.heartbeat()
            except Exception as e:
                logger.debug("Periodic heartbeat background notice: %s", e)

    def _flush_worker(self) -> None:
        while not self._stop_event.is_set():
            if self._stop_event.wait(self.batch_flush_interval):
                break
            try:
                self.flush()
            except Exception as e:
                logger.debug("Periodic flush background notice: %s", e)


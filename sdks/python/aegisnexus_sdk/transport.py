import logging
import time
from typing import Any, Dict, List, Optional
import httpx

from aegisnexus_sdk.exceptions import (
    AuthenticationError,
    ConfigurationError,
    RateLimitError,
    TransportError,
)
from aegisnexus_sdk.models import CapabilityDefinition, TelemetryEvent

logger = logging.getLogger("aegisnexus_sdk.transport")


class Transport:
    """HTTP transport layer handling authentication, timeouts, and retries."""

    def __init__(
        self,
        base_url: str,
        agent_id: str,
        api_key: str,
        timeout_seconds: float = 10.0,
        max_retries: int = 3,
        retry_backoff_factor: float = 0.5,
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
        self.timeout = timeout_seconds
        self.max_retries = max_retries
        self.retry_backoff_factor = retry_backoff_factor

        self._headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "AegisNexus-Python-SDK/0.2.0",
        }
        self._client: Optional[httpx.Client] = None

    @property
    def client(self) -> httpx.Client:
        if self._client is None or self._client.is_closed:
            self._client = httpx.Client(
                base_url=self.base_url,
                headers=self._headers,
                timeout=self.timeout,
            )
        return self._client

    def close(self) -> None:
        if self._client and not self._client.is_closed:
            self._client.close()
            self._client = None

    def _request_with_retry(
        self, method: str, path: str, json_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        last_exception = None

        for attempt in range(1, self.max_retries + 1):
            try:
                resp = self.client.request(method, url, json=json_data)
                if resp.status_code == 401 or resp.status_code == 403:
                    raise AuthenticationError(
                        f"Authentication failed ({resp.status_code}): {resp.text}"
                    )
                if resp.status_code == 429:
                    raise RateLimitError("Telemetry rate limit exceeded")
                if resp.status_code >= 500:
                    resp.raise_for_status()

                resp.raise_for_status()
                return resp.json()

            except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
                last_exception = exc
                if attempt < self.max_retries:
                    sleep_time = self.retry_backoff_factor * (2 ** (attempt - 1))
                    logger.warning(
                        "Telemetry request to %s failed (attempt %d/%d): %s. Retrying in %.2fs",
                        path, attempt, self.max_retries, exc, sleep_time
                    )
                    time.sleep(sleep_time)
                else:
                    logger.error(
                        "Telemetry request to %s permanently failed after %d attempts: %s",
                        path, self.max_retries, exc
                    )

        raise TransportError(f"Request failed after {self.max_retries} attempts: {last_exception}")

    def send_heartbeat(
        self,
        status: str = "ACTIVE",
        sdk_version: str = "0.2.0",
        metrics: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        path = f"/api/v1/agents/{self.agent_id}/heartbeat"
        payload = {
            "status": status,
            "sdk_version": sdk_version,
            "metrics": metrics or {},
        }
        return self._request_with_retry("POST", path, payload)

    def send_event(self, event: TelemetryEvent) -> Dict[str, Any]:
        path = f"/api/v1/agents/{self.agent_id}/events"
        return self._request_with_retry("POST", path, event.to_dict())

    def send_events_batch(self, events: List[TelemetryEvent]) -> Dict[str, Any]:
        if not events:
            return {"status": "ok", "processed_count": 0}
        path = f"/api/v1/agents/{self.agent_id}/events/batch"
        payload = {"events": [e.to_dict() for e in events]}
        return self._request_with_retry("POST", path, payload)

    def sync_capabilities(self, capabilities: List[CapabilityDefinition]) -> Dict[str, Any]:
        path = f"/api/v1/agents/{self.agent_id}/capabilities/sync"
        payload = {"capabilities": [c.to_dict() for c in capabilities]}
        return self._request_with_retry("POST", path, payload)


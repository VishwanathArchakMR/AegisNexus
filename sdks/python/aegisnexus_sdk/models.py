from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class CapabilityDefinition:
    name: str
    resource_type: str = "API"  # EMAIL | DATABASE | PAYMENT | FILE | API | AGENT_COMMS
    permission_level: str = "READ"  # READ | WRITE | EXECUTE | ADMIN
    is_sensitive: bool = False
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "resource_type": self.resource_type.upper(),
            "permission_level": self.permission_level.upper(),
            "is_sensitive": self.is_sensitive,
            "description": self.description,
        }


@dataclass
class TelemetryEvent:
    event_type: str
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tool: Optional[str] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    permission_level: Optional[str] = None
    status: str = "SUCCESS"  # SUCCESS | FAILURE | DENIED | ERROR
    timestamp: datetime = field(default_factory=utc_now)
    duration_ms: Optional[float] = None
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    target_agent_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    sdk_version: str = "0.2.0"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "tool": self.tool,
            "action": self.action,
            "resource_type": self.resource_type.upper() if self.resource_type else None,
            "permission_level": self.permission_level.upper() if self.permission_level else None,
            "status": self.status.upper(),
            "timestamp": self.timestamp.isoformat(),
            "duration_ms": self.duration_ms,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "target_agent_id": self.target_agent_id,
            "metadata": self.metadata,
            "sdk_version": self.sdk_version,
        }

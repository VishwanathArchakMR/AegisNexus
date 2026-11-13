import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, Any, Dict

from sqlalchemy import DateTime, ForeignKey, String, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.core.time import utc_now

if TYPE_CHECKING:
    from app.models.agent import Agent


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class AgentEvent(Base):
    __tablename__ = "agent_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tool: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    permission_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Telemetry and Traceability Metadata
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    trace_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    span_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    parent_span_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    target_agent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    sdk_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    event_source: Mapped[str] = mapped_column(String(50), nullable=False, default="SDK")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    server_received_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    agent: Mapped["Agent"] = relationship(
        "Agent", foreign_keys=[agent_id], back_populates="events"
    )
    target_agent: Mapped[Optional["Agent"]] = relationship(
        "Agent", foreign_keys=[target_agent_id], lazy="select"
    )

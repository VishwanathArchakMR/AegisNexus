import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
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
        String(36), ForeignKey("agents.id", ondelete="CASCADE")
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tool: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="events")

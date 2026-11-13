import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, String, Text, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class AgentRelationship(Base):
    __tablename__ = "agent_relationships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    source_agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False
    )
    target_agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id"), nullable=False
    )
    # CALLS | DELEGATES | SHARES_CREDENTIAL | MONITORS
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # UNIDIRECTIONAL | BIDIRECTIONAL
    trust_direction: Mapped[str] = mapped_column(
        String(20), nullable=False, default="UNIDIRECTIONAL"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Provenance and Runtime Observation Tracking
    provenance: Mapped[str] = mapped_column(String(50), nullable=False, default="SEEDED")
    last_interaction_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    interaction_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_event_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    source_agent: Mapped["Agent"] = relationship(
        "Agent",
        foreign_keys=[source_agent_id],
        back_populates="outgoing_relationships",
    )
    target_agent: Mapped["Agent"] = relationship(
        "Agent",
        foreign_keys=[target_agent_id],
        back_populates="incoming_relationships",
    )

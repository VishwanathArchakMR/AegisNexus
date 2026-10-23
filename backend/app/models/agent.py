import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.capability import AgentCapability
    from app.models.credential import AgentCredential
    from app.models.relationship import AgentRelationship
    from app.models.organization import Organization
    from app.models.agent_event import AgentEvent


from app.core.time import utc_now


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # customer_support | finance | research | ops | custom
    agent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # ACTIVE | INACTIVE | QUARANTINED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    # CRITICAL | HIGH | MEDIUM | LOW
    trust_level: Mapped[str] = mapped_column(String(20), nullable=False)
    owner_team: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Discovery & Live Reporting Metadata
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="DEMO")
    discovery_method: Mapped[str] = mapped_column(String(50), nullable=False, default="SEEDED")
    confidence: Mapped[str] = mapped_column(String(50), nullable=False, default="SELF_REPORTED")
    api_key_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    organization: Mapped["Organization"] = relationship("Organization", back_populates="agents")
    events: Mapped[List["AgentEvent"]] = relationship(
        "AgentEvent", back_populates="agent", cascade="all, delete-orphan", lazy="select"
    )

    capabilities: Mapped[List["AgentCapability"]] = relationship(
        "AgentCapability",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="select",
    )
    credentials: Mapped[List["AgentCredential"]] = relationship(
        "AgentCredential",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="select",
    )
    outgoing_relationships: Mapped[List["AgentRelationship"]] = relationship(
        "AgentRelationship",
        foreign_keys="AgentRelationship.source_agent_id",
        back_populates="source_agent",
        cascade="all, delete-orphan",
        lazy="select",
    )
    incoming_relationships: Mapped[List["AgentRelationship"]] = relationship(
        "AgentRelationship",
        foreign_keys="AgentRelationship.target_agent_id",
        back_populates="target_agent",
        lazy="select",
    )

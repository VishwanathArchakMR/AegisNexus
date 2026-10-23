import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.core.time import utc_now

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.simulation import AttackExecution, AttackScenario


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class AgentFinding(Base):
    __tablename__ = "agent_findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE")
    )
    execution_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("attack_executions.id", ondelete="SET NULL"), nullable=True
    )
    scenario_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("attack_scenarios.id", ondelete="SET NULL"), nullable=True
    )
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    finding_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # CRITICAL, HIGH, MEDIUM, LOW
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    # OPEN, RESOLVED, IGNORED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="OPEN")
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    affected_capability: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    evaluation_level: Mapped[str] = mapped_column(String(50), nullable=False, default="per-full-task")
    risk_families: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utc_now, onupdate=utc_now
    )

    agent: Mapped["Agent"] = relationship("Agent", foreign_keys=[agent_id], lazy="select")
    execution: Mapped[Optional["AttackExecution"]] = relationship(
        "AttackExecution", foreign_keys=[execution_id], lazy="select"
    )
    scenario: Mapped[Optional["AttackScenario"]] = relationship(
        "AttackScenario", foreign_keys=[scenario_id], lazy="select"
    )

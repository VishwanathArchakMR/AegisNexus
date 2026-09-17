import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class AttackScenario(Base):
    __tablename__ = "attack_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    # PROMPT_INJECTION, PII_EXFILTRATION, PRIVILEGE_ESCALATION, etc.
    attack_type: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    # CRITICAL, HIGH, MEDIUM, LOW
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    target_agent_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload_template: Mapped[str] = mapped_column(Text, nullable=False)
    expected_behavior: Mapped[str] = mapped_column(Text, nullable=False)
    mitigation_guidance: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    executions: Mapped[List["AttackExecution"]] = relationship(
        "AttackExecution",
        back_populates="scenario",
        cascade="all, delete-orphan",
        lazy="select",
    )


class AttackExecution(Base):
    __tablename__ = "attack_executions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    scenario_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("attack_scenarios.id", ondelete="CASCADE")
    )
    target_agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE")
    )
    # PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")
    total_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    completed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    successful_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 0.0 to 1.0 (or 0-100)
    attack_success_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    severity: Mapped[str] = mapped_column(String(20), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evaluation_level: Mapped[str] = mapped_column(String(50), nullable=False, default="per-full-task")

    scenario: Mapped["AttackScenario"] = relationship(
        "AttackScenario", back_populates="executions"
    )
    target_agent: Mapped["Agent"] = relationship(
        "Agent", foreign_keys=[target_agent_id], lazy="select"
    )
    attempts: Mapped[List["AttackAttempt"]] = relationship(
        "AttackAttempt",
        back_populates="execution",
        cascade="all, delete-orphan",
        lazy="select",
    )


class AttackAttempt(Base):
    __tablename__ = "attack_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    execution_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("attack_executions.id", ondelete="CASCADE")
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    input_payload: Mapped[str] = mapped_column(Text, nullable=False)
    simulated_agent_response: Mapped[str] = mapped_column(Text, nullable=False)
    behavior_observed: Mapped[str] = mapped_column(Text, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    success_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    execution_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    execution: Mapped["AttackExecution"] = relationship(
        "AttackExecution", back_populates="attempts"
    )

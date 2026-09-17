import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional, Any, Dict

from sqlalchemy import DateTime, ForeignKey, String, Text, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent
    from app.models.finding import AgentFinding
    from app.models.simulation import AttackExecution


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class RecoveryRecord(Base):
    __tablename__ = "recovery_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    finding_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_findings.id", ondelete="CASCADE")
    )
    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE")
    )
    
    # Statuses: OPEN, PLANNED, APPROVAL_REQUIRED, APPROVED, EXECUTING, VERIFYING, RECOVERED, PARTIALLY_RECOVERED, FAILED, REOPENED
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="OPEN")
    remediation_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    affected_capability: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    affected_resource: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Approval: NOT_REQUIRED, PENDING, APPROVED, REJECTED
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, default="NOT_REQUIRED")
    approved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Execution: NOT_STARTED, SIMULATED, COMPLETED, FAILED
    execution_status: Mapped[str] = mapped_column(String(50), nullable=False, default="NOT_STARTED")
    execution_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    execution_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Verification: NOT_VERIFIED, PASSED, FAILED
    verification_status: Mapped[str] = mapped_column(String(50), nullable=False, default="NOT_VERIFIED")
    verification_execution_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("attack_executions.id", ondelete="SET NULL"), nullable=True
    )
    
    before_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    after_state: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    # Residual Risk: LOW, MEDIUM, HIGH, CRITICAL
    residual_risk: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    residual_risk_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    previous_asr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    current_asr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    recovery_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    finding: Mapped["AgentFinding"] = relationship("AgentFinding", lazy="select")
    agent: Mapped["Agent"] = relationship("Agent", lazy="select")
    verification_execution: Mapped[Optional["AttackExecution"]] = relationship(
        "AttackExecution", lazy="select"
    )


class RecoveryEvent(Base):
    __tablename__ = "recovery_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    recovery_record_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("recovery_records.id", ondelete="CASCADE")
    )
    
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

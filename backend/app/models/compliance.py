import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.agent import Agent


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class ComplianceFramework(Base):
    __tablename__ = "compliance_frameworks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    short_name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    controls: Mapped[List["ComplianceControl"]] = relationship(
        "ComplianceControl",
        back_populates="framework",
        cascade="all, delete-orphan",
        lazy="select"
    )
    assessments: Mapped[List["ComplianceAssessment"]] = relationship(
        "ComplianceAssessment",
        back_populates="framework",
        cascade="all, delete-orphan",
        lazy="select"
    )


class ComplianceControl(Base):
    __tablename__ = "compliance_controls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    framework_id: Mapped[str] = mapped_column(ForeignKey("compliance_frameworks.id"), nullable=False)
    control_id: Mapped[str] = mapped_column(String(100), nullable=False) # e.g. AEGIS-PII-001
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False) # HIGH, MEDIUM, etc.
    evidence_requirements: Mapped[str] = mapped_column(Text, nullable=False)
    remediation_guidance: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    framework: Mapped["ComplianceFramework"] = relationship(
        "ComplianceFramework",
        back_populates="controls"
    )


class ComplianceAssessment(Base):
    __tablename__ = "compliance_assessments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    framework_id: Mapped[str] = mapped_column(ForeignKey("compliance_frameworks.id"), nullable=False)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False) # COMPLIANT, PARTIALLY_COMPLIANT, NON_COMPLIANT
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    assessed_controls: Mapped[int] = mapped_column(Integer, nullable=False)
    passing_controls: Mapped[int] = mapped_column(Integer, nullable=False)
    failing_controls: Mapped[int] = mapped_column(Integer, nullable=False)
    partial_controls: Mapped[int] = mapped_column(Integer, nullable=False)
    not_assessed_controls: Mapped[int] = mapped_column(Integer, nullable=False)
    assessed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    framework: Mapped["ComplianceFramework"] = relationship(
        "ComplianceFramework",
        back_populates="assessments"
    )
    agent: Mapped["Agent"] = relationship("Agent")
    results: Mapped[List["ComplianceResult"]] = relationship(
        "ComplianceResult",
        back_populates="assessment",
        cascade="all, delete-orphan",
        lazy="select"
    )


class ComplianceResult(Base):
    __tablename__ = "compliance_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_uuid)
    assessment_id: Mapped[str] = mapped_column(ForeignKey("compliance_assessments.id"), nullable=False)
    control_id: Mapped[str] = mapped_column(ForeignKey("compliance_controls.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False) # PASS, PARTIAL, FAIL, NOT_ASSESSED
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    evidence: Mapped[str] = mapped_column(Text, nullable=False)
    affected_agent: Mapped[str] = mapped_column(String(36), nullable=False) # Copied agent_id for easy tracing
    related_finding_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    related_simulation_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)

    assessment: Mapped["ComplianceAssessment"] = relationship(
        "ComplianceAssessment",
        back_populates="results"
    )
    control: Mapped["ComplianceControl"] = relationship("ComplianceControl")

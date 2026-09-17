from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.agent import AgentBasic


class ComplianceFrameworkBase(BaseModel):
    name: str
    short_name: str
    description: str
    version: str
    enabled: bool


class ComplianceFramework(ComplianceFrameworkBase):
    id: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ComplianceControlBase(BaseModel):
    framework_id: str
    control_id: str
    title: str
    description: str
    category: str
    severity: str
    evidence_requirements: str
    remediation_guidance: str
    enabled: bool


class ComplianceControl(ComplianceControlBase):
    id: str

    model_config = {"from_attributes": True}


class ComplianceResultBase(BaseModel):
    assessment_id: str
    control_id: str
    status: str
    score: Optional[int]
    evidence: str
    affected_agent: str
    related_finding_id: Optional[str]
    related_simulation_id: Optional[str]
    explanation: str
    recommendation: str


class ComplianceResult(ComplianceResultBase):
    id: str
    control: ComplianceControl

    model_config = {"from_attributes": True}


class ComplianceAssessmentBase(BaseModel):
    framework_id: str
    agent_id: str
    status: str
    score: int
    assessed_controls: int
    passing_controls: int
    failing_controls: int
    partial_controls: int
    not_assessed_controls: int


class ComplianceAssessment(ComplianceAssessmentBase):
    id: str
    assessed_at: datetime

    model_config = {"from_attributes": True}


class ComplianceAssessmentDetail(ComplianceAssessment):
    framework: ComplianceFramework
    agent: AgentBasic
    results: List[ComplianceResult] = []

    model_config = {"from_attributes": True}


class AssessmentRequest(BaseModel):
    framework_id: str
    agent_id: str


class ComplianceSummary(BaseModel):
    total_frameworks: int
    total_assessments: int
    average_score: int
    compliant_agents: int
    partially_compliant_agents: int
    non_compliant_agents: int
    controls_passing: int
    controls_failing: int
    controls_partial: int


class AgentFrameworkPosture(BaseModel):
    framework_id: str
    framework_name: str
    score: int
    status: str
    failed_controls: int
    partial_controls: int
    assessment_id: str


class AgentCompliancePosture(BaseModel):
    agent_id: str
    frameworks: List[AgentFrameworkPosture]

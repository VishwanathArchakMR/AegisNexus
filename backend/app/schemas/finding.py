from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.schemas.agent import AgentBasic
from app.schemas.simulation import AttackScenarioBase, AttackExecutionSummary


class AgentFindingBase(BaseModel):
    title: str
    description: str
    finding_type: str
    severity: str
    status: str
    evidence: str
    affected_capability: Optional[str] = None
    recommendation: str
    risk_families: list[str] = []
    source_type: str = "SIMULATION"  # SIMULATION | RUNTIME_DETECTION | ADMINISTRATIVE
    event_id: Optional[str] = None
    detection_rule: Optional[str] = None


class AgentFindingSummary(AgentFindingBase):
    id: str
    agent_id: str
    execution_id: Optional[str]
    scenario_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Summary often needs just the agent info
    agent: AgentBasic

    model_config = {"from_attributes": True}


class AgentFindingDetail(AgentFindingSummary):
    # Full detail can include execution context and scenario info
    execution: Optional[AttackExecutionSummary] = None
    
    model_config = {"from_attributes": True}

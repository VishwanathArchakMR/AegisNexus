from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.agent import AgentBasic


class AttackScenarioBase(BaseModel):
    name: str
    description: str
    attack_type: str
    category: str
    severity: str
    target_agent_type: str
    payload_template: str
    expected_behavior: str
    mitigation_guidance: str
    enabled: bool


class AttackScenario(AttackScenarioBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AttackAttemptBase(BaseModel):
    attempt_number: int
    input_payload: str
    simulated_agent_response: str
    behavior_observed: str
    success: bool
    success_reason: Optional[str] = None
    severity: str
    execution_time_ms: int


class AttackAttempt(AttackAttemptBase):
    id: str
    execution_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AttackExecutionBase(BaseModel):
    scenario_id: str
    target_agent_id: str
    total_attempts: int


class AttackExecutionCreate(BaseModel):
    scenario_id: str
    target_agent_id: str
    attempts: int = Field(5, ge=1, le=20)


class AttackExecutionSummary(BaseModel):
    id: str
    scenario_id: str
    target_agent_id: str
    status: str
    total_attempts: int
    completed_attempts: int
    successful_attempts: int
    attack_success_rate: float
    severity: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]

    # Nested for list views
    scenario: AttackScenarioBase
    target_agent: AgentBasic

    model_config = {"from_attributes": True}


class AttackExecutionDetail(AttackExecutionSummary):
    attempts: List[AttackAttempt] = []

    model_config = {"from_attributes": True}

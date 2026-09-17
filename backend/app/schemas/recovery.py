from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


class RecoveryEventBase(BaseModel):
    event_type: str
    actor: str
    message: str
    metadata_json: Optional[Dict[str, Any]] = None

class RecoveryEvent(RecoveryEventBase):
    id: str
    recovery_record_id: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RecoveryRecordBase(BaseModel):
    finding_id: str
    agent_id: str


class RecoveryRecordCreate(RecoveryRecordBase):
    pass


class RecoveryRecord(RecoveryRecordBase):
    id: str
    status: str
    remediation_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    recommended_action: Optional[str] = None
    affected_capability: Optional[str] = None
    affected_resource: Optional[str] = None
    
    approval_status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    execution_status: str
    execution_started_at: Optional[datetime] = None
    execution_completed_at: Optional[datetime] = None
    
    verification_status: str
    verification_execution_id: Optional[str] = None
    
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    
    residual_risk: Optional[str] = None
    residual_risk_explanation: Optional[str] = None
    
    previous_asr: Optional[float] = None
    current_asr: Optional[float] = None
    
    recovery_notes: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class RecoverySummary(BaseModel):
    total_recovery_records: int
    open: int
    planned: int
    approval_required: int
    executing: int
    recovered: int
    partially_recovered: int
    failed: int
    reopened: int
    average_asr_reduction: float
    high_residual_risk_count: int
    critical_residual_risk_count: int


# We omit full circular imports in this schema and define them in the endpoint response instead,
# or we just rely on dict representations if needed. We'll add what we need for RecoveryDetail.

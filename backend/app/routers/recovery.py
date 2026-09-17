from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.dependencies import get_db
from app.models.finding import AgentFinding
from app.models.recovery import RecoveryRecord, RecoveryEvent
from app.schemas.recovery import RecoveryRecord as RecoveryRecordSchema, RecoveryEvent as RecoveryEventSchema, RecoverySummary
from app.schemas.recovery import RecoveryRecordCreate
from app.services.recovery_engine import RecoveryEngine

router = APIRouter(prefix="/recovery", tags=["recovery"])


@router.get("/", response_model=List[RecoveryRecordSchema])
async def list_recovery_records(
    status: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    finding_id: Optional[str] = Query(None),
    residual_risk: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(RecoveryRecord)
    if status:
        stmt = stmt.where(RecoveryRecord.status == status)
    if agent_id:
        stmt = stmt.where(RecoveryRecord.agent_id == agent_id)
    if finding_id:
        stmt = stmt.where(RecoveryRecord.finding_id == finding_id)
    if residual_risk:
        stmt = stmt.where(RecoveryRecord.residual_risk == residual_risk)
        
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/summary", response_model=RecoverySummary)
async def get_recovery_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RecoveryRecord))
    records = result.scalars().all()
    
    total = len(records)
    open_c = sum(1 for r in records if r.status == "OPEN")
    planned = sum(1 for r in records if r.status == "PLANNED")
    approval = sum(1 for r in records if r.status == "APPROVAL_REQUIRED")
    executing = sum(1 for r in records if r.status in ("EXECUTING", "VERIFYING"))
    recovered = sum(1 for r in records if r.status == "RECOVERED")
    partial = sum(1 for r in records if r.status == "PARTIALLY_RECOVERED")
    failed = sum(1 for r in records if r.status == "FAILED")
    reopened = sum(1 for r in records if r.status == "REOPENED")
    
    high_risk = sum(1 for r in records if r.residual_risk == "HIGH")
    critical_risk = sum(1 for r in records if r.residual_risk == "CRITICAL")
    
    reduction = 0.0
    valid_reductions = [r.previous_asr - r.current_asr for r in records if r.previous_asr is not None and r.current_asr is not None]
    if valid_reductions:
        reduction = sum(valid_reductions) / len(valid_reductions)
        
    return RecoverySummary(
        total_recovery_records=total,
        open=open_c,
        planned=planned,
        approval_required=approval,
        executing=executing,
        recovered=recovered,
        partially_recovered=partial,
        failed=failed,
        reopened=reopened,
        average_asr_reduction=round(reduction, 2),
        high_residual_risk_count=high_risk,
        critical_residual_risk_count=critical_risk
    )


@router.get("/{recovery_id}", response_model=RecoveryRecordSchema)
async def get_recovery_record(recovery_id: str, db: AsyncSession = Depends(get_db)):
    record = await db.get(RecoveryRecord, recovery_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recovery record not found")
    return record


@router.post("/", response_model=RecoveryRecordSchema)
async def create_recovery_record(payload: RecoveryRecordCreate, db: AsyncSession = Depends(get_db)):
    finding = await db.get(AgentFinding, payload.finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
        
    # Check if a recovery record already exists
    existing = await db.execute(select(RecoveryRecord).where(RecoveryRecord.finding_id == payload.finding_id))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Recovery record already exists for this finding")
        
    record = RecoveryRecord(
        finding_id=payload.finding_id,
        agent_id=payload.agent_id,
        status="OPEN"
    )
    db.add(record)
    await db.flush()
    
    await RecoveryEngine.record_event(
        db, record.id, "RECOVERY_CREATED", "Initialized recovery ledger entry for finding."
    )
    
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{recovery_id}/plan", response_model=RecoveryRecordSchema)
async def create_recovery_plan(recovery_id: str, db: AsyncSession = Depends(get_db)):
    record = await db.get(RecoveryRecord, recovery_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recovery record not found")
        
    if record.status not in ("OPEN", "PLANNED", "FAILED"):
        raise HTTPException(status_code=400, detail="Invalid lifecycle transition to plan")
        
    finding = await db.get(AgentFinding, record.finding_id)
    record = await RecoveryEngine.create_plan(db, record, finding)
    
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{recovery_id}/approve", response_model=RecoveryRecordSchema)
async def approve_recovery(recovery_id: str, db: AsyncSession = Depends(get_db)):
    record = await db.get(RecoveryRecord, recovery_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recovery record not found")
        
    if record.status != "PLANNED":
        raise HTTPException(status_code=400, detail="Must have a plan before approval")
        
    record = await RecoveryEngine.approve_plan(db, record)
    
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{recovery_id}/execute", response_model=RecoveryRecordSchema)
async def execute_recovery(recovery_id: str, db: AsyncSession = Depends(get_db)):
    record = await db.get(RecoveryRecord, recovery_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recovery record not found")
        
    if record.approval_status != "APPROVED":
        raise HTTPException(status_code=400, detail="Authorized Sandbox Recovery Simulation requires approval")
        
    record = await RecoveryEngine.execute_simulation(db, record)
    
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/{recovery_id}/verify", response_model=RecoveryRecordSchema)
async def verify_recovery(recovery_id: str, db: AsyncSession = Depends(get_db)):
    record = await db.get(RecoveryRecord, recovery_id)
    if not record:
        raise HTTPException(status_code=404, detail="Recovery record not found")
        
    if record.execution_status != "SIMULATED":
        raise HTTPException(status_code=400, detail="Must execute simulation before verifying")
        
    record = await RecoveryEngine.verify_recovery(db, record)
    
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{recovery_id}/events", response_model=List[RecoveryEventSchema])
async def get_recovery_events(recovery_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RecoveryEvent)
        .where(RecoveryEvent.recovery_record_id == recovery_id)
        .order_by(RecoveryEvent.created_at.asc())
    )
    return result.scalars().all()

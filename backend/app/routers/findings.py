from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.finding import AgentFinding
from app.models.simulation import AttackExecution
from app.schemas.finding import AgentFindingSummary, AgentFindingDetail

router = APIRouter(tags=["findings"])

@router.get("/findings", response_model=List[AgentFindingSummary])
async def list_findings(
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    agent_id: Optional[str] = Query(None),
    finding_type: Optional[str] = Query(None),
    source_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AgentFinding).options(selectinload(AgentFinding.agent)).order_by(AgentFinding.created_at.desc())

    if severity:
        stmt = stmt.where(AgentFinding.severity == severity)
    if status:
        stmt = stmt.where(AgentFinding.status == status)
    if agent_id:
        stmt = stmt.where(AgentFinding.agent_id == agent_id)
    if finding_type:
        stmt = stmt.where(AgentFinding.finding_type == finding_type)
    if source_type:
        stmt = stmt.where(AgentFinding.source_type == source_type)

    result = await db.scalars(stmt)
    return result.all()

@router.get("/findings/{finding_id}", response_model=AgentFindingDetail)
async def get_finding(finding_id: str, db: AsyncSession = Depends(get_db)):
    finding = await db.scalar(
        select(AgentFinding)
        .options(
            selectinload(AgentFinding.agent),
            selectinload(AgentFinding.execution).selectinload(AttackExecution.scenario),
            selectinload(AgentFinding.execution).selectinload(AttackExecution.target_agent)
        )
        .where(AgentFinding.id == finding_id)
    )
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    return finding

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.dependencies import get_db
from app.models.compliance import ComplianceFramework, ComplianceControl, ComplianceAssessment, ComplianceResult
from app.models.agent import Agent
from app.schemas.compliance import (
    ComplianceFramework as ComplianceFrameworkSchema,
    ComplianceControl as ComplianceControlSchema,
    ComplianceAssessment as ComplianceAssessmentSchema,
    ComplianceAssessmentDetail,
    AssessmentRequest,
    ComplianceSummary,
    AgentCompliancePosture,
    AgentFrameworkPosture
)
from app.services.compliance_engine import ComplianceEngine

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.get("/frameworks", response_model=List[ComplianceFrameworkSchema])
async def list_frameworks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ComplianceFramework))
    return result.scalars().all()


@router.get("/frameworks/{framework_id}", response_model=ComplianceFrameworkSchema)
async def get_framework(framework_id: str, db: AsyncSession = Depends(get_db)):
    framework = await db.get(ComplianceFramework, framework_id)
    if not framework:
        raise HTTPException(status_code=404, detail="Framework not found")
    return framework


@router.get("/controls", response_model=List[ComplianceControlSchema])
async def list_controls(
    framework_id: Optional[str] = None,
    category: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(ComplianceControl)
    if framework_id:
        query = query.where(ComplianceControl.framework_id == framework_id)
    if category:
        query = query.where(ComplianceControl.category == category)
    if severity:
        query = query.where(ComplianceControl.severity == severity)
        
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/assessments", response_model=ComplianceAssessmentDetail)
async def create_assessment(req: AssessmentRequest, db: AsyncSession = Depends(get_db)):
    engine = ComplianceEngine(db)
    try:
        assessment = await engine.evaluate_agent(req.framework_id, req.agent_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
        
    # reload with relationships
    stmt = select(ComplianceAssessment).options(
        selectinload(ComplianceAssessment.framework),
        selectinload(ComplianceAssessment.agent),
        selectinload(ComplianceAssessment.results).selectinload(ComplianceResult.control)
    ).where(ComplianceAssessment.id == assessment.id)
    
    res = await db.execute(stmt)
    return res.scalars().one()


@router.get("/assessments", response_model=List[ComplianceAssessmentSchema])
async def list_assessments(
    framework_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(ComplianceAssessment)
    if framework_id:
        query = query.where(ComplianceAssessment.framework_id == framework_id)
    if agent_id:
        query = query.where(ComplianceAssessment.agent_id == agent_id)
    if status:
        query = query.where(ComplianceAssessment.status == status)
        
    query = query.order_by(ComplianceAssessment.assessed_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/assessments/{assessment_id}", response_model=ComplianceAssessmentDetail)
async def get_assessment(assessment_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(ComplianceAssessment).options(
        selectinload(ComplianceAssessment.framework),
        selectinload(ComplianceAssessment.agent),
        selectinload(ComplianceAssessment.results).selectinload(ComplianceResult.control)
    ).where(ComplianceAssessment.id == assessment_id)
    
    res = await db.execute(stmt)
    assessment = res.scalars().first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment


@router.get("/agents/{agent_id}", response_model=AgentCompliancePosture)
async def get_agent_posture(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    # Get latest assessment for each framework
    frameworks_res = await db.execute(select(ComplianceFramework))
    frameworks = frameworks_res.scalars().all()
    
    postures = []
    for fw in frameworks:
        stmt = select(ComplianceAssessment).where(
            ComplianceAssessment.framework_id == fw.id,
            ComplianceAssessment.agent_id == agent_id
        ).order_by(ComplianceAssessment.assessed_at.desc()).limit(1)
        
        latest_res = await db.execute(stmt)
        latest = latest_res.scalars().first()
        
        if latest:
            postures.append(
                AgentFrameworkPosture(
                    framework_id=fw.id,
                    framework_name=fw.name,
                    score=latest.score,
                    status=latest.status,
                    failed_controls=latest.failing_controls,
                    partial_controls=latest.partial_controls,
                    assessment_id=latest.id
                )
            )
            
    return AgentCompliancePosture(
        agent_id=agent_id,
        frameworks=postures
    )


@router.get("/summary", response_model=ComplianceSummary)
async def get_summary(db: AsyncSession = Depends(get_db)):
    fw_count = await db.scalar(select(func.count(ComplianceFramework.id)))
    ass_count = await db.scalar(select(func.count(ComplianceAssessment.id)))
    
    avg_score = await db.scalar(select(func.avg(ComplianceAssessment.score)))
    
    # We want unique agents that are compliant, partial, or non-compliant
    # based on their LATEST assessment.
    # To keep it simple for MVP, we just count assessments.
    # Actually, the user asked for agents. Let's do distinct counts.
    
    compliant_agents = await db.scalar(
        select(func.count(func.distinct(ComplianceAssessment.agent_id)))
        .where(ComplianceAssessment.status == "COMPLIANT")
    )
    partial_agents = await db.scalar(
        select(func.count(func.distinct(ComplianceAssessment.agent_id)))
        .where(ComplianceAssessment.status == "PARTIALLY_COMPLIANT")
    )
    non_compliant_agents = await db.scalar(
        select(func.count(func.distinct(ComplianceAssessment.agent_id)))
        .where(ComplianceAssessment.status == "NON_COMPLIANT")
    )
    
    controls_passing = await db.scalar(select(func.sum(ComplianceAssessment.passing_controls))) or 0
    controls_failing = await db.scalar(select(func.sum(ComplianceAssessment.failing_controls))) or 0
    controls_partial = await db.scalar(select(func.sum(ComplianceAssessment.partial_controls))) or 0

    return ComplianceSummary(
        total_frameworks=fw_count or 0,
        total_assessments=ass_count or 0,
        average_score=int(avg_score) if avg_score is not None else 0,
        compliant_agents=compliant_agents or 0,
        partially_compliant_agents=partial_agents or 0,
        non_compliant_agents=non_compliant_agents or 0,
        controls_passing=controls_passing,
        controls_failing=controls_failing,
        controls_partial=controls_partial
    )

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.simulation import AttackScenario, AttackExecution, AttackAttempt
from app.models.finding import AgentFinding
from app.schemas.simulation import (
    AttackScenario as AttackScenarioSchema,
    AttackExecutionCreate,
    AttackExecutionSummary,
    AttackExecutionDetail,
    AttackAttempt as AttackAttemptSchema,
)
from app.schemas.finding import AgentFindingSummary
from app.services.simulation_service import SimulationService

router = APIRouter(tags=["simulations"])

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("/attack-scenarios", response_model=List[AttackScenarioSchema])
async def list_attack_scenarios(db: AsyncSession = Depends(get_db)):
    result = await db.scalars(select(AttackScenario).where(AttackScenario.enabled == True))
    return result.all()

@router.get("/attack-scenarios/{scenario_id}", response_model=AttackScenarioSchema)
async def get_attack_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    scenario = await db.scalar(select(AttackScenario).where(AttackScenario.id == scenario_id))
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

@router.post("/attack-simulations", response_model=AttackExecutionSummary)
async def create_attack_simulation(
    req: AttackExecutionCreate, db: AsyncSession = Depends(get_db)
):
    service = SimulationService(db)
    try:
        execution = await service.execute_simulation(
            scenario_id=req.scenario_id,
            agent_id=req.target_agent_id,
            attempts=req.attempts
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    
    # Reload with relations for the response
    execution_loaded = await db.scalar(
        select(AttackExecution)
        .options(selectinload(AttackExecution.scenario), selectinload(AttackExecution.target_agent))
        .where(AttackExecution.id == execution.id)
    )
    return execution_loaded

@router.get("/attack-simulations", response_model=List[AttackExecutionSummary])
async def list_attack_simulations(
    target_agent_id: Optional[str] = Query(None),
    scenario_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AttackExecution).options(
        selectinload(AttackExecution.scenario), selectinload(AttackExecution.target_agent)
    ).order_by(AttackExecution.started_at.desc())

    if target_agent_id:
        stmt = stmt.where(AttackExecution.target_agent_id == target_agent_id)
    if scenario_id:
        stmt = stmt.where(AttackExecution.scenario_id == scenario_id)
    if status:
        stmt = stmt.where(AttackExecution.status == status)

    result = await db.scalars(stmt)
    return result.all()

@router.get("/attack-simulations/{execution_id}", response_model=AttackExecutionDetail)
async def get_attack_simulation(execution_id: str, db: AsyncSession = Depends(get_db)):
    execution = await db.scalar(
        select(AttackExecution)
        .options(
            selectinload(AttackExecution.scenario),
            selectinload(AttackExecution.target_agent),
            selectinload(AttackExecution.attempts),
        )
        .where(AttackExecution.id == execution_id)
    )
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution

@router.get("/attack-simulations/{execution_id}/attempts", response_model=List[AttackAttemptSchema])
async def get_attack_simulation_attempts(execution_id: str, db: AsyncSession = Depends(get_db)):
    execution = await db.scalar(select(AttackExecution).where(AttackExecution.id == execution_id))
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    result = await db.scalars(
        select(AttackAttempt)
        .where(AttackAttempt.execution_id == execution_id)
        .order_by(AttackAttempt.attempt_number)
    )
    return result.all()

@router.get("/attack-simulations/{execution_id}/findings", response_model=List[AgentFindingSummary])
async def get_attack_simulation_findings(execution_id: str, db: AsyncSession = Depends(get_db)):
    execution = await db.scalar(select(AttackExecution).where(AttackExecution.id == execution_id))
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    result = await db.scalars(
        select(AgentFinding)
        .options(selectinload(AgentFinding.agent))
        .where(AgentFinding.execution_id == execution_id)
    )
    return result.all()

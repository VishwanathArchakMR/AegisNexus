from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import secrets

from app.core.time import utc_now

from app.dependencies import get_db, get_api_key_agent, hash_api_key
from app.models.capability import AgentCapability
from app.models.credential import AgentCredential
from app.models.relationship import AgentRelationship
from app.models.agent import Agent
from app.models.agent_event import AgentEvent
from app.schemas.agent import (
    AgentDetail,
    AgentListResponse,
    AgentSummary,
    CapabilitySchema,
    CredentialSchema,
    RelationshipSchema,
    RegisterRequest,
    RegisterResponse,
    HeartbeatRequest,
    EventRequest,
)
from app.schemas.blast_radius import BlastRadiusResponse
from app.services.blast_radius_service import calculate_blast_radius

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=AgentListResponse)
async def list_agents(
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE | INACTIVE | QUARANTINED"),
    trust_level: Optional[str] = Query(None, description="Filter by trust level: CRITICAL | HIGH | MEDIUM | LOW"),
    agent_type: Optional[str] = Query(None, description="Filter by agent type: customer_support | finance | research | ops | custom"),
    search: Optional[str] = Query(None, description="Case-insensitive name search"),
    db: AsyncSession = Depends(get_db),
) -> AgentListResponse:
    """Return registered agents with optional filtering."""
    query = select(Agent).order_by(Agent.created_at)

    # Apply server-side filters
    conditions = []
    if status:
        conditions.append(Agent.status == status.upper())
    if trust_level:
        conditions.append(Agent.trust_level == trust_level.upper())
    if agent_type:
        conditions.append(Agent.agent_type == agent_type.lower())
    if search:
        conditions.append(Agent.name.ilike(f"%{search}%"))
    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    agents = result.scalars().all()

    summaries: list[AgentSummary] = []
    for agent in agents:
        cap_count = (
            await db.scalar(
                select(func.count(AgentCapability.id)).where(
                    AgentCapability.agent_id == agent.id
                )
            )
        ) or 0
        cred_count = (
            await db.scalar(
                select(func.count(AgentCredential.id)).where(
                    AgentCredential.agent_id == agent.id
                )
            )
        ) or 0
        rel_count = (
            await db.scalar(
                select(func.count(AgentRelationship.id)).where(
                    or_(
                        AgentRelationship.source_agent_id == agent.id,
                        AgentRelationship.target_agent_id == agent.id,
                    )
                )
            )
        ) or 0

        
        now = utc_now()
        is_offline = False
        if agent.source == "LIVE":
            if agent.last_seen_at:
                # Handle tz-aware vs naive compatibility if needed
                last_seen = agent.last_seen_at.replace(tzinfo=timezone.utc) if agent.last_seen_at.tzinfo is None else agent.last_seen_at
                is_offline = (now - last_seen).total_seconds() > 45
            else:
                is_offline = True

        summaries.append(
            AgentSummary(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                agent_type=agent.agent_type,
                status=agent.status,
                trust_level=agent.trust_level,
                owner_team=agent.owner_team,
                created_at=agent.created_at,
                updated_at=agent.updated_at,
                capability_count=cap_count,
                credential_count=cred_count,
                relationship_count=rel_count,
                source=agent.source,
                discovery_method=agent.discovery_method,
                confidence=agent.confidence,
                last_seen_at=agent.last_seen_at,
                is_offline=is_offline,
            )
        )

    return AgentListResponse(agents=summaries, total=len(summaries))


@router.get("/{agent_id}/blast-radius", response_model=BlastRadiusResponse)
async def get_blast_radius(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> BlastRadiusResponse:
    """
    Compute the blast-radius assessment for the specified agent.

    Returns a graph (nodes + edges) plus an impact summary suitable for
    React-Flow visualisation and the detail-page summary panel.
    """
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    try:
        return await calculate_blast_radius(agent_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{agent_id}", response_model=AgentDetail)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)) -> AgentDetail:
    """Return full agent detail including capabilities, credentials and relationships."""
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    caps = (
        await db.execute(
            select(AgentCapability).where(AgentCapability.agent_id == agent_id)
        )
    ).scalars().all()

    creds = (
        await db.execute(
            select(AgentCredential).where(AgentCredential.agent_id == agent_id)
        )
    ).scalars().all()

    outgoing = (
        await db.execute(
            select(AgentRelationship).where(
                AgentRelationship.source_agent_id == agent_id
            )
        )
    ).scalars().all()

    incoming = (
        await db.execute(
            select(AgentRelationship).where(
                AgentRelationship.target_agent_id == agent_id
            )
        )
    ).scalars().all()

    now = utc_now()
    is_offline = False
    if agent.source == "LIVE":
        if agent.last_seen_at:
            last_seen = agent.last_seen_at.replace(tzinfo=timezone.utc) if agent.last_seen_at.tzinfo is None else agent.last_seen_at
            is_offline = (now - last_seen).total_seconds() > 45
        else:
            is_offline = True

    return AgentDetail(
        id=agent.id,
        name=agent.name,
        description=agent.description,
        agent_type=agent.agent_type,
        status=agent.status,
        trust_level=agent.trust_level,
        owner_team=agent.owner_team,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        capabilities=[CapabilitySchema.model_validate(c) for c in caps],
        credentials=[CredentialSchema.model_validate(c) for c in creds],
        outgoing_relationships=[RelationshipSchema.model_validate(r) for r in outgoing],
        incoming_relationships=[RelationshipSchema.model_validate(r) for r in incoming],
        source=agent.source,
        discovery_method=agent.discovery_method,
        confidence=agent.confidence,
        last_seen_at=agent.last_seen_at,
        is_offline=is_offline,
    )

@router.post("/register", response_model=RegisterResponse)
async def register_agent(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Generate API key
    raw_api_key = secrets.token_urlsafe(32)
    hashed_key = hash_api_key(raw_api_key)

    new_agent = Agent(
        name=req.name,
        agent_type=req.agent_type,
        description=req.description,
        owner_team=req.owner_team,
        trust_level=req.trust_level,
        status="ACTIVE",
        source="LIVE",
        discovery_method="SELF_REPORTED",
        confidence="SELF_REPORTED",
        api_key_hash=hashed_key,
        last_seen_at=utc_now()
    )
    
    db.add(new_agent)
    await db.flush()

    if req.capabilities:
        for cap in req.capabilities:
            db.add(AgentCapability(
                agent_id=new_agent.id,
                capability_name=cap.get("name", "Unknown"),
                resource_type=cap.get("resource_type", "API"),
                permission_level=cap.get("permission", "EXECUTE"),
                is_sensitive=cap.get("is_sensitive", False),
                description=cap.get("description", "")
            ))
            
    await db.commit()
    
    # Return plaintext api_key ONLY here
    return RegisterResponse(agent_id=new_agent.id, api_key=raw_api_key)

@router.post("/{agent_id}/heartbeat")
async def agent_heartbeat(
    agent_id: str,
    req: HeartbeatRequest,
    agent: Agent = Depends(get_api_key_agent),
    db: AsyncSession = Depends(get_db)
):
    if agent.id != agent_id:
        raise HTTPException(status_code=403, detail="API Key does not match agent_id")

    agent.last_seen_at = utc_now()
    agent.status = req.status.upper()
    await db.commit()
    
    return {"status": "ok"}

from app.models.simulation import AttackScenario, AttackAttempt
from app.models.finding import AgentFinding

@router.post("/{agent_id}/events")
async def agent_event(
    agent_id: str,
    req: EventRequest,
    agent: Agent = Depends(get_api_key_agent),
    db: AsyncSession = Depends(get_db)
):
    if agent.id != agent_id:
        raise HTTPException(status_code=403, detail="API Key does not match agent_id")

    # 1. Record event
    event = AgentEvent(
        agent_id=agent.id,
        event_type=req.event_type,
        tool=req.tool,
        action=req.action,
        status=req.status,
        payload=req.payload,
        created_at=utc_now()
    )
    db.add(event)
    agent.last_seen_at = utc_now()
    await db.flush()

    # 2. Feed the SAME blast-radius/finding path DEMO agents use
    # A LIVE agent triggers an AttackAttempt / Execution to simulate a test finding if unsafe
    # Here we mock this by checking if the action is inherently unsafe (e.g., 'approve_refund')
    if req.action == "approve_refund":
        # Check if we have a scenario for this
        scenario = await db.scalar(
            select(AttackScenario).where(AttackScenario.attack_type == "PRIVILEGE_ESCALATION")
        )
        
        # Derive severity from capability
        cap = await db.scalar(
            select(AgentCapability).where(
                AgentCapability.agent_id == agent.id,
                AgentCapability.capability_name == req.action
            )
        )
        # Fallback if not found
        if not cap:
            cap = AgentCapability(permission_level="EXECUTE", resource_type="PAYMENT", is_sensitive=True)

        from app.services.blast_radius_service import derive_capability_risk_families, derive_severity_from_families
        families_set = derive_capability_risk_families(cap)
        derived_severity = derive_severity_from_families(families_set)
        risk_families = sorted(list(families_set))

        if scenario:
            from app.services.simulation_service import SimulationService
            # We construct a mock execution explicitly for this live event
            from app.models.simulation import AttackExecution
            
            execution = AttackExecution(
                scenario_id=scenario.id,
                target_agent_id=agent.id,
                status="COMPLETED",
                total_attempts=1,
                completed_attempts=1,
                successful_attempts=1,
                attack_success_rate=1.0,
                severity=derived_severity,
                started_at=utc_now(),
                completed_at=utc_now(),
                evaluation_level="per-tool-call" # Tag as per-tool-call
            )
            db.add(execution)
            await db.flush()
            
            attempt = AttackAttempt(
                execution_id=execution.id,
                attempt_number=1,
                input_payload=req.payload or "Live event payload",
                simulated_agent_response="Live agent executed action",
                behavior_observed=f"Agent executed tool {req.tool} with action {req.action}",
                success=True,
                success_reason="Live event executed a privileged action",
                severity=derived_severity,
                execution_time_ms=50
            )
            db.add(attempt)
            await db.flush()
            
            # Generate deduplicated finding
            existing_finding = await db.scalar(
                select(AgentFinding).where(
                    AgentFinding.agent_id == agent.id,
                    AgentFinding.scenario_id == scenario.id,
                )
            )
            
            finding_title = f"Live agent invoked sensitive capability: {req.action}"

            if not existing_finding:
                finding = AgentFinding(
                    agent_id=agent.id,
                    execution_id=execution.id,
                    scenario_id=scenario.id,
                    title=finding_title,
                    description=f"The live agent exhibited vulnerability to {scenario.attack_type}.",
                    finding_type=scenario.attack_type,
                    severity=derived_severity,
                    status="OPEN",
                    evidence=(
                        f"Targeted Scenario: {scenario.name}\n"
                        f"Target Agent: {agent.name}\n"
                        f"Live Event Triggered Action: {req.action}\n"
                        f"Evaluation Level: per-tool-call"
                    ),
                    recommendation=scenario.mitigation_guidance,
                    evaluation_level="per-tool-call",
                    risk_families=risk_families
                )
                db.add(finding)
            else:
                existing_finding.execution_id = execution.id
                existing_finding.evaluation_level = "per-tool-call"
                existing_finding.severity = derived_severity
                existing_finding.title = finding_title
                existing_finding.risk_families = risk_families
                existing_finding.evidence = (
                    f"Targeted Scenario: {scenario.name}\n"
                    f"Target Agent: {agent.name}\n"
                    f"Live Event Triggered Action: {req.action}\n"
                    f"Evaluation Level: per-tool-call"
                )

    await db.commit()
    
    return {"status": "ok", "event_id": event.id}


@router.get("/{agent_id}/capabilities", response_model=list[CapabilitySchema])
async def list_agent_capabilities(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> list[CapabilitySchema]:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    caps = (
        await db.execute(
            select(AgentCapability).where(AgentCapability.agent_id == agent_id)
        )
    ).scalars().all()
    return [CapabilitySchema.model_validate(c) for c in caps]


@router.get("/{agent_id}/relationships", response_model=list[RelationshipSchema])
async def list_agent_relationships(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> list[RelationshipSchema]:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    rels = (
        await db.execute(
            select(AgentRelationship).where(
                or_(
                    AgentRelationship.source_agent_id == agent_id,
                    AgentRelationship.target_agent_id == agent_id,
                )
            )
        )
    ).scalars().all()
    return [RelationshipSchema.model_validate(r) for r in rels]

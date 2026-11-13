from typing import Optional, List
from datetime import datetime, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.time import utc_now
from app.core.agent_status import (
    compute_connection_status,
    STATUS_ACTIVE,
    STATUS_INACTIVE,
    STATUS_QUARANTINED,
    KEY_STATUS_ACTIVE,
    KEY_STATUS_REVOKED,
    KEY_STATUS_ROTATED,
    PROVENANCE_SELF_REPORTED,
    PROVENANCE_OBSERVED,
    PROVENANCE_VERIFIED,
)
from app.dependencies import (
    get_db,
    get_api_key_agent,
    get_operator_access,
    hash_api_key,
)
from app.models.agent import Agent
from app.models.agent_event import AgentEvent
from app.models.capability import AgentCapability
from app.models.credential import AgentCredential
from app.models.relationship import AgentRelationship
from app.schemas.agent import (
    AgentDetail,
    AgentListResponse,
    AgentSummary,
    CapabilitySchema,
    CapabilitySyncRequest,
    CapabilitySyncResponse,
    CredentialSchema,
    RelationshipSchema,
    RegisterRequest,
    RegisterResponse,
    OnboardAgentRequest,
    OnboardAgentResponse,
    KeyRotationResponse,
    KeyRevocationResponse,
    HeartbeatRequest,
    HeartbeatResponse,
    EventRequest,
    BatchEventRequest,
    EventIngestResponse,
    BatchEventIngestResponse,
    AgentEventDetail,
    AgentEventListResponse,
    ConnectionStatusResponse,
)
from app.schemas.blast_radius import BlastRadiusResponse
from app.services.blast_radius_service import calculate_blast_radius
from app.services.runtime_event_processor import RuntimeEventProcessor

router = APIRouter(prefix="/agents", tags=["agents"])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Agent Discovery, Inventory & Detail
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=AgentListResponse)
async def list_agents(
    status: Optional[str] = Query(None, description="Filter by administrative status: ACTIVE | INACTIVE | QUARANTINED"),
    trust_level: Optional[str] = Query(None, description="Filter by trust level: CRITICAL | HIGH | MEDIUM | LOW"),
    agent_type: Optional[str] = Query(None, description="Filter by agent type"),
    source: Optional[str] = Query(None, description="Filter by source: DEMO | LIVE | EXTERNAL"),
    environment: Optional[str] = Query(None, description="Filter by environment: development | testing | staging | production"),
    connection_status: Optional[str] = Query(None, description="Filter by connection status: ONLINE | STALE | OFFLINE | NEVER_CONNECTED"),
    search: Optional[str] = Query(None, description="Case-insensitive name or ID search"),
    db: AsyncSession = Depends(get_db),
) -> AgentListResponse:
    """Return registered agents with comprehensive filtering and connection status."""
    query = select(Agent).order_by(Agent.created_at.desc())

    conditions = []
    if status:
        conditions.append(Agent.status == status.upper())
    if trust_level:
        conditions.append(Agent.trust_level == trust_level.upper())
    if agent_type:
        conditions.append(Agent.agent_type == agent_type.lower())
    if source:
        conditions.append(Agent.source == source.upper())
    if environment:
        conditions.append(Agent.environment == environment.lower())
    if search:
        search_filter = or_(
            Agent.name.ilike(f"%{search}%"),
            Agent.id.ilike(f"%{search}%"),
            Agent.owner_team.ilike(f"%{search}%"),
        )
        conditions.append(search_filter)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    agents = result.scalars().all()

    now = utc_now()
    summaries: list[AgentSummary] = []

    for agent in agents:
        cap_count = (
            await db.scalar(
                select(func.count(AgentCapability.id)).where(AgentCapability.agent_id == agent.id)
            )
        ) or 0
        cred_count = (
            await db.scalar(
                select(func.count(AgentCredential.id)).where(AgentCredential.agent_id == agent.id)
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

        # Compute dynamic connection status
        conn_status, seconds_elapsed = compute_connection_status(
            last_heartbeat_at=agent.last_heartbeat_at,
            last_seen_at=agent.last_seen_at,
            now=now,
            stale_threshold_seconds=settings.HEARTBEAT_STALE_THRESHOLD_SECONDS,
            offline_threshold_seconds=settings.HEARTBEAT_OFFLINE_THRESHOLD_SECONDS,
        )

        # Apply connection_status query filter if requested
        if connection_status and conn_status != connection_status.upper():
            continue

        is_offline = conn_status in ("OFFLINE", "NEVER_CONNECTED")

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
                connection_status=conn_status,
                framework=agent.framework or "custom",
                environment=agent.environment or "development",
                deployment_location=agent.deployment_location,
                tags=agent.tags or [],
                sdk_version=agent.sdk_version,
                last_heartbeat_at=agent.last_heartbeat_at,
                total_events_count=agent.total_events_count or 0,
                recent_errors_count=agent.recent_errors_count or 0,
                seconds_since_last_contact=seconds_elapsed,
            )
        )

    return AgentListResponse(agents=summaries, total=len(summaries))


@router.get("/{agent_id}", response_model=AgentDetail)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)) -> AgentDetail:
    """Return full agent details including capabilities, credentials, and connection health."""
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
            select(AgentRelationship).where(AgentRelationship.source_agent_id == agent_id)
        )
    ).scalars().all()

    incoming = (
        await db.execute(
            select(AgentRelationship).where(AgentRelationship.target_agent_id == agent_id)
        )
    ).scalars().all()

    now = utc_now()
    conn_status, seconds_elapsed = compute_connection_status(
        last_heartbeat_at=agent.last_heartbeat_at,
        last_seen_at=agent.last_seen_at,
        now=now,
    )
    is_offline = conn_status in ("OFFLINE", "NEVER_CONNECTED")

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
        connection_status=conn_status,
        framework=agent.framework or "custom",
        environment=agent.environment or "development",
        deployment_location=agent.deployment_location,
        tags=agent.tags or [],
        sdk_version=agent.sdk_version,
        api_key_status=agent.api_key_status or "ACTIVE",
        api_key_created_at=agent.api_key_created_at,
        api_key_revoked_at=agent.api_key_revoked_at,
        heartbeat_interval_seconds=agent.heartbeat_interval_seconds or 30,
        last_heartbeat_at=agent.last_heartbeat_at,
        total_events_count=agent.total_events_count or 0,
        recent_errors_count=agent.recent_errors_count or 0,
        seconds_since_last_contact=seconds_elapsed,
    )


@router.get("/{agent_id}/connection-status", response_model=ConnectionStatusResponse)
async def get_agent_connection_status(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> ConnectionStatusResponse:
    """Return real-time connection health, heartbeat status, and contact telemetry."""
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    conn_status, seconds_elapsed = compute_connection_status(
        last_heartbeat_at=agent.last_heartbeat_at,
        last_seen_at=agent.last_seen_at,
    )

    return ConnectionStatusResponse(
        agent_id=agent.id,
        agent_name=agent.name,
        connection_status=conn_status,
        administrative_status=agent.status,
        last_heartbeat_at=agent.last_heartbeat_at,
        last_seen_at=agent.last_seen_at,
        seconds_since_last_contact=seconds_elapsed,
        heartbeat_interval_seconds=agent.heartbeat_interval_seconds or settings.DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
        stale_threshold_seconds=settings.HEARTBEAT_STALE_THRESHOLD_SECONDS,
        offline_threshold_seconds=settings.HEARTBEAT_OFFLINE_THRESHOLD_SECONDS,
        total_events=agent.total_events_count or 0,
        recent_errors=agent.recent_errors_count or 0,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. External Agent Onboarding & Integration Management
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/onboard", response_model=OnboardAgentResponse)
async def onboard_external_agent(
    req: OnboardAgentRequest,
    _authorized: bool = Depends(get_operator_access),
    db: AsyncSession = Depends(get_db),
) -> OnboardAgentResponse:
    """
    Operator administrative onboarding of an external AI agent.
    Generates a secure API key, stores only its SHA-256 hash, and returns
    the plaintext key exactly ONCE for integration configuration.
    """
    raw_api_key = secrets.token_urlsafe(32)
    hashed_key = hash_api_key(raw_api_key)
    now = utc_now()

    # Conservative initial trust enforcement: default to LOW unless valid operator specification
    trust_tier = req.initial_trust_level.upper() if req.initial_trust_level else "LOW"
    if trust_tier not in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        trust_tier = "LOW"

    # Self-registered external agents cannot default to CRITICAL without explicit operator verification
    if trust_tier == "CRITICAL":
        trust_tier = "HIGH"

    new_agent = Agent(
        name=req.name.strip(),
        description=req.description.strip(),
        agent_type=req.agent_type.lower(),
        framework=req.framework or "custom",
        owner_team=req.owner_team.strip(),
        environment=req.environment.lower() if req.environment else "development",
        deployment_location=req.deployment_location,
        tags=req.tags or [],
        status=STATUS_ACTIVE,
        trust_level=trust_tier,
        source="EXTERNAL",
        discovery_method="ONBOARDED",
        confidence="SELF_REPORTED",
        api_key_hash=hashed_key,
        api_key_status=KEY_STATUS_ACTIVE,
        api_key_created_at=now,
        heartbeat_interval_seconds=settings.DEFAULT_HEARTBEAT_INTERVAL_SECONDS,
        total_events_count=0,
        recent_errors_count=0,
    )
    db.add(new_agent)
    await db.flush()

    # Register initial capabilities if provided
    if req.capabilities:
        for cap in req.capabilities:
            perm = (cap.permission or cap.permission_level or "READ").upper()
            resource = cap.resource_type.upper() if cap.resource_type else "API"
            db.add(
                AgentCapability(
                    agent_id=new_agent.id,
                    capability_name=cap.name.strip(),
                    resource_type=resource,
                    permission_level=perm,
                    is_sensitive=cap.is_sensitive,
                    description=cap.description or "",
                    provenance=PROVENANCE_SELF_REPORTED,
                    call_count=0,
                )
            )

    await db.commit()
    await db.refresh(new_agent)

    return OnboardAgentResponse(
        agent_id=new_agent.id,
        name=new_agent.name,
        api_key=raw_api_key,  # Returned only once!
        api_key_status=new_agent.api_key_status,
        api_key_created_at=new_agent.api_key_created_at,
        environment=new_agent.environment,
        framework=new_agent.framework,
        trust_level=new_agent.trust_level,
        heartbeat_interval_seconds=new_agent.heartbeat_interval_seconds,
        endpoint=f"/api/v1/agents/{new_agent.id}",
    )


@router.post("/register", response_model=RegisterResponse)
async def register_agent(
    req: RegisterRequest, db: AsyncSession = Depends(get_db)
) -> RegisterResponse:
    """Legacy/compat self-registration endpoint."""
    raw_api_key = secrets.token_urlsafe(32)
    hashed_key = hash_api_key(raw_api_key)
    now = utc_now()

    new_agent = Agent(
        name=req.name,
        agent_type=req.agent_type,
        description=req.description,
        owner_team=req.owner_team,
        trust_level="LOW",  # conservative initial trust
        framework=req.framework or "custom",
        environment=req.environment or "development",
        status=STATUS_ACTIVE,
        source="LIVE",
        discovery_method="SELF_REPORTED",
        confidence="SELF_REPORTED",
        api_key_hash=hashed_key,
        api_key_status=KEY_STATUS_ACTIVE,
        api_key_created_at=now,
        last_seen_at=now,
    )
    db.add(new_agent)
    await db.flush()

    if req.capabilities:
        for cap in req.capabilities:
            perm = cap.get("permission") or cap.get("permission_level") or "EXECUTE"
            db.add(
                AgentCapability(
                    agent_id=new_agent.id,
                    capability_name=cap.get("name", "Unknown"),
                    resource_type=cap.get("resource_type", "API").upper(),
                    permission_level=perm.upper(),
                    is_sensitive=cap.get("is_sensitive", False),
                    description=cap.get("description", ""),
                    provenance=PROVENANCE_SELF_REPORTED,
                )
            )

    await db.commit()
    return RegisterResponse(agent_id=new_agent.id, api_key=raw_api_key)


@router.post("/{agent_id}/rotate-key", response_model=KeyRotationResponse)
async def rotate_agent_api_key(
    agent_id: str,
    _authorized: bool = Depends(get_operator_access),
    db: AsyncSession = Depends(get_db),
) -> KeyRotationResponse:
    """Rotates an external agent's integration key, returning a new plaintext token once."""
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    new_raw_key = secrets.token_urlsafe(32)
    new_hashed_key = hash_api_key(new_raw_key)
    now = utc_now()

    agent.api_key_hash = new_hashed_key
    agent.api_key_status = KEY_STATUS_ROTATED
    agent.api_key_created_at = now
    agent.api_key_revoked_at = None

    await db.commit()

    return KeyRotationResponse(
        agent_id=agent.id,
        new_api_key=new_raw_key,
        api_key_status=agent.api_key_status,
        rotated_at=now,
    )


@router.post("/{agent_id}/revoke-key", response_model=KeyRevocationResponse)
async def revoke_agent_api_key(
    agent_id: str,
    _authorized: bool = Depends(get_operator_access),
    db: AsyncSession = Depends(get_db),
) -> KeyRevocationResponse:
    """Revokes an agent's API key. Blocked keys immediately fail authentication."""
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    now = utc_now()
    agent.api_key_status = KEY_STATUS_REVOKED
    agent.api_key_revoked_at = now

    await db.commit()

    return KeyRevocationResponse(
        agent_id=agent.id,
        api_key_status=agent.api_key_status,
        revoked_at=now,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. Capability Synchronization
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{agent_id}/capabilities/sync", response_model=CapabilitySyncResponse)
async def sync_capabilities(
    agent_id: str,
    req: CapabilitySyncRequest,
    authenticated_agent: Agent = Depends(get_api_key_agent),
    db: AsyncSession = Depends(get_db),
) -> CapabilitySyncResponse:
    """
    Authenticated capability synchronization endpoint for external agents.
    Performs idempotent creation and updates, protecting operator-verified capabilities.
    """
    if authenticated_agent.id != agent_id:
        raise HTTPException(status_code=403, detail="API Key does not match agent_id")

    existing_caps_res = await db.execute(
        select(AgentCapability).where(AgentCapability.agent_id == agent_id)
    )
    existing_caps = {c.capability_name.lower(): c for c in existing_caps_res.scalars().all()}

    created_count = 0
    updated_count = 0

    for cap_in in req.capabilities:
        perm = (cap_in.permission or cap_in.permission_level or "READ").upper()
        res_type = cap_in.resource_type.upper() if cap_in.resource_type else "API"
        cap_key = cap_in.name.strip().lower()

        if cap_key in existing_caps:
            existing = existing_caps[cap_key]
            # Protect verified capabilities from external agent modification
            if getattr(existing, "provenance", "SELF_REPORTED") != PROVENANCE_VERIFIED:
                existing.resource_type = res_type
                existing.permission_level = perm
                existing.is_sensitive = cap_in.is_sensitive
                if cap_in.description:
                    existing.description = cap_in.description
                existing.provenance = PROVENANCE_SELF_REPORTED
                updated_count += 1
        else:
            new_cap = AgentCapability(
                agent_id=agent_id,
                capability_name=cap_in.name.strip(),
                resource_type=res_type,
                permission_level=perm,
                is_sensitive=cap_in.is_sensitive,
                description=cap_in.description or "",
                provenance=PROVENANCE_SELF_REPORTED,
                call_count=0,
            )
            db.add(new_cap)
            created_count += 1

    await db.commit()

    all_caps_res = await db.execute(
        select(AgentCapability).where(AgentCapability.agent_id == agent_id)
    )
    all_caps = all_caps_res.scalars().all()

    return CapabilitySyncResponse(
        synced_count=len(req.capabilities),
        created_count=created_count,
        updated_count=updated_count,
        capabilities=[CapabilitySchema.model_validate(c) for c in all_caps],
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. Agent Heartbeat & Telemetry Ingestion
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{agent_id}/heartbeat", response_model=HeartbeatResponse)
async def agent_heartbeat(
    agent_id: str,
    req: HeartbeatRequest,
    authenticated_agent: Agent = Depends(get_api_key_agent),
    db: AsyncSession = Depends(get_db),
) -> HeartbeatResponse:
    """Authenticated periodic heartbeat from an external agent."""
    if authenticated_agent.id != agent_id:
        raise HTTPException(status_code=403, detail="API Key does not match agent_id")

    now = utc_now()
    authenticated_agent.last_seen_at = now
    authenticated_agent.last_heartbeat_at = now

    if req.status:
        # Keep administrative quarantine or inactive states if operator set them
        if authenticated_agent.status != STATUS_QUARANTINED:
            authenticated_agent.status = req.status.upper()

    if req.sdk_version:
        authenticated_agent.sdk_version = req.sdk_version

    await db.commit()

    conn_status, _ = compute_connection_status(
        last_heartbeat_at=authenticated_agent.last_heartbeat_at,
        last_seen_at=authenticated_agent.last_seen_at,
        now=now,
    )

    return HeartbeatResponse(
        status="ok",
        acknowledged_at=now,
        connection_status=conn_status,
    )


@router.post("/{agent_id}/events", response_model=EventIngestResponse)
async def ingest_agent_event(
    agent_id: str,
    req: EventRequest,
    authenticated_agent: Agent = Depends(get_api_key_agent),
    db: AsyncSession = Depends(get_db),
) -> EventIngestResponse:
    """
    Ingests a single runtime telemetry event through the generic RuntimeEventProcessor.
    Evaluates rule-based security violations without fabricating simulated attack records.
    """
    if authenticated_agent.id != agent_id:
        raise HTTPException(status_code=403, detail="API Key does not match agent_id")

    # Enforce reasonable payload size limit
    if req.payload and len(req.payload.encode("utf-8")) > settings.MAX_PAYLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Event payload exceeds maximum allowed size")

    processor = RuntimeEventProcessor(db)
    event, finding = await processor.process_event(authenticated_agent, req)

    await db.commit()

    return EventIngestResponse(
        status="ok",
        event_id=event.id,
        detection_triggered=finding is not None,
        finding_id=finding.id if finding else None,
    )


@router.post("/{agent_id}/events/batch", response_model=BatchEventIngestResponse)
async def ingest_agent_events_batch(
    agent_id: str,
    batch_req: BatchEventRequest,
    authenticated_agent: Agent = Depends(get_api_key_agent),
    db: AsyncSession = Depends(get_db),
) -> BatchEventIngestResponse:
    """Ingests a bounded batch of telemetry events with deduplication and security processing."""
    if authenticated_agent.id != agent_id:
        raise HTTPException(status_code=403, detail="API Key does not match agent_id")

    if len(batch_req.events) > settings.MAX_EVENT_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Batch size exceeds maximum limit of {settings.MAX_EVENT_BATCH_SIZE} events",
        )

    processor = RuntimeEventProcessor(db)
    processed_count = 0
    detections_count = 0
    event_ids = []

    for ev_req in batch_req.events:
        if ev_req.payload and len(ev_req.payload.encode("utf-8")) > settings.MAX_PAYLOAD_SIZE_BYTES:
            continue
        event, finding = await processor.process_event(authenticated_agent, ev_req)
        processed_count += 1
        event_ids.append(event.id)
        if finding:
            detections_count += 1

    await db.commit()

    return BatchEventIngestResponse(
        status="ok",
        processed_count=processed_count,
        deduplicated_count=len(batch_req.events) - processed_count,
        detections_count=detections_count,
        event_ids=event_ids,
    )


@router.get("/{agent_id}/events", response_model=AgentEventListResponse)
async def list_agent_events(
    agent_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    event_type: Optional[str] = Query(None),
    tool: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> AgentEventListResponse:
    """Returns paginated runtime event activity with search and filtering for the activity timeline."""
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    query = select(AgentEvent).where(AgentEvent.agent_id == agent_id)

    if event_type:
        query = query.where(AgentEvent.event_type == event_type)
    if tool:
        query = query.where(AgentEvent.tool.ilike(f"%{tool}%"))
    if status:
        query = query.where(AgentEvent.status == status.upper())
    if search:
        query = query.where(
            or_(
                AgentEvent.action.ilike(f"%{search}%"),
                AgentEvent.tool.ilike(f"%{search}%"),
                AgentEvent.payload.ilike(f"%{search}%"),
                AgentEvent.trace_id.ilike(f"%{search}%"),
            )
        )

    # Count total
    total = (
        await db.scalar(
            select(func.count(AgentEvent.id)).where(AgentEvent.agent_id == agent_id)
        )
    ) or 0

    # Paginated query
    query = query.order_by(AgentEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    events = (await db.execute(query)).scalars().all()

    return AgentEventListResponse(
        events=[AgentEventDetail.model_validate(e) for e in events],
        total=total,
        page=page,
        page_size=page_size,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. Blast Radius, Capabilities & Relationships
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{agent_id}/blast-radius", response_model=BlastRadiusResponse)
async def get_blast_radius(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> BlastRadiusResponse:
    """Compute the blast-radius assessment including observed inter-agent links."""
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    try:
        return await calculate_blast_radius(agent_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{agent_id}/capabilities", response_model=List[CapabilitySchema])
async def list_agent_capabilities(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> List[CapabilitySchema]:
    agent = await db.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")

    caps = (
        await db.execute(
            select(AgentCapability).where(AgentCapability.agent_id == agent_id)
        )
    ).scalars().all()
    return [CapabilitySchema.model_validate(c) for c in caps]


@router.get("/{agent_id}/relationships", response_model=List[RelationshipSchema])
async def list_agent_relationships(
    agent_id: str, db: AsyncSession = Depends(get_db)
) -> List[RelationshipSchema]:
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

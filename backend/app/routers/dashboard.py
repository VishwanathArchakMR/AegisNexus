from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.agent_status import compute_connection_status, CONNECTION_ONLINE, CONNECTION_STALE, CONNECTION_OFFLINE
from app.core.time import utc_now
from app.dependencies import get_db
from app.models.agent import Agent
from app.models.agent_event import AgentEvent
from app.models.capability import AgentCapability
from app.models.relationship import AgentRelationship
from app.models.simulation import AttackExecution
from app.models.finding import AgentFinding
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
) -> DashboardSummary:
    """
    Return aggregated platform metrics for the executive dashboard,
    including connection health, adversarial testing, and runtime detections.
    """
    agents_res = await db.execute(select(Agent))
    agents = agents_res.scalars().all()

    total_agents = len(agents)
    active_agents = sum(1 for a in agents if a.status == "ACTIVE")
    inactive_agents = sum(1 for a in agents if a.status == "INACTIVE")
    quarantined_agents = sum(1 for a in agents if a.status == "QUARANTINED")
    critical_trust = sum(1 for a in agents if a.trust_level == "CRITICAL")
    high_trust = sum(1 for a in agents if a.trust_level == "HIGH")

    # Connection status metrics
    now = utc_now()
    online_count = 0
    stale_count = 0
    offline_count = 0

    for a in agents:
        conn_status, _ = compute_connection_status(
            last_heartbeat_at=a.last_heartbeat_at,
            last_seen_at=a.last_seen_at,
            now=now,
        )
        if conn_status == CONNECTION_ONLINE:
            online_count += 1
        elif conn_status == CONNECTION_STALE:
            stale_count += 1
        else:
            offline_count += 1

    total_capabilities = (await db.scalar(select(func.count(AgentCapability.id)))) or 0
    sensitive_capabilities = (
        await db.scalar(
            select(func.count(AgentCapability.id)).where(
                AgentCapability.is_sensitive == True  # noqa: E712
            )
        )
    ) or 0
    total_relationships = (await db.scalar(select(func.count(AgentRelationship.id)))) or 0

    total_simulations = (await db.scalar(select(func.count(AttackExecution.id)))) or 0
    completed_simulations = (
        await db.scalar(
            select(func.count(AttackExecution.id)).where(AttackExecution.status == "COMPLETED")
        )
    ) or 0

    average_asr = 0.0
    if completed_simulations > 0:
        avg = await db.scalar(
            select(func.avg(AttackExecution.attack_success_rate)).where(AttackExecution.status == "COMPLETED")
        )
        if avg is not None:
            average_asr = float(avg)

    open_findings = (
        await db.scalar(select(func.count(AgentFinding.id)).where(AgentFinding.status == "OPEN"))
    ) or 0
    critical_findings = (
        await db.scalar(
            select(func.count(AgentFinding.id)).where(
                AgentFinding.status == "OPEN", AgentFinding.severity == "CRITICAL"
            )
        )
    ) or 0

    runtime_findings = (
        await db.scalar(
            select(func.count(AgentFinding.id)).where(
                AgentFinding.status == "OPEN",
                AgentFinding.source_type == "RUNTIME_DETECTION",
            )
        )
    ) or 0

    total_runtime_events = (await db.scalar(select(func.count(AgentEvent.id)))) or 0
    agents_requiring_attention = critical_trust + quarantined_agents

    # Posture Score calculation
    if total_agents > 0 and total_capabilities > 0:
        sensitive_ratio = sensitive_capabilities / total_capabilities
        trust_ratio = (critical_trust + high_trust) / total_agents
        posture_score = max(10, int(100 - (sensitive_ratio * 35) - (trust_ratio * 25)))

        # Penalties for measured vulnerabilities and critical findings
        if total_simulations > 0 or runtime_findings > 0:
            if average_asr > 0.0:
                # If average_asr is formatted as percentage 0-100 or ratio 0-1, handle properly
                asr_ratio = average_asr / 100.0 if average_asr > 1.0 else average_asr
                posture_score = max(5, int(posture_score - (asr_ratio * 50)))
            if critical_findings > 0:
                posture_score = max(5, posture_score - (critical_findings * 5))
            if runtime_findings > 0:
                posture_score = max(5, posture_score - (runtime_findings * 3))

            posture_label = "MEASURED"
            posture_status = (
                f"Score adjusted based on {completed_simulations} simulation(s), "
                f"{runtime_findings} runtime violation(s), and {open_findings} open finding(s)."
            )
        else:
            posture_label = "PRELIMINARY"
            posture_status = "Attack testing not yet performed — score based on capability exposure only."
    else:
        posture_score = 100
        posture_label = "PRELIMINARY"
        posture_status = "No agents registered."

    return DashboardSummary(
        total_agents=total_agents,
        active_agents=active_agents,
        inactive_agents=inactive_agents,
        quarantined_agents=quarantined_agents,
        critical_trust_agents=critical_trust,
        high_trust_agents=high_trust,
        total_capabilities=total_capabilities,
        sensitive_capabilities=sensitive_capabilities,
        total_relationships=total_relationships,
        agents_requiring_attention=agents_requiring_attention,
        online_agents=online_count,
        stale_agents=stale_count,
        offline_agents=offline_count,
        total_simulations=total_simulations,
        completed_simulations=completed_simulations,
        average_asr=average_asr,
        open_findings=open_findings,
        critical_findings=critical_findings,
        runtime_findings=runtime_findings,
        total_runtime_events=total_runtime_events,
        posture_score=posture_score,
        posture_label=posture_label,
        posture_status=posture_status,
    )

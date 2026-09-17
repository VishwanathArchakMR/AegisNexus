from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.agent import Agent
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
    Return aggregated platform metrics for the executive dashboard.

    Posture score is a PRELIMINARY deterministic calculation based on
    capability exposure and trust levels. It will be replaced by the
    full risk scoring engine in Phase 4.
    """
    total_agents = (await db.scalar(select(func.count(Agent.id)))) or 0
    active_agents = (
        await db.scalar(
            select(func.count(Agent.id)).where(Agent.status == "ACTIVE")
        )
    ) or 0
    inactive_agents = (
        await db.scalar(
            select(func.count(Agent.id)).where(Agent.status == "INACTIVE")
        )
    ) or 0
    quarantined_agents = (
        await db.scalar(
            select(func.count(Agent.id)).where(Agent.status == "QUARANTINED")
        )
    ) or 0
    critical_trust = (
        await db.scalar(
            select(func.count(Agent.id)).where(Agent.trust_level == "CRITICAL")
        )
    ) or 0
    high_trust = (
        await db.scalar(
            select(func.count(Agent.id)).where(Agent.trust_level == "HIGH")
        )
    ) or 0
    total_capabilities = (
        await db.scalar(select(func.count(AgentCapability.id)))
    ) or 0
    sensitive_capabilities = (
        await db.scalar(
            select(func.count(AgentCapability.id)).where(
                AgentCapability.is_sensitive == True  # noqa: E712
            )
        )
    ) or 0
    total_relationships = (
        await db.scalar(select(func.count(AgentRelationship.id)))
    ) or 0

    total_simulations = (
        await db.scalar(select(func.count(AttackExecution.id)))
    ) or 0
    completed_simulations = (
        await db.scalar(select(func.count(AttackExecution.id)).where(AttackExecution.status == "COMPLETED"))
    ) or 0
    
    # Calculate average ASR for completed executions
    average_asr = 0.0
    if completed_simulations > 0:
        avg = await db.scalar(select(func.avg(AttackExecution.attack_success_rate)).where(AttackExecution.status == "COMPLETED"))
        if avg is not None:
            average_asr = float(avg)

    open_findings = (
        await db.scalar(select(func.count(AgentFinding.id)).where(AgentFinding.status == "OPEN"))
    ) or 0
    critical_findings = (
        await db.scalar(select(func.count(AgentFinding.id)).where(AgentFinding.status == "OPEN", AgentFinding.severity == "CRITICAL"))
    ) or 0

    agents_requiring_attention = critical_trust + quarantined_agents

    # Preliminary posture score: 100 minus exposure penalties.
    # Deduct points for sensitive capability ratio and high-trust agent ratio.
    # Range: 0–100. Update if simulations have run.
    if total_agents > 0 and total_capabilities > 0:
        sensitive_ratio = sensitive_capabilities / total_capabilities
        trust_ratio = (critical_trust + high_trust) / total_agents
        posture_score = max(10, int(100 - (sensitive_ratio * 35) - (trust_ratio * 25)))
        
        # Apply penalties for actual vulnerabilities if simulations ran
        if total_simulations > 0:
            if average_asr > 0.0:
                posture_score = max(5, int(posture_score - (average_asr * 50)))
            if critical_findings > 0:
                posture_score = max(5, posture_score - (critical_findings * 5))
            
            posture_label = "MEASURED"
            posture_status = f"Score adjusted based on {completed_simulations} simulation(s) and {open_findings} open finding(s)."
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
        total_simulations=total_simulations,
        completed_simulations=completed_simulations,
        average_asr=average_asr,
        open_findings=open_findings,
        critical_findings=critical_findings,
        posture_score=posture_score,
        posture_label=posture_label,
        posture_status=posture_status,
    )

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total_agents: int
    active_agents: int
    inactive_agents: int
    quarantined_agents: int
    critical_trust_agents: int
    high_trust_agents: int
    total_capabilities: int
    sensitive_capabilities: int
    total_relationships: int
    agents_requiring_attention: int
    
    # Simulation & Findings Metrics
    total_simulations: int
    completed_simulations: int
    average_asr: float
    open_findings: int
    critical_findings: int

    # Deterministic placeholder until the risk engine is implemented in Phase 4.
    posture_score: int
    posture_label: str
    posture_status: str

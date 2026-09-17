from typing import Optional
from pydantic import BaseModel


class GraphNode(BaseModel):
    """A single agent node in the blast-radius graph."""
    id: str
    label: str
    agent_type: str
    trust_level: str
    status: str
    is_root: bool = False
    sensitive_capability_count: int = 0
    # Depth from the root agent in the BFS traversal.
    # -1 = upstream (feeds INTO root), 0 = root, 1+ = downstream.
    depth: int = 0


class GraphEdge(BaseModel):
    """A directed relationship edge between two agents."""
    id: str
    source: str
    target: str
    relationship_type: str
    trust_direction: str
    description: Optional[str] = None


class BlastRadiusSummary(BaseModel):
    """Aggregated blast-radius metrics for the root agent."""
    direct_connections: int
    downstream_agents: int
    sensitive_capabilities: int
    total_capabilities: int
    propagation_depth: int
    # CRITICAL | HIGH | MEDIUM | LOW
    potential_impact: str
    # Human-readable explanatory factors (max 10)
    impact_factors: list[str]


class BlastRadiusResponse(BaseModel):
    """
    Complete blast-radius assessment for one agent.

    This is a PRELIMINARY deterministic assessment, not a validated
    risk model.  The potential_impact classification will be enriched
    by the attack-engine results in Phase 3.
    """
    root_agent_id: str
    root_agent_name: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    summary: BlastRadiusSummary

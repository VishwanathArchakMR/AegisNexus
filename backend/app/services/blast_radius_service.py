"""
Blast Radius Service
====================
Computes the blast-radius graph and impact assessment for a given root agent.

Blast radius answers: "If this agent is compromised, what is the scope of damage?"

Algorithm
---------
1. BFS from root following OUTGOING relationships → reachable agents (downstream).
2. Collect INCOMING relationships to show who can reach / influence the root.
3. Classify potential impact from sensitive capabilities + downstream reach.
4. Return a graph (nodes + edges) suitable for React-Flow visualisation plus an
   explainable summary.

This is a PRELIMINARY deterministic assessment.  Impact classification will be
calibrated against actual attack-simulation results in Phase 3.
"""
from __future__ import annotations

import logging
from collections import deque

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import Agent
from app.models.capability import AgentCapability
from app.models.relationship import AgentRelationship
from app.schemas.blast_radius import (
    BlastRadiusResponse,
    BlastRadiusSummary,
    GraphEdge,
    GraphNode,
)

logger = logging.getLogger(__name__)

# Resource types considered sensitive for impact scoring
_SENSITIVE_RESOURCE_TYPES = frozenset({"PAYMENT", "EMAIL", "DATABASE", "API", "FILE", "AGENT_COMMS"})

# Weight map: permission level → severity score (0–4)
_PERMISSION_WEIGHT: dict[str, int] = {
    "READ": 1,
    "WRITE": 2,
    "EXECUTE": 3,
    "ADMIN": 4,
}

# Trust-level weight for downstream agents
_TRUST_WEIGHT: dict[str, int] = {
    "CRITICAL": 4,
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1,
}


def derive_capability_risk_families(cap: AgentCapability) -> set[str]:
    """
    Map a capability to SoK risk families.
    
    Risk families are from the SoK paper (https://arxiv.org/abs/2407.16223 or similar standard).
    NOTE: The assignment rules below are project-specific AegisNexus judgment calls 
    and are open to revision. They are not specified by the paper itself.
    """
    families = set()
    
    # R5 cross-principal confidentiality breach
    if cap.permission_level == "READ" and cap.is_sensitive:
        families.add("R5 cross-principal confidentiality breach")
        
    # R4 trajectory/goal integrity failure
    if cap.permission_level in ("WRITE", "EXECUTE"):
        families.add("R4 trajectory/goal integrity failure")
        
    # R1 containment failure
    if cap.permission_level == "ADMIN":
        families.add("R1 containment failure")
        
    # R3 collective-decision integrity failure
    if cap.resource_type == "AGENT_COMMS":
        families.add("R3 collective-decision integrity failure")
        
    # R7 availability/resource-isolation failure
    if cap.resource_type in ("DATABASE", "API", "PAYMENT"):
        families.add("R7 availability/resource-isolation failure")
        
    return families

def derive_severity_from_families(families: set[str]) -> str:
    """Derive severity purely from the presence of specific risk families."""
    if "R1 containment failure" in families or "R6 transitive authorization failure" in families:
        return "CRITICAL"
    if "R2 loss of independence" in families or "R4 trajectory/goal integrity failure" in families:
        return "HIGH"
    if "R3 collective-decision integrity failure" in families or "R5 cross-principal confidentiality breach" in families or "R7 availability/resource-isolation failure" in families:
        return "MEDIUM"
    return "LOW"

async def calculate_blast_radius(
    root_agent_id: str,
    db: AsyncSession,
) -> BlastRadiusResponse:
    """
    Main entrypoint.  Raises ValueError if the agent is not found.
    """
    root_agent = await db.get(Agent, root_agent_id)
    if root_agent is None:
        raise ValueError(f"Agent '{root_agent_id}' not found")

    logger.info("Calculating blast radius for agent '%s'", root_agent.name)

    # ── 1. Root agent capabilities ────────────────────────────────────────
    caps_result = await db.execute(
        select(AgentCapability).where(AgentCapability.agent_id == root_agent_id)
    )
    root_caps = caps_result.scalars().all()
    sensitive_caps = [c for c in root_caps if c.is_sensitive]

    # ── 2. BFS outgoing: find all downstream-reachable agents ─────────────
    visited: set[str] = {root_agent_id}
    bfs_queue: deque[tuple[str, int]] = deque([(root_agent_id, 0)])
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    seen_edge_ids: set[str] = set()
    max_depth = 0
    direct_connections: set[str] = set()

    # Root node
    nodes.append(
        GraphNode(
            id=root_agent.id,
            label=root_agent.name,
            agent_type=root_agent.agent_type,
            trust_level=root_agent.trust_level,
            status=root_agent.status,
            is_root=True,
            sensitive_capability_count=len(sensitive_caps),
            depth=0,
        )
    )

    while bfs_queue:
        current_id, current_depth = bfs_queue.popleft()

        rels_result = await db.execute(
            select(AgentRelationship).where(
                AgentRelationship.source_agent_id == current_id
            )
        )
        for rel in rels_result.scalars():
            target_id = rel.target_agent_id

            # Track direct connections from root
            if current_id == root_agent_id:
                direct_connections.add(target_id)

            # Add edge (avoid duplicates in cyclic graphs)
            edge_key = f"{rel.source_agent_id}→{rel.target_agent_id}"
            if edge_key not in seen_edge_ids:
                seen_edge_ids.add(edge_key)
                edges.append(
                    GraphEdge(
                        id=rel.id,
                        source=rel.source_agent_id,
                        target=rel.target_agent_id,
                        relationship_type=rel.relationship_type,
                        trust_direction=rel.trust_direction,
                        description=rel.description,
                    )
                )

            # Enqueue new agents
            if target_id not in visited:
                visited.add(target_id)
                new_depth = current_depth + 1
                max_depth = max(max_depth, new_depth)
                bfs_queue.append((target_id, new_depth))

                target = await db.get(Agent, target_id)
                if target:
                    target_sens_count = (
                        await db.scalar(
                            select(func.count(AgentCapability.id)).where(
                                and_(
                                    AgentCapability.agent_id == target_id,
                                    AgentCapability.is_sensitive == True,  # noqa: E712
                                )
                            )
                        )
                    ) or 0

                    nodes.append(
                        GraphNode(
                            id=target.id,
                            label=target.name,
                            agent_type=target.agent_type,
                            trust_level=target.trust_level,
                            status=target.status,
                            is_root=False,
                            sensitive_capability_count=target_sens_count,
                            depth=new_depth,
                        )
                    )

    # ── 3. Incoming: agents that can directly reach the root ──────────────
    incoming_result = await db.execute(
        select(AgentRelationship).where(
            AgentRelationship.target_agent_id == root_agent_id
        )
    )
    for rel in incoming_result.scalars():
        src_id = rel.source_agent_id

        # Add edge if not already present
        edge_key = f"{src_id}→{rel.target_agent_id}"
        if edge_key not in seen_edge_ids:
            seen_edge_ids.add(edge_key)
            edges.append(
                GraphEdge(
                    id=f"in-{rel.id}",
                    source=src_id,
                    target=rel.target_agent_id,
                    relationship_type=rel.relationship_type,
                    trust_direction=rel.trust_direction,
                    description=rel.description,
                )
            )

        # Add upstream node (depth = -1) if not already in graph
        if src_id not in visited:
            visited.add(src_id)
            src_agent = await db.get(Agent, src_id)
            if src_agent:
                nodes.append(
                    GraphNode(
                        id=src_agent.id,
                        label=src_agent.name,
                        agent_type=src_agent.agent_type,
                        trust_level=src_agent.trust_level,
                        status=src_agent.status,
                        is_root=False,
                        sensitive_capability_count=0,
                        depth=-1,  # upstream
                    )
                )

    # ── 4. Impact scoring ─────────────────────────────────────────────────
    downstream_count = len([n for n in nodes if n.depth > 0])
    direct_count = len(direct_connections)
    sens_count = len(sensitive_caps)

    impact_factors: list[str] = []

    # Map risk families for all root capabilities
    agent_families: set[str] = set()
    for cap in root_caps:
        cap_families = derive_capability_risk_families(cap)
        agent_families.update(cap_families)

    for cap in sensitive_caps:
        perm = cap.permission_level
        impact_factors.append(
            f"Sensitive: {cap.capability_name} "
            f"({cap.resource_type} · {perm})"
        )

    has_critical_downstream = False
    for node in nodes:
        if not node.is_root and node.depth > 0 and node.trust_level in ("CRITICAL", "HIGH"):
            agent_families.add("R6 transitive authorization failure")
            has_critical_downstream = True
            impact_factors.append(
                f"Reaches {node.trust_level.lower()}-trust agent: {node.label}"
            )

    if downstream_count >= 3:
        agent_families.add("R2 loss of independence")
        impact_factors.append(
            f"Wide propagation: {downstream_count} downstream agents reachable"
        )
        
    if max_depth > 1:
        impact_factors.append(
            f"Multi-hop reach: {max_depth} hops in agent graph"
        )

    potential_impact = derive_severity_from_families(agent_families)

    # Optional: Bump by one tier if root itself is CRITICAL trust and severity isn't already CRITICAL
    if root_agent.trust_level == "CRITICAL" and potential_impact == "MEDIUM":
        potential_impact = "HIGH"
    elif root_agent.trust_level == "CRITICAL" and potential_impact == "LOW":
        potential_impact = "MEDIUM"

    logger.info(
        "Blast radius for '%s': impact=%s, downstream=%d, sensitive_caps=%d",
        root_agent.name,
        potential_impact,
        downstream_count,
        sens_count,
    )

    return BlastRadiusResponse(
        root_agent_id=root_agent.id,
        root_agent_name=root_agent.name,
        nodes=nodes,
        edges=edges,
        summary=BlastRadiusSummary(
            direct_connections=direct_count,
            downstream_agents=downstream_count,
            sensitive_capabilities=sens_count,
            total_capabilities=len(root_caps),
            propagation_depth=max_depth,
            potential_impact=potential_impact,
            risk_families=sorted(list(agent_families)),
            impact_factors=impact_factors[:10],
        ),
    )

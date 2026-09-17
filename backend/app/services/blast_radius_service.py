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

    for cap in sensitive_caps:
        perm = cap.permission_level
        impact_factors.append(
            f"Sensitive: {cap.capability_name} "
            f"({cap.resource_type} · {perm})"
        )

    for node in nodes:
        if not node.is_root and node.depth > 0 and node.trust_level in ("CRITICAL", "HIGH"):
            impact_factors.append(
                f"Reaches {node.trust_level.lower()}-trust agent: {node.label}"
            )

    if downstream_count >= 3:
        impact_factors.append(
            f"Wide propagation: {downstream_count} downstream agents reachable"
        )
    if max_depth > 1:
        impact_factors.append(
            f"Multi-hop reach: {max_depth} hops in agent graph"
        )

    # Compute an additive score to pick the impact tier
    score = 0
    score += sum(
        _PERMISSION_WEIGHT.get(c.permission_level, 0) for c in sensitive_caps
    )
    for node in nodes:
        if not node.is_root and node.depth > 0:
            score += _TRUST_WEIGHT.get(node.trust_level, 0)

    has_payment = any(c.resource_type == "PAYMENT" for c in sensitive_caps)
    has_admin = any(c.permission_level == "ADMIN" for c in root_caps)
    has_critical_downstream = any(
        not n.is_root and n.depth > 0 and n.trust_level == "CRITICAL"
        for n in nodes
    )

    if has_payment or has_admin or has_critical_downstream or score >= 14:
        potential_impact = "CRITICAL"
    elif score >= 9 or (sens_count >= 3 and downstream_count >= 2):
        potential_impact = "HIGH"
    elif score >= 4 or sens_count >= 1 or downstream_count >= 1:
        potential_impact = "MEDIUM"
    else:
        potential_impact = "LOW"

    # Bump by one tier if root itself is CRITICAL trust
    if root_agent.trust_level == "CRITICAL" and potential_impact == "MEDIUM":
        potential_impact = "HIGH"

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
            impact_factors=impact_factors[:10],
        ),
    )

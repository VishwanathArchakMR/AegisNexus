import json
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utc_now
from app.models.agent import Agent
from app.models.agent_event import AgentEvent
from app.models.capability import AgentCapability
from app.models.finding import AgentFinding
from app.models.relationship import AgentRelationship
from app.schemas.agent import EventRequest
from app.services.blast_radius_service import derive_capability_risk_families, derive_severity_from_families

logger = logging.getLogger("aegisnexus.runtime_processor")

# Hierarchy of permissions for checking exceedances
PERMISSION_RANK = {
    "READ": 1,
    "WRITE": 2,
    "EXECUTE": 3,
    "ADMIN": 4,
}


class RuntimeEventProcessor:
    """
    Generic rule-driven runtime telemetry event processor.
    Evaluates observed runtime operations against declared agent security profiles,
    updates observed inter-agent relationships, and generates evidence-backed security findings
    WITHOUT fabricating simulated AttackExecution or AttackAttempt records.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_event(
        self, agent: Agent, req: EventRequest
    ) -> Tuple[AgentEvent, Optional[AgentFinding]]:
        """
        Processes a single event, updates agent telemetry, checks detection rules,
        and optionally generates an AgentFinding if a security violation is detected.
        """
        now = utc_now()
        event_time = req.timestamp or now

        # 1. Idempotency Check
        if req.event_id:
            existing_event = await self.db.scalar(
                select(AgentEvent).where(
                    and_(
                        AgentEvent.agent_id == agent.id,
                        AgentEvent.id == req.event_id,
                    )
                )
            )
            if existing_event:
                logger.info("Duplicate event ignored for agent %s: %s", agent.id, req.event_id)
                return existing_event, None

        event_id = req.event_id or str(uuid.uuid4())

        # 2. Serialize sanitized metadata
        metadata = req.metadata or {}
        # Ensure payload is sanitized string
        payload_str = req.payload
        if not payload_str and metadata:
            payload_str = json.dumps(metadata)

        # 3. Create AgentEvent entity
        event = AgentEvent(
            id=event_id,
            agent_id=agent.id,
            event_type=req.event_type,
            tool=req.tool,
            action=req.action,
            resource_type=req.resource_type,
            permission_level=req.permission_level,
            status=req.status.upper(),
            payload=payload_str,
            duration_ms=req.duration_ms,
            trace_id=req.trace_id,
            span_id=req.span_id,
            parent_span_id=req.parent_span_id,
            target_agent_id=req.target_agent_id,
            metadata_json=metadata,
            sdk_version=req.sdk_version,
            event_source="SDK",
            created_at=event_time,
            server_received_at=now,
        )
        self.db.add(event)

        # 4. Update Agent telemetry metadata
        agent.last_seen_at = now
        agent.total_events_count = (agent.total_events_count or 0) + 1
        if req.status.upper() in ("FAILURE", "ERROR", "DENIED", "BLOCKED"):
            agent.recent_errors_count = (agent.recent_errors_count or 0) + 1
        if req.sdk_version and not agent.sdk_version:
            agent.sdk_version = req.sdk_version

        await self.db.flush()

        # 5. Fetch declared agent capabilities
        caps_res = await self.db.scalars(
            select(AgentCapability).where(AgentCapability.agent_id == agent.id)
        )
        capabilities = list(caps_res.all())

        # 6. Apply Deterministic Security Detection Rules
        finding = await self._evaluate_detection_rules(agent, event, capabilities)

        # 7. Update Observed Relationships for inter-agent communication
        if req.target_agent_id:
            await self._record_observed_relationship(agent, event, req.target_agent_id)

        # 8. Update observed capability usage if authorized
        if req.action and not finding and req.status.upper() == "SUCCESS":
            await self._record_capability_observation(capabilities, req.action)

        return event, finding

    async def _evaluate_detection_rules(
        self, agent: Agent, event: AgentEvent, capabilities: List[AgentCapability]
    ) -> Optional[AgentFinding]:
        """
        Evaluates deterministic security rules without hardcoded action names.
        Returns an AgentFinding if a rule triggers, otherwise None.
        """
        action = event.action
        tool = event.tool or ""
        event_type = event.event_type
        req_perm = (event.permission_level or "READ").upper()
        resource_type = (event.resource_type or "API").upper()
        status = event.status.upper()

        # Rule 1: Unknown Target Agent Communication
        if event.target_agent_id:
            target = await self.db.scalar(
                select(Agent).where(Agent.id == event.target_agent_id)
            )
            if not target:
                return self._create_finding(
                    agent=agent,
                    event=event,
                    rule_name="UNREGISTERED_TARGET_AGENT_DELEGATION",
                    title="Suspicious Delegation to Unregistered Agent",
                    severity="HIGH",
                    description=(
                        f"Agent '{agent.name}' attempted inter-agent delegation/communication to "
                        f"an unknown or unregistered agent ID: '{event.target_agent_id}'."
                    ),
                    evidence=(
                        f"Timestamp: {event.created_at}\n"
                        f"Action: {event.action or event.event_type}\n"
                        f"Target Agent ID: {event.target_agent_id}\n"
                        f"Status: {status}\n"
                        f"Trace ID: {event.trace_id or 'N/A'}"
                    ),
                    recommendation=(
                        "Verify inter-agent routing tables and ensure all destination agents are "
                        "formally registered, authenticated, and authorized within AegisNexus."
                    ),
                )

        # Ignore generic lifecycle events from capability checks
        if event_type in ("AGENT_STARTED", "AGENT_HEARTBEAT", "AGENT_SHUTDOWN", "EXCEPTION"):
            return None

        # Rule 2: Explicit Policy Blocked / Denied Operations
        if status in ("DENIED", "BLOCKED", "POLICY_BLOCKED"):
            return self._create_finding(
                agent=agent,
                event=event,
                rule_name="POLICY_BLOCKED_TOOL_CALL",
                title=f"Policy Blocked Operation on {tool or resource_type}",
                severity="MEDIUM",
                description=(
                    f"Agent '{agent.name}' attempted an action '{action}' that was denied or blocked "
                    "by local policy or an execution guardrail."
                ),
                evidence=(
                    f"Tool: {tool}\nAction: {action}\nResource: {resource_type}\n"
                    f"Status: {status}\nTrace ID: {event.trace_id or 'N/A'}"
                ),
                recommendation=(
                    "Inspect the policy violation context and adjust agent tool bounds or investigate "
                    "potential unauthorized prompt diversion."
                ),
            )

        # If action is specified, check declared capabilities
        if action:
            # Find matching capability by name
            matching_cap = next(
                (c for c in capabilities if c.capability_name.lower() == action.lower()), None
            )

            # Rule 3: Undeclared Capability Execution
            if not matching_cap:
                # Execution of undeclared action
                severity = "HIGH"
                if resource_type in ("PAYMENT", "DATABASE") or req_perm in ("WRITE", "EXECUTE", "ADMIN"):
                    severity = "CRITICAL"

                return self._create_finding(
                    agent=agent,
                    event=event,
                    rule_name="UNDECLARED_CAPABILITY_EXECUTION",
                    title=f"Undeclared Tool Operation: {action}",
                    severity=severity,
                    description=(
                        f"Agent '{agent.name}' invoked action '{action}' on resource '{resource_type}', "
                        "which has not been registered in its declared security capabilities."
                    ),
                    evidence=(
                        f"Invoked Action: {action}\nTool: {tool}\nResource: {resource_type}\n"
                        f"Requested Permission: {req_perm}\nStatus: {status}\n"
                        f"Trace ID: {event.trace_id or 'N/A'}"
                    ),
                    recommendation=(
                        "Review agent capability profile. If legitimate, explicitly synchronize the capability "
                        "with appropriate scoping. If unauthorized, restrict agent tool bindings."
                    ),
                )

            # Rule 4: Permission Exceedance (Attempting higher permission than declared)
            declared_rank = PERMISSION_RANK.get(matching_cap.permission_level.upper(), 1)
            requested_rank = PERMISSION_RANK.get(req_perm, 1)

            if requested_rank > declared_rank:
                return self._create_finding(
                    agent=agent,
                    event=event,
                    rule_name="PERMISSION_LEVEL_EXCEEDANCE",
                    title=f"Permission Exceedance on {matching_cap.capability_name}",
                    severity="HIGH",
                    description=(
                        f"Agent '{agent.name}' attempted a {req_perm} operation on capability "
                        f"'{matching_cap.capability_name}', but is only authorized for {matching_cap.permission_level}."
                    ),
                    evidence=(
                        f"Capability: {matching_cap.capability_name}\n"
                        f"Declared Permission: {matching_cap.permission_level} (Rank {declared_rank})\n"
                        f"Observed Permission: {req_perm} (Rank {requested_rank})\n"
                        f"Tool: {tool}\nStatus: {status}\nTrace ID: {event.trace_id or 'N/A'}"
                    ),
                    recommendation=(
                        "Enforce strict least-privilege tool sandboxing. Prevent agents from executing "
                        "write/execute operations without explicit authorization."
                    ),
                )

            # Rule 5: Sensitive Resource Access on Low-Trust Agent
            if matching_cap.is_sensitive and agent.trust_level in ("LOW", "MEDIUM") and req_perm in ("WRITE", "EXECUTE", "ADMIN"):
                return self._create_finding(
                    agent=agent,
                    event=event,
                    rule_name="HIGH_RISK_SENSITIVE_RESOURCE_MODIFICATION",
                    title=f"Sensitive Resource Modification by {agent.trust_level}-Trust Agent",
                    severity="HIGH",
                    description=(
                        f"Agent '{agent.name}' with trust tier '{agent.trust_level}' performed a privileged "
                        f"{req_perm} operation on sensitive resource '{matching_cap.resource_type}'."
                    ),
                    evidence=(
                        f"Capability: {matching_cap.capability_name}\n"
                        f"Resource: {matching_cap.resource_type}\n"
                        f"Sensitivity: Sensitive\nAgent Trust Tier: {agent.trust_level}\n"
                        f"Status: {status}\nTrace ID: {event.trace_id or 'N/A'}"
                    ),
                    recommendation=(
                        "Require dual-authorization or elevate agent trust validation before allowing "
                        "sensitive write/execute operations."
                    ),
                )

        return None

    def _create_finding(
        self,
        agent: Agent,
        event: AgentEvent,
        rule_name: str,
        title: str,
        severity: str,
        description: str,
        evidence: str,
        recommendation: str,
    ) -> AgentFinding:
        """Constructs an AgentFinding linked directly to the runtime event."""
        # Derive SoK risk families
        cap_mock = AgentCapability(
            permission_level=event.permission_level or "EXECUTE",
            resource_type=event.resource_type or "API",
            is_sensitive=True if severity in ("HIGH", "CRITICAL") else False,
            capability_name=event.action or event.tool or "runtime_action",
        )
        families = derive_capability_risk_families(cap_mock)

        finding = AgentFinding(
            agent_id=agent.id,
            execution_id=None,  # NEVER fabricate AttackExecution for runtime observation!
            scenario_id=None,   # Pure runtime event finding
            source_type="RUNTIME_DETECTION",
            event_id=event.id,
            detection_rule=rule_name,
            title=title,
            description=description,
            finding_type="RUNTIME_VIOLATION",
            severity=severity,
            status="OPEN",
            evidence=evidence,
            affected_capability=event.action,
            recommendation=recommendation,
            evaluation_level="per-tool-call",
            risk_families=sorted(list(families)),
            created_at=event.created_at,
        )
        self.db.add(finding)
        logger.warning(
            "Runtime security finding generated for agent '%s': %s (Rule: %s, Severity: %s)",
            agent.name, title, rule_name, severity
        )
        return finding

    async def _record_observed_relationship(
        self, source_agent: Agent, event: AgentEvent, target_agent_id: str
    ) -> None:
        """
        Dynamically updates or creates an AgentRelationship with OBSERVED provenance.
        """
        target = await self.db.scalar(
            select(Agent).where(Agent.id == target_agent_id)
        )
        if not target or target.id == source_agent.id:
            return

        rel = await self.db.scalar(
            select(AgentRelationship).where(
                and_(
                    AgentRelationship.source_agent_id == source_agent.id,
                    AgentRelationship.target_agent_id == target_agent_id,
                )
            )
        )

        now = utc_now()
        rel_type = "DELEGATES" if event.event_type == "AGENT_DELEGATION" else "CALLS"

        if rel:
            rel.provenance = "OBSERVED"
            rel.last_interaction_at = now
            rel.interaction_count = (rel.interaction_count or 0) + 1
            rel.last_event_id = event.id
            if not rel.description or "observed" not in rel.description.lower():
                rel.description = f"Observed inter-agent telemetry interaction on action '{event.action or rel_type}'"
        else:
            new_rel = AgentRelationship(
                source_agent_id=source_agent.id,
                target_agent_id=target_agent_id,
                relationship_type=rel_type,
                trust_direction="UNIDIRECTIONAL",
                description=f"Observed runtime interaction: {source_agent.name} -> {target.name} ({event.action or rel_type})",
                provenance="OBSERVED",
                last_interaction_at=now,
                interaction_count=1,
                last_event_id=event.id,
            )
            self.db.add(new_rel)
            logger.info(
                "Discovered new runtime relationship: %s -> %s (%s)",
                source_agent.name, target.name, rel_type
            )

    async def _record_capability_observation(
        self, capabilities: List[AgentCapability], action: str
    ) -> None:
        """Updates last_observed_at timestamp and call count on matching capability."""
        matching_cap = next(
            (c for c in capabilities if c.capability_name.lower() == action.lower()), None
        )
        if matching_cap:
            matching_cap.call_count = (matching_cap.call_count or 0) + 1
            matching_cap.last_observed_at = utc_now()
            if matching_cap.provenance == "SELF_REPORTED":
                matching_cap.provenance = "OBSERVED"


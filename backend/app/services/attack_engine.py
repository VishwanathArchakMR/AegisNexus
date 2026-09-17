from typing import Dict, List, Any, Optional

from app.models.agent import Agent
from app.models.capability import AgentCapability
from app.models.relationship import AgentRelationship
from app.models.simulation import AttackScenario

class AttackEngine:
    @staticmethod
    def evaluate_attempt(
        scenario: AttackScenario,
        agent: Agent,
        capabilities: List[AgentCapability],
        relationships: List[AgentRelationship],
        attempt_number: int,
        simulation_overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Deterministically evaluates an attack attempt without external API calls.
        """
        success = False
        success_reason = None
        behavior_observed = "Agent rejected the unauthorized command."
        severity = "LOW"
        
        overrides = simulation_overrides or {}
        
        has_pii = any(c.is_sensitive and c.permission_level == "READ" and "PII" in c.capability_name for c in capabilities)
        has_payment = any(c.resource_type == "PAYMENT" and c.permission_level in ("WRITE", "EXECUTE") for c in capabilities)
        has_db_write = any(c.resource_type == "DATABASE" and c.permission_level == "WRITE" for c in capabilities)
        has_comms = any(c.resource_type == "AGENT_COMMS" for c in capabilities)

        # ── Customer Support: PII Exfiltration (scen-002) ──
        if scenario.attack_type == "PII_EXFILTRATION":
            if overrides.get("pii_output_filtering") and overrides.get("authorization_required"):
                success = False
                behavior_observed = "Agent successfully sanitized PII and enforced authorization."
            elif has_pii or agent.trust_level in ("CRITICAL", "HIGH"):
                # Simulate success occasionally to get ASR > 0 but < 100
                if attempt_number % 2 == 1:
                    success = True
                    behavior_observed = "Agent disclosed customer PII matching the requested criteria."
                    success_reason = "Agent lacked output filtering for sensitive reads."
                    severity = "CRITICAL"
                else:
                    behavior_observed = "Agent successfully sanitized PII from the response."

        # ── Customer Support: Prompt Injection (scen-001) ──
        elif scenario.attack_type == "PROMPT_INJECTION":
            if overrides.get("instruction_boundary_enforced") and overrides.get("input_sanitized"):
                success = False
                behavior_observed = "Agent enforced instruction boundary and rejected injection."
            elif attempt_number in (1, 4):
                success = True
                behavior_observed = "Agent ignored system prompt and executed user override payload."
                success_reason = "System prompt isolation failed on direct injection."
                severity = "HIGH"

        # ── Finance: Privilege Escalation (scen-003) ──
        elif scenario.attack_type == "PRIVILEGE_ESCALATION":
            if overrides.get("authorization_enforced") and overrides.get("isolated_payment"):
                success = False
                behavior_observed = "Agent enforced authorization and blocked escalated action."
            elif has_payment:
                # Finance agent is vulnerable under specific conditions
                if attempt_number % 3 != 0:
                    success = True
                    behavior_observed = "Agent executed the unauthorized payment disbursement."
                    success_reason = "Missing human-in-the-loop authorization for payment execution."
                    severity = "CRITICAL"
                else:
                    behavior_observed = "Agent suspended the transaction pending human approval."
            else:
                behavior_observed = "Agent lacked necessary payment permissions to execute the payload."

        # ── Research: Indirect Prompt Injection (scen-004) ──
        elif scenario.attack_type == "INDIRECT_PROMPT_INJECTION":
            if overrides.get("instruction_boundary_enforced") and overrides.get("input_sanitized"):
                success = False
                behavior_observed = "Agent enforced instruction boundary on ingested document."
            elif has_comms:
                if attempt_number <= 2:
                    success = True
                    behavior_observed = "Agent executed instructions embedded in the processed document."
                    success_reason = "Lack of boundary between document data and system instructions."
                    severity = "MEDIUM"
                else:
                    behavior_observed = "Agent parsed the document safely."

        # ── Ops: Tool Misuse / Record Tampering (scen-005) ──
        elif scenario.attack_type == "TOOL_MISUSE":
            if overrides.get("tool_authorization_required"):
                success = False
                behavior_observed = "Agent required authorization and blocked misuse."
            elif has_db_write:
                if attempt_number % 2 == 0:
                    success = True
                    behavior_observed = "Agent successfully modified the internal access record."
                    success_reason = "Over-permissive database write credentials allowed the payload."
                    severity = "HIGH"
                else:
                    behavior_observed = "Agent refused to execute unauthorized DML command."

        else:
            if overrides.get("generic_remediation"):
                success = False
                behavior_observed = "Agent blocked the action based on generic remediation."
            # Generic fallback deterministic logic
            elif agent.trust_level == "LOW" or attempt_number == 1:
                success = True
                behavior_observed = "Agent fell victim to the generalized payload."
                success_reason = "Generic vulnerability triggered."
                severity = scenario.severity

        # Override severity based on agent trust level for successful attacks
        if success:
            if agent.trust_level == "CRITICAL" and severity in ("LOW", "MEDIUM"):
                severity = "HIGH"
            elif agent.trust_level == "LOW" and severity == "CRITICAL":
                severity = "HIGH"

        return {
            "success": success,
            "behavior_observed": behavior_observed,
            "success_reason": success_reason,
            "severity": severity if success else scenario.severity,
            "simulated_response": f"Simulated response to {scenario.name} (Attempt {attempt_number})"
        }

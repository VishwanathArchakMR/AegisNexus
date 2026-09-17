from typing import List, Dict, Any, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.agent import Agent
from app.models.capability import AgentCapability
from app.models.finding import AgentFinding
from app.models.recovery import RecoveryRecord, RecoveryEvent
from app.models.simulation import AttackExecution, AttackScenario, AttackAttempt
from app.services.attack_engine import AttackEngine
from app.services.blast_radius_service import calculate_blast_radius


class RecoveryEngine:
    REMEDIATION_CATALOG = {
        "PII_EXFILTRATION": {
            "why": "Sensitive customer data can be disclosed because access/output controls are insufficient.",
            "action": "- enable sensitive-output filtering\n- require authorization before returning PII\n- restrict unnecessary sensitive-data access",
            "expected_result": "Unauthorized PII disclosure is blocked.",
            "verification": "Run Customer PII Exfiltration against the simulated hardened state.",
            "overrides": {
                "pii_output_filtering": True,
                "authorization_required": True
            }
        },
        "PRIVILEGE_ESCALATION": {
            "why": "The agent has excessive write/execute/admin capability or insufficient authorization.",
            "action": "- restrict WRITE/EXECUTE/ADMIN capability\n- enforce authorization\n- isolate high-impact payment operations",
            "expected_result": "Unauthorized privileged operations are blocked.",
            "verification": "Run Privilege Escalation against the simulated hardened state.",
            "overrides": {
                "authorization_enforced": True,
                "isolated_payment": True
            }
        },
        "PROMPT_INJECTION": {
            "why": "Untrusted content can influence trusted instructions.",
            "action": "- enforce instruction/data boundary\n- sanitize untrusted input\n- strengthen prompt-injection policy",
            "expected_result": "Injected instructions no longer produce unsafe behavior.",
            "verification": "Rerun the applicable injection scenario.",
            "overrides": {
                "instruction_boundary_enforced": True,
                "input_sanitized": True
            }
        },
        "TOOL_MISUSE": {
            "why": "The agent has access to dangerous tools without adequate authorization.",
            "action": "- restrict dangerous tools\n- require authorization\n- require confirmation for high-impact operations",
            "expected_result": "Unauthorized tool actions are blocked.",
            "verification": "Rerun tool misuse scenario.",
            "overrides": {
                "tool_authorization_required": True
            }
        },
        "CROSS_AGENT_PROPAGATION": {
            "why": "Delegated permissions and agent trust allow threats to propagate.",
            "action": "- reduce inter-agent trust\n- restrict delegation\n- isolate affected relationships",
            "expected_result": "Attack propagation is contained within the initial agent.",
            "verification": "Rerun blast-radius or propagation scenario.",
            "overrides": {
                "trust_isolated": True
            }
        }
    }

    GENERIC_REMEDIATION = {
        "why": "A generalized vulnerability exists that requires hardening.",
        "action": "- apply baseline hardening\n- restrict exposed capabilities\n- increase trust requirements",
        "expected_result": "The agent operates securely under baseline constraints.",
        "verification": "Rerun the original finding scenario.",
        "overrides": {
            "generic_remediation": True
        }
    }

    @staticmethod
    async def get_catalog_entry(finding_type: str) -> Dict[str, Any]:
        return RecoveryEngine.REMEDIATION_CATALOG.get(finding_type, RecoveryEngine.GENERIC_REMEDIATION)

    @staticmethod
    async def build_states(finding: AgentFinding, catalog_entry: Dict[str, Any]) -> tuple[Dict[str, Any], Dict[str, Any]]:
        # In this MVP, before_state is essentially 'overrides disabled'
        # after_state contains the applied overrides.
        before_state = {
            "controls": {}
        }
        after_state = {
            "controls": catalog_entry["overrides"]
        }
        return before_state, after_state

    @staticmethod
    async def record_event(
        session: AsyncSession,
        recovery_id: str,
        event_type: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> RecoveryEvent:
        event = RecoveryEvent(
            recovery_record_id=recovery_id,
            event_type=event_type,
            actor="Local Security Operator",
            message=message,
            metadata_json=metadata
        )
        session.add(event)
        return event

    @staticmethod
    async def create_plan(session: AsyncSession, recovery: RecoveryRecord, finding: AgentFinding) -> RecoveryRecord:
        catalog = await RecoveryEngine.get_catalog_entry(finding.finding_type)
        
        recovery.status = "PLANNED"
        recovery.remediation_type = finding.finding_type
        recovery.title = f"Remediate {finding.finding_type}"
        recovery.description = catalog["why"]
        recovery.recommended_action = catalog["action"] + f"\n\nExpected Result: {catalog['expected_result']}\nVerification: {catalog['verification']}"
        recovery.affected_capability = finding.affected_capability
        recovery.approval_status = "PENDING"
        
        # Build states
        before, after = await RecoveryEngine.build_states(finding, catalog)
        recovery.before_state = before
        recovery.after_state = after
        
        await RecoveryEngine.record_event(
            session, recovery.id, "PLAN_CREATED", "Generated deterministic remediation plan based on finding type."
        )
        
        # Store original ASR
        if finding.execution_id:
            execution = await session.get(AttackExecution, finding.execution_id)
            if execution:
                recovery.previous_asr = execution.attack_success_rate
        else:
            recovery.previous_asr = 100.0  # Fallback assumption if no execution linked
            
        return recovery

    @staticmethod
    async def approve_plan(session: AsyncSession, recovery: RecoveryRecord) -> RecoveryRecord:
        recovery.status = "APPROVED"
        recovery.approval_status = "APPROVED"
        recovery.approved_by = "Local Security Operator"
        recovery.approved_at = datetime.utcnow()
        
        await RecoveryEngine.record_event(
            session, recovery.id, "APPROVED", "Recovery plan approved for simulated execution."
        )
        return recovery

    @staticmethod
    async def execute_simulation(session: AsyncSession, recovery: RecoveryRecord) -> RecoveryRecord:
        recovery.status = "VERIFYING"
        recovery.execution_status = "SIMULATED"
        recovery.execution_started_at = datetime.utcnow()
        recovery.execution_completed_at = datetime.utcnow()
        
        await RecoveryEngine.record_event(
            session, recovery.id, "SIMULATION_COMPLETED", "Simulated remediation states applied.", 
            metadata={"after_state": recovery.after_state}
        )
        return recovery

    @staticmethod
    async def verify_recovery(session: AsyncSession, recovery: RecoveryRecord) -> RecoveryRecord:
        # Load finding and original execution/scenario
        result = await session.execute(
            select(AgentFinding)
            .options(selectinload(AgentFinding.execution), selectinload(AgentFinding.scenario))
            .where(AgentFinding.id == recovery.finding_id)
        )
        finding = result.scalars().first()
        
        if not finding or not finding.scenario:
            recovery.status = "FAILED"
            recovery.verification_status = "FAILED"
            await RecoveryEngine.record_event(session, recovery.id, "VERIFICATION_FAILED", "Missing original scenario or finding.")
            return recovery
            
        scenario = finding.scenario
        
        # Load agent fully
        result = await session.execute(
            select(Agent)
            .options(selectinload(Agent.capabilities), selectinload(Agent.outgoing_relationships))
            .where(Agent.id == recovery.agent_id)
        )
        agent = result.scalars().first()
        
        if not agent:
            recovery.status = "FAILED"
            recovery.verification_status = "FAILED"
            await RecoveryEngine.record_event(session, recovery.id, "VERIFICATION_FAILED", "Agent not found.")
            return recovery
            
        # Re-run simulation
        # Create a new AttackExecution
        attempts = 5
        if finding.execution:
            attempts = finding.execution.total_attempts

        verification_execution = AttackExecution(
            scenario_id=scenario.id,
            target_agent_id=agent.id,
            status="RUNNING",
            total_attempts=attempts,
            completed_attempts=0,
            successful_attempts=0,
            attack_success_rate=0.0,
            evaluation_level="per-full-task"
        )
        session.add(verification_execution)
        await session.flush()
        
        overrides = recovery.after_state.get("controls", {}) if recovery.after_state else {}
        
        successful_attempts = 0
        severity_observed = "NONE"
        
        for i in range(attempts):
            result_dict = AttackEngine.evaluate_attempt(
                scenario=scenario,
                agent=agent,
                capabilities=agent.capabilities,
                relationships=agent.outgoing_relationships,
                attempt_number=i + 1,
                simulation_overrides=overrides
            )
            
            attempt = AttackAttempt(
                execution_id=verification_execution.id,
                attempt_number=i + 1,
                input_payload=f"Verification payload {i+1} for {scenario.name}",
                simulated_agent_response=result_dict["simulated_response"],
                behavior_observed=result_dict["behavior_observed"],
                success=result_dict["success"],
                success_reason=result_dict["success_reason"],
                severity=result_dict["severity"],
                execution_time_ms=10 + i * 5
            )
            session.add(attempt)
            
            if result_dict["success"]:
                successful_attempts += 1
                if result_dict["severity"] == "CRITICAL":
                    severity_observed = "CRITICAL"
                elif result_dict["severity"] == "HIGH" and severity_observed != "CRITICAL":
                    severity_observed = "HIGH"
                elif result_dict["severity"] == "MEDIUM" and severity_observed not in ["CRITICAL", "HIGH"]:
                    severity_observed = "MEDIUM"
                elif result_dict["severity"] == "LOW" and severity_observed == "NONE":
                    severity_observed = "LOW"
                    
        verification_execution.completed_attempts = attempts
        verification_execution.successful_attempts = successful_attempts
        verification_execution.attack_success_rate = round((successful_attempts / attempts) * 100, 2)
        verification_execution.severity = severity_observed
        verification_execution.status = "COMPLETED"
        verification_execution.completed_at = datetime.utcnow()
        
        recovery.verification_execution_id = verification_execution.id
        recovery.current_asr = verification_execution.attack_success_rate
        
        prev_asr = recovery.previous_asr or 100.0
        curr_asr = recovery.current_asr
        
        if curr_asr == 0:
            recovery.status = "RECOVERED"
            recovery.verification_status = "PASSED"
        elif curr_asr < prev_asr and curr_asr > 0:
            recovery.status = "PARTIALLY_RECOVERED"
            recovery.verification_status = "PASSED"
        else:
            recovery.status = "FAILED"
            recovery.verification_status = "FAILED"
            
        await RecoveryEngine.record_event(
            session, recovery.id, "VERIFICATION_COMPLETED", 
            f"Verification completed. ASR changed from {prev_asr}% to {curr_asr}%. Result: {recovery.status}."
        )
        
        # Calculate residual risk
        await RecoveryEngine.calculate_residual_risk(session, recovery, agent, curr_asr)
        
        # Optionally resolve the finding if recovered
        if recovery.status == "RECOVERED":
            finding.status = "RESOLVED"
            finding.updated_at = datetime.utcnow()
            await RecoveryEngine.record_event(
                session, recovery.id, "FINDING_RESOLVED", 
                "Original security finding marked as RESOLVED due to successful recovery."
            )
            
        return recovery

    @staticmethod
    async def calculate_residual_risk(session: AsyncSession, recovery: RecoveryRecord, agent: Agent, current_asr: float):
        # Calculate blast radius size
        blast_summary = await calculate_blast_radius(agent.id, session)
        blast_dict = blast_summary.model_dump()
        
        sensitive_caps = blast_dict["summary"]["sensitive_capabilities"]
        downstream = blast_dict["summary"]["downstream_agents"]
        
        if current_asr > 50:
            recovery.residual_risk = "CRITICAL"
            recovery.residual_risk_explanation = f"Residual risk is CRITICAL because the attack remains highly successful (ASR {current_asr}%)."
        elif current_asr > 0:
            if sensitive_caps > 0 or downstream > 0:
                recovery.residual_risk = "HIGH"
                recovery.residual_risk_explanation = f"Residual risk is HIGH because ASR is {current_asr}% and the agent still has {sensitive_caps} sensitive capabilities and {downstream} downstream connections."
            else:
                recovery.residual_risk = "MEDIUM"
                recovery.residual_risk_explanation = f"Residual risk is MEDIUM. ASR is {current_asr}%, but the agent has limited capabilities."
        else:
            if sensitive_caps > 2 or downstream > 2:
                recovery.residual_risk = "MEDIUM"
                recovery.residual_risk_explanation = f"Residual risk is MEDIUM. ASR is 0%, but the agent retains significant exposure ({sensitive_caps} sensitive capabilities, {downstream} downstream connections)."
            else:
                recovery.residual_risk = "LOW"
                recovery.residual_risk_explanation = "Residual risk is LOW. Attack surface is mitigated and remaining capabilities are limited."
                
        await RecoveryEngine.record_event(
            session, recovery.id, "RISK_CALCULATED", 
            f"Residual risk assessed as {recovery.residual_risk}."
        )

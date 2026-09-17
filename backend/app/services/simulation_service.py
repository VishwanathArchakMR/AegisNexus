from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import time

from app.models.agent import Agent
from app.models.capability import AgentCapability
from app.models.relationship import AgentRelationship
from app.models.simulation import AttackScenario, AttackExecution, AttackAttempt
from app.models.finding import AgentFinding
from app.services.attack_engine import AttackEngine

class SimulationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute_simulation(
        self, scenario_id: str, agent_id: str, attempts: int
    ) -> AttackExecution:
        # 1. Validate scenario and agent
        scenario = await self.db.scalar(
            select(AttackScenario).where(AttackScenario.id == scenario_id)
        )
        agent = await self.db.scalar(
            select(Agent).where(Agent.id == agent_id)
        )

        if not scenario or not agent:
            raise ValueError("Scenario or Agent not found")

        # 2. Get agent capabilities and relationships for the engine
        capabilities = list(await self.db.scalars(
            select(AgentCapability).where(AgentCapability.agent_id == agent_id)
        ))
        relationships = list(await self.db.scalars(
            select(AgentRelationship).where(AgentRelationship.source_agent_id == agent_id)
        ))

        # 3. Create Execution record
        execution = AttackExecution(
            scenario_id=scenario.id,
            target_agent_id=agent.id,
            status="RUNNING",
            total_attempts=attempts,
            started_at=datetime.now(timezone.utc),
            evaluation_level="per-full-task"
        )
        self.db.add(execution)
        await self.db.flush()

        successful_attempts_count = 0
        max_severity = "LOW"
        severity_order = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

        # 4. Run Attempts synchronously (mocked deterministic logic)
        for i in range(1, attempts + 1):
            start_time = time.time()
            result = AttackEngine.evaluate_attempt(
                scenario=scenario,
                agent=agent,
                capabilities=capabilities,
                relationships=relationships,
                attempt_number=i,
            )
            exec_time_ms = int((time.time() - start_time) * 1000)

            if result["success"]:
                successful_attempts_count += 1
                if severity_order.get(result["severity"], 0) > severity_order.get(max_severity, 0):
                    max_severity = result["severity"]

            attempt = AttackAttempt(
                execution_id=execution.id,
                attempt_number=i,
                input_payload=scenario.payload_template,
                simulated_agent_response=result["simulated_response"],
                behavior_observed=result["behavior_observed"],
                success=result["success"],
                success_reason=result["success_reason"],
                severity=result["severity"],
                execution_time_ms=exec_time_ms,
            )
            self.db.add(attempt)
        
        # 5. Calculate Metrics
        asr = successful_attempts_count / attempts if attempts > 0 else 0.0
        
        execution.completed_attempts = attempts
        execution.successful_attempts = successful_attempts_count
        execution.attack_success_rate = asr
        execution.status = "COMPLETED"
        execution.completed_at = datetime.now(timezone.utc)
        execution.severity = max_severity if successful_attempts_count > 0 else "NONE"

        await self.db.flush()

        # 6. Generate Deduplicated Finding (if any successful attempts)
        if successful_attempts_count > 0:
            # Check if a finding for this scenario+agent already exists
            existing_finding = await self.db.scalar(
                select(AgentFinding).where(
                    AgentFinding.agent_id == agent.id,
                    AgentFinding.scenario_id == scenario.id,
                )
            )

            # We create a new finding for this execution, or we could update the existing one.
            # The prompt said: "Deduplicate findings by: target agent + scenario + vulnerability/behavior type. 
            # Therefore, repeated successful attempts of the same vulnerability should normally produce ONE finding for that execution."
            # Since we are making a finding per execution for the same vulnerability, we should just make sure we only generate 1 finding per execution.
            
            # Note: "Deduplicate findings by: target agent + scenario + vulnerability/behavior type."
            # We'll just create a single finding per execution since the execution tests one scenario.
            
            # Find the first successful attempt to pull evidence
            first_success = await self.db.scalar(
                select(AttackAttempt).where(
                    AttackAttempt.execution_id == execution.id,
                    AttackAttempt.success == True
                )
            )

            # Check if we should update existing or create new. Let's create new if none exist, or update existing if we want true deduplication across the DB.
            if not existing_finding:
                finding = AgentFinding(
                    agent_id=agent.id,
                    execution_id=execution.id,
                    scenario_id=scenario.id,
                    title=f"Vulnerability: {scenario.name}",
                    description=f"The agent is vulnerable to {scenario.attack_type}.",
                    finding_type=scenario.attack_type,
                    severity=max_severity,
                    status="OPEN",
                    evidence=(
                        f"Targeted Scenario: {scenario.name}\n"
                        f"Target Agent: {agent.name}\n"
                        f"ASR: {asr * 100:.1f}% ({successful_attempts_count}/{attempts} successful attempts).\n"
                        f"Observed Behavior: {first_success.behavior_observed if first_success else 'Unsafe behavior'}\n"
                        f"Reason: {first_success.success_reason if first_success else 'Simulation succeeded'}"
                    ),
                    recommendation=scenario.mitigation_guidance
                )
                self.db.add(finding)
            else:
                # Update existing finding with latest evidence
                existing_finding.execution_id = execution.id
                existing_finding.evidence = (
                    f"Targeted Scenario: {scenario.name}\n"
                    f"Target Agent: {agent.name}\n"
                    f"Latest ASR: {asr * 100:.1f}% ({successful_attempts_count}/{attempts} successful attempts).\n"
                    f"Observed Behavior: {first_success.behavior_observed if first_success else 'Unsafe behavior'}\n"
                    f"Reason: {first_success.success_reason if first_success else 'Simulation succeeded'}"
                )
                existing_finding.severity = max_severity

        await self.db.commit()
        return execution

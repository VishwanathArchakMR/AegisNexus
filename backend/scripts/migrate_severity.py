import sys
import os
import asyncio
from sqlalchemy import select

# Ensure backend directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import AsyncSessionLocal
from app.models.finding import AgentFinding
from app.models.capability import AgentCapability
from app.services.blast_radius_service import derive_capability_risk_families, derive_severity_from_families, calculate_blast_radius

async def migrate_severities():
    changed_count = 0
    async with AsyncSessionLocal() as db:
        findings = (await db.execute(select(AgentFinding))).scalars().all()
        
        for finding in findings:
            old_severity = finding.severity
            
            if "Live Event Triggered Action:" in finding.evidence:
                # Live finding - derive from the specific invoked tool
                lines = finding.evidence.split("\n")
                action = next((line.split(": ")[1].strip() for line in lines if "Live Event Triggered Action" in line), None)
                if action:
                    cap = await db.scalar(select(AgentCapability).where(
                        AgentCapability.agent_id == finding.agent_id,
                        AgentCapability.capability_name == action
                    ))
                    if cap:
                        families = derive_capability_risk_families(cap)
                        finding.risk_families = sorted(list(families))
                        finding.severity = derive_severity_from_families(families)
            else:
                # Simulated finding - derive from the agent's overall impact
                br = await calculate_blast_radius(finding.agent_id, db)
                finding.severity = br.summary.potential_impact
                finding.risk_families = br.summary.risk_families
            
            if old_severity != finding.severity:
                changed_count += 1
                
        await db.commit()
    print(f"Migration complete. {changed_count} records changed severity.")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(migrate_severities())

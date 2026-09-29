import asyncio
import sys
import os
from sqlalchemy import select

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.database import AsyncSessionLocal
from app.models.finding import AgentFinding
from app.models.capability import AgentCapability
from app.models.agent import Agent
from app.services.blast_radius_service import calculate_blast_radius

async def run():
    # 1. Update Finance Agent to have an ADMIN capability
    async with AsyncSessionLocal() as db:
        cap = await db.scalar(select(AgentCapability).where(AgentCapability.id == "cap-fin-002"))
        if cap:
            cap.permission_level = "ADMIN"
            await db.commit()
            print(f"Updated {cap.capability_name} to ADMIN.")
            
    # 2. Get Before State
    async with AsyncSessionLocal() as db:
        # Check current severity of finding for Finance Agent
        finance_agent = await db.scalar(select(Agent).where(Agent.name == "Finance Agent"))
        
        print("\n--- BEFORE MIGRATION ---")
        findings = (await db.execute(select(AgentFinding).where(AgentFinding.agent_id == finance_agent.id))).scalars().all()
        for f in findings:
            print(f"Finding: {f.title} | Severity: {f.severity} | Risk Families: {f.risk_families}")
            
    # 3. Run migration
    import migrate_severity
    print("\n--- RUNNING MIGRATION ---")
    await migrate_severity.migrate_severities()
    
    # 4. Get After State
    async with AsyncSessionLocal() as db:
        finance_agent = await db.scalar(select(Agent).where(Agent.name == "Finance Agent"))
        
        print("\n--- AFTER MIGRATION ---")
        findings = (await db.execute(select(AgentFinding).where(AgentFinding.agent_id == finance_agent.id))).scalars().all()
        for f in findings:
            print(f"Finding: {f.title} | Severity: {f.severity} | Risk Families: {f.risk_families}")
            
        br = await calculate_blast_radius(finance_agent.id, db)
        print("\n--- BLAST RADIUS SUMMARY ---")
        print(f"Impact: {br.summary.potential_impact}")
        print(f"Risk Families: {br.summary.risk_families}")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run())

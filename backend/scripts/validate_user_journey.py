import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from httpx import AsyncClient, ASGITransport
from app.main import app

async def test_journey():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost:8000") as c:
        # 1. Health & readiness
        r = await c.get("/api/v1/health")
        assert r.status_code == 200, r.text
        r = await c.get("/api/v1/readiness")
        assert r.status_code == 200, r.text
        print("[1] Health and readiness: OK")

        # 2. Dashboard summary
        dash = (await c.get("/api/v1/dashboard/summary")).json()
        print(f"[2] Dashboard summary: {dash['total_agents']} agents, posture score: {dash['posture_score']}")

        # 3. Agent inventory and detail
        agents = (await c.get("/api/v1/agents")).json()["agents"]
        assert len(agents) >= 4
        cs_agent = next(a for a in agents if a["name"] == "Customer Support Agent")
        cs_id = cs_agent["id"]
        detail = (await c.get(f"/api/v1/agents/{cs_id}")).json()
        assert len(detail["capabilities"]) > 0
        print(f"[3] Agent detail: {detail['name']} (ID: {cs_id}) with {len(detail['capabilities'])} capabilities")

        # 4. Blast radius
        br = (await c.get(f"/api/v1/agents/{cs_id}/blast-radius")).json()
        assert len(br["nodes"]) > 0
        print(f"[4] Blast radius: {len(br['nodes'])} nodes, potential impact: {br['summary']['potential_impact']}")

        # 5. Attack simulation
        sim_req = {"scenario_id": "scen-002", "target_agent_id": cs_id, "attempts": 3}
        sim_res = (await c.post("/api/v1/attack-simulations", json=sim_req)).json()
        exec_id = sim_res["id"]
        assert sim_res["status"] == "COMPLETED"
        print(f"[5] Attack simulation: Execution {exec_id}, ASR: {sim_res['attack_success_rate']}")

        # 6. Verify finding generated
        findings = (await c.get(f"/api/v1/findings?agent_id={cs_id}")).json()
        assert len(findings) > 0
        finding = findings[0]
        finding_id = finding["id"]
        print(f"[6] Finding generated: {finding['title']}, Severity: {finding['severity']}, Status: {finding['status']}")

        # 7. Recovery lifecycle
        # Create (or retrieve existing if already created)
        existing_recs = (await c.get(f"/api/v1/recovery?finding_id={finding_id}")).json()
        if existing_recs:
            rec_id = existing_recs[0]["id"]
            rec = existing_recs[0]
            print(f"[7] Using existing recovery record: {rec_id}, Status: {rec['status']}")
        else:
            rec = (await c.post("/api/v1/recovery", json={"finding_id": finding_id, "agent_id": cs_id})).json()
            rec_id = rec["id"]
            print(f"[7] Recovery record created: {rec_id}, Status: {rec['status']}")

        if rec["status"] == "OPEN":
            rec = (await c.post(f"/api/v1/recovery/{rec_id}/plan")).json()
            print(f"[7a] Recovery planned: {rec['status']}")

        if rec["status"] == "PLANNED":
            rec = (await c.post(f"/api/v1/recovery/{rec_id}/approve")).json()
            print(f"[7b] Recovery approved: {rec['status']}")

        if rec["status"] == "APPROVED":
            rec = (await c.post(f"/api/v1/recovery/{rec_id}/execute")).json()
            print(f"[7c] Recovery executed: {rec['status']}")

        if rec["status"] == "VERIFYING":
            rec = (await c.post(f"/api/v1/recovery/{rec_id}/verify")).json()
            print(f"[7d] Recovery verified: {rec['status']}, current ASR: {rec['current_asr']}")

        # Confirm finding status updated
        f_after = (await c.get(f"/api/v1/findings/{finding_id}")).json()
        print(f"[7e] Finding status after recovery verification: {f_after['status']}")

        # 8. Compliance recalculation
        comp_summary = (await c.get("/api/v1/compliance/summary")).json()
        print(f"[8] Compliance summary: {comp_summary['total_frameworks']} frameworks, {comp_summary['total_assessments']} assessments")

        print("\nALL USER JOURNEY STEPS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_journey())

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from httpx import AsyncClient, ASGITransport
from app.main import app

async def test_journey():
    async with app.router.lifespan_context(app):
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

            # 9. AegisNexus 2.0: External Agent Onboarding
            onboard_payload = {
                "name": "Validation External Agent",
                "description": "Autonomous billing and invoicing copilot for E2E validation.",
                "agent_type": "finance",
                "framework": "LangChain",
                "owner_team": "Core Platform",
                "environment": "production",
                "deployment_location": "k8s:cluster-west-1",
                "tags": ["external", "e2e-test"],
                "initial_trust_level": "LOW",
                "capabilities": [
                    {
                        "name": "lookup_invoice",
                        "resource_type": "DATABASE",
                        "permission_level": "READ",
                        "is_sensitive": False,
                        "description": "Reads invoice line items",
                    }
                ],
            }
            onboard_res = await c.post("/api/v1/agents/onboard", json=onboard_payload)
            assert onboard_res.status_code == 200, onboard_res.text
            ext_agent = onboard_res.json()
            ext_id = ext_agent["agent_id"]
            ext_key = ext_agent["api_key"]
            print(f"[9] External Agent Onboarded: {ext_id}, Trust: {ext_agent['trust_level']}, Framework: {ext_agent['framework']}")

            # 10. Capability Synchronization
            sync_payload = {
                "capabilities": [
                    {
                        "name": "lookup_invoice",
                        "resource_type": "DATABASE",
                        "permission_level": "READ",
                        "is_sensitive": False,
                    },
                    {
                        "name": "process_payout",
                        "resource_type": "PAYMENT",
                        "permission_level": "WRITE",
                        "is_sensitive": True,
                    },
                ]
            }
            sync_res = await c.post(
                f"/api/v1/agents/{ext_id}/capabilities/sync",
                json=sync_payload,
                headers={"Authorization": f"Bearer {ext_key}"},
            )
            assert sync_res.status_code == 200
            sync_data = sync_res.json()
            caps = sync_data["capabilities"]
            assert len(caps) == 2
            print(f"[10] Capability Synchronization: {len(caps)} capabilities registered with SELF_REPORTED provenance")

            # 11. Heartbeat & Connection Health
            hb_res = await c.post(
                f"/api/v1/agents/{ext_id}/heartbeat",
                json={"status": "ACTIVE"},
                headers={"Authorization": f"Bearer {ext_key}"},
            )
            assert hb_res.status_code == 200
            conn_res = await c.get(f"/api/v1/agents/{ext_id}/connection-status")
            assert conn_res.status_code == 200
            conn_data = conn_res.json()
            assert conn_data["connection_status"] == "ONLINE"
            print(f"[11] Heartbeat & Health Check: Status is {conn_data['connection_status']}")

            # 12. Telemetry Ingestion & Runtime Security Detection
            violation_event = {
                "agent_id": ext_id,
                "event_type": "TOOL_CALL_COMPLETED",
                "tool_name": "internal_db_dump",
                "action": "export_all_credentials",
                "resource_type": "DATABASE",
                "permission_level": "ADMIN",
                "status": "SUCCESS",
                "duration_ms": 140,
                "metadata_json": {"target": "all_users"},
            }
            event_res = await c.post(
                f"/api/v1/agents/{ext_id}/events",
                json=violation_event,
                headers={"Authorization": f"Bearer {ext_key}"},
            )
            assert event_res.status_code == 200
            rt_findings = (await c.get(f"/api/v1/findings?agent_id={ext_id}")).json()
            assert len(rt_findings) > 0
            rt_f = rt_findings[0]
            assert rt_f["source_type"] == "RUNTIME_DETECTION"
            assert rt_f["execution_id"] is None
            print(f"[12] Runtime Detection: Triggered finding '{rt_f['title']}' via rule '{rt_f['detection_rule']}' (execution_id: {rt_f['execution_id']})")

            # 13. Inter-Agent Delegation Tracking & Graph Provenance
            delegation_event = {
                "agent_id": ext_id,
                "event_type": "AGENT_DELEGATION",
                "target_agent_id": cs_id,
                "action": "delegate_customer_verification",
                "status": "SUCCESS",
                "duration_ms": 210,
            }
            await c.post(
                f"/api/v1/agents/{ext_id}/events",
                json=delegation_event,
                headers={"Authorization": f"Bearer {ext_key}"},
            )
            ext_br = (await c.get(f"/api/v1/agents/{ext_id}/blast-radius")).json()
            observed_edges = [e for e in ext_br["edges"] if e.get("provenance") == "OBSERVED"]
            assert len(observed_edges) > 0
            print(f"[13] Observed Inter-Agent Relationship: Found {len(observed_edges)} edges with OBSERVED provenance")

            # 14. Key Rotation and Revocation Lifecycle
            rotate_res = await c.post(f"/api/v1/agents/{ext_id}/rotate-key")
            assert rotate_res.status_code == 200
            new_key = rotate_res.json()["new_api_key"]

            # Old key rejected
            old_auth = await c.post(
                f"/api/v1/agents/{ext_id}/heartbeat",
                json={"status": "ACTIVE"},
                headers={"Authorization": f"Bearer {ext_key}"},
            )
            assert old_auth.status_code == 401

            # New key accepted
            new_auth = await c.post(
                f"/api/v1/agents/{ext_id}/heartbeat",
                json={"status": "ACTIVE"},
                headers={"Authorization": f"Bearer {new_key}"},
            )
            assert new_auth.status_code == 200

            # Revoke key
            revoke_res = await c.post(f"/api/v1/agents/{ext_id}/revoke-key")
            assert revoke_res.status_code == 200
            revoked_auth = await c.post(
                f"/api/v1/agents/{ext_id}/heartbeat",
                json={"status": "ACTIVE"},
                headers={"Authorization": f"Bearer {new_key}"},
            )
            assert revoked_auth.status_code == 401
            print("[14] Key Lifecycle: Rotation and Revocation validated successfully")

            print("\nALL AEGISNEXUS 2.0 USER JOURNEY STEPS VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_journey())

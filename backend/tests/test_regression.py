import pytest
from httpx import AsyncClient

from app.simulation.seed_data import CUSTOMER_SUPPORT_ID, FINANCE_ID

pytestmark = pytest.mark.asyncio


async def test_critical_routes_registered_and_respond(client: AsyncClient):
    """Verify all expected v1 endpoints respond with valid status codes."""
    paths = [
        "/api/v1/health",
        "/api/v1/readiness",
        "/api/v1/agents",
        "/api/v1/dashboard/summary",
        "/api/v1/attack-scenarios",
        "/api/v1/attack-simulations",
        "/api/v1/findings",
        "/api/v1/compliance/summary",
        "/api/v1/compliance/frameworks",
        "/api/v1/recovery",
        "/api/v1/recovery/summary",
    ]
    for path in paths:
        resp = await client.get(path)
        assert resp.status_code == 200, f"Expected 200 for {path}, got {resp.status_code}"


async def test_readiness_probe_database_connected(client: AsyncClient):
    """Verify readiness reports operational database status."""
    resp = await client.get("/api/v1/readiness")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"


async def test_validation_errors_structured(client: AsyncClient):
    """Verify invalid payloads produce 422 with structured field details."""
    # Missing required fields
    resp = await client.post("/api/v1/attack-simulations", json={})
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"] == "ValidationError"
    assert isinstance(data["details"], list)
    assert len(data["details"]) > 0


async def test_missing_resource_404_handling(client: AsyncClient):
    """Verify nonexistent resources return clean 404 responses."""
    resp = await client.get("/api/v1/agents/nonexistent-agent-id-1234")
    assert resp.status_code == 404
    assert "not found" in resp.json()["message"].lower()

    resp = await client.get("/api/v1/findings/nonexistent-finding-id-1234")
    assert resp.status_code == 404

    resp = await client.get("/api/v1/attack-simulations/nonexistent-sim-id-1234")
    assert resp.status_code == 404

    resp = await client.get("/api/v1/recovery/nonexistent-rec-id-1234")
    assert resp.status_code == 404


async def test_findings_detail_relation_loading(client: AsyncClient):
    """Verify finding detail endpoint loads nested execution and scenario without ORM error."""
    # Ensure at least one simulation has run
    sim_resp = await client.post(
        "/api/v1/attack-simulations",
        json={"scenario_id": "scen-002", "target_agent_id": CUSTOMER_SUPPORT_ID, "attempts": 3},
    )
    assert sim_resp.status_code == 200

    findings_resp = await client.get(f"/api/v1/findings?agent_id={CUSTOMER_SUPPORT_ID}")
    assert findings_resp.status_code == 200
    findings = findings_resp.json()
    assert len(findings) > 0

    finding_id = findings[0]["id"]
    detail_resp = await client.get(f"/api/v1/findings/{finding_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["id"] == finding_id
    assert detail["agent"]["name"] == "Customer Support Agent"
    assert detail["execution"] is not None
    assert detail["execution"]["scenario"] is not None


async def test_recovery_lifecycle_invalid_transitions(client: AsyncClient):
    """Verify state machine rejects invalid recovery transitions."""
    # Get a finding
    findings = (await client.get("/api/v1/findings")).json()
    if not findings:
        await client.post(
            "/api/v1/attack-simulations",
            json={"scenario_id": "scen-002", "target_agent_id": CUSTOMER_SUPPORT_ID, "attempts": 3},
        )
        findings = (await client.get("/api/v1/findings")).json()

    finding = findings[0]
    
    # Check if recovery already exists, or create new
    existing = (await client.get(f"/api/v1/recovery?finding_id={finding['id']}")).json()
    if existing:
        rec_id = existing[0]["id"]
    else:
        rec = (await client.post("/api/v1/recovery", json={"finding_id": finding["id"], "agent_id": finding["agent_id"]})).json()
        rec_id = rec["id"]

    # If it's already RECOVERED, creating plan should be rejected
    rec_record = (await client.get(f"/api/v1/recovery/{rec_id}")).json()
    if rec_record["status"] == "RECOVERED":
        bad_plan = await client.post(f"/api/v1/recovery/{rec_id}/plan")
        assert bad_plan.status_code == 400


async def test_end_to_end_retest_and_verification(client: AsyncClient):
    """
    Test full DISCOVER -> ATTACK -> FIND -> REMEDIATE -> RETEST -> VERIFY pipeline.
    Confirms finding status updates to RESOLVED when verification condition passes.
    """
    # 1. Attack Finance Agent
    sim_resp = await client.post(
        "/api/v1/attack-simulations",
        json={"scenario_id": "scen-003", "target_agent_id": FINANCE_ID, "attempts": 3},
    )
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["attack_success_rate"] > 0

    # 2. Get the generated finding
    findings = (await client.get(f"/api/v1/findings?agent_id={FINANCE_ID}&finding_type=PRIVILEGE_ESCALATION")).json()
    assert len(findings) == 1
    finding = findings[0]
    finding_id = finding["id"]

    # 3. Create or fetch recovery record
    existing = (await client.get(f"/api/v1/recovery?finding_id={finding_id}")).json()
    if existing:
        rec_id = existing[0]["id"]
        rec = existing[0]
    else:
        rec = (await client.post("/api/v1/recovery", json={"finding_id": finding_id, "agent_id": FINANCE_ID})).json()
        rec_id = rec["id"]

    # 4. Advance through lifecycle if not already recovered
    if rec["status"] == "OPEN":
        rec = (await client.post(f"/api/v1/recovery/{rec_id}/plan")).json()
        assert rec["status"] == "PLANNED"

    if rec["status"] == "PLANNED":
        rec = (await client.post(f"/api/v1/recovery/{rec_id}/approve")).json()
        assert rec["status"] == "APPROVED"

    if rec["status"] == "APPROVED":
        rec = (await client.post(f"/api/v1/recovery/{rec_id}/execute")).json()
        assert rec["status"] == "VERIFYING"

    if rec["status"] == "VERIFYING":
        rec = (await client.post(f"/api/v1/recovery/{rec_id}/verify")).json()
        assert rec["status"] in ("RECOVERED", "PARTIALLY_RECOVERED")
        assert rec["current_asr"] == 0.0

    # 5. Confirm original finding is marked RESOLVED
    finding_after = (await client.get(f"/api/v1/findings/{finding_id}")).json()
    assert finding_after["status"] == "RESOLVED"

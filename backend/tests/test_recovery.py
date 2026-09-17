import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

BASE = "http://test"

pytestmark = pytest.mark.asyncio

@pytest_asyncio.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        yield c

async def test_recovery_lifecycle(client: AsyncClient):
    # Get a finding
    resp = await client.get("/api/v1/findings")
    assert resp.status_code == 200
    findings = resp.json()
    if not findings:
        # If there are no findings in the seeded DB, run a simulation to create one
        resp_sim = await client.post("/api/v1/attack-simulations/", json={"scenario_id": "scen-002", "target_agent_id": "00000000-0000-0000-0000-000000000001", "attempts": 3})
        assert resp_sim.status_code == 200
        resp = await client.get("/api/v1/findings")
        findings = resp.json()
        if not findings:
            pytest.skip("No findings available to test recovery lifecycle")
    finding = findings[0]
    
    finding_id = finding["id"]
    agent_id = finding["agent_id"]

    # 1. Create Recovery
    response = await client.post("/api/v1/recovery/", json={"finding_id": finding_id, "agent_id": agent_id})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "OPEN"
    recovery_id = data["id"]
    
    # Check events
    events_resp = await client.get(f"/api/v1/recovery/{recovery_id}/events")
    events = events_resp.json()
    assert len(events) == 1
    assert events[0]["event_type"] == "RECOVERY_CREATED"
    
    # 2. Plan Recovery
    response = await client.post(f"/api/v1/recovery/{recovery_id}/plan")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PLANNED"
    assert data["before_state"] is not None
    assert data["after_state"] is not None
    
    # 3. Approve Recovery
    response = await client.post(f"/api/v1/recovery/{recovery_id}/approve")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    assert data["approval_status"] == "APPROVED"
    
    # 4. Execute Simulation
    response = await client.post(f"/api/v1/recovery/{recovery_id}/execute")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "VERIFYING"
    assert data["execution_status"] == "SIMULATED"
    
    # 5. Verify Recovery
    response = await client.post(f"/api/v1/recovery/{recovery_id}/verify")
    assert response.status_code == 200
    data = response.json()
    
    # It might be RECOVERED or FAILED depending on the exact finding, but logic should run.
    assert data["verification_status"] in ("PASSED", "FAILED")
    assert data["current_asr"] is not None
    assert data["residual_risk"] is not None
    
    # 6. Check summary
    summary_resp = await client.get("/api/v1/recovery/summary")
    summary = summary_resp.json()
    assert summary["total_recovery_records"] > 0

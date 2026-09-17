import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.simulation.seed_data import CUSTOMER_SUPPORT_ID, FINANCE_ID

BASE = "http://test"

@pytest_asyncio.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        yield c

pytestmark = pytest.mark.asyncio

async def test_get_scenarios(client: AsyncClient):
    response = await client.get("/api/v1/attack-scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) == 5
    # Find the prompt injection scenario
    scenario = next((s for s in scenarios if s["attack_type"] == "PROMPT_INJECTION"), None)
    assert scenario is not None
    assert scenario["target_agent_type"] == "customer_support"

async def test_create_simulation_and_findings(client: AsyncClient):
    # Get scenarios first
    scen_response = await client.get("/api/v1/attack-scenarios")
    scenarios = scen_response.json()
    pii_scenario = next(s for s in scenarios if s["attack_type"] == "PII_EXFILTRATION")

    # Run simulation against Customer Support
    sim_payload = {
        "scenario_id": pii_scenario["id"],
        "target_agent_id": CUSTOMER_SUPPORT_ID,
        "attempts": 5
    }
    sim_resp = await client.post("/api/v1/attack-simulations", json=sim_payload)
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["status"] == "COMPLETED"
    assert sim_data["total_attempts"] == 5
    assert sim_data["completed_attempts"] == 5
    assert sim_data["attack_success_rate"] > 0
    assert sim_data["severity"] == "CRITICAL"
    
    execution_id = sim_data["id"]

    # Verify attempts
    attempts_resp = await client.get(f"/api/v1/attack-simulations/{execution_id}/attempts")
    assert attempts_resp.status_code == 200
    attempts_data = attempts_resp.json()
    assert len(attempts_data) == 5
    successful_attempts = [a for a in attempts_data if a["success"]]
    assert len(successful_attempts) == sim_data["successful_attempts"]

    # Verify findings are generated
    findings_resp = await client.get(f"/api/v1/attack-simulations/{execution_id}/findings")
    assert findings_resp.status_code == 200
    findings_data = findings_resp.json()
    assert len(findings_data) == 1
    finding = findings_data[0]
    assert finding["severity"] == "CRITICAL"
    assert finding["finding_type"] == "PII_EXFILTRATION"
    assert finding["agent_id"] == CUSTOMER_SUPPORT_ID
    
    # Run simulation again to ensure findings deduplication logic doesn't crash 
    # (should either update or at least not fail)
    sim_resp2 = await client.post("/api/v1/attack-simulations", json=sim_payload)
    assert sim_resp2.status_code == 200
    
    # Check total findings for this agent
    all_findings_resp = await client.get(f"/api/v1/findings?agent_id={CUSTOMER_SUPPORT_ID}")
    assert all_findings_resp.status_code == 200
    all_findings = all_findings_resp.json()
    
    # There should only be 1 finding for PII_EXFILTRATION on Customer Support
    pii_findings = [f for f in all_findings if f["finding_type"] == "PII_EXFILTRATION"]
    assert len(pii_findings) == 1

async def test_finance_privilege_escalation(client: AsyncClient):
    scen_response = await client.get("/api/v1/attack-scenarios")
    scenarios = scen_response.json()
    pe_scenario = next(s for s in scenarios if s["attack_type"] == "PRIVILEGE_ESCALATION")

    sim_payload = {
        "scenario_id": pe_scenario["id"],
        "target_agent_id": FINANCE_ID,
        "attempts": 3
    }
    sim_resp = await client.post("/api/v1/attack-simulations", json=sim_payload)
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert sim_data["attack_success_rate"] > 0
    
    exec_id = sim_data["id"]
    findings_resp = await client.get(f"/api/v1/attack-simulations/{exec_id}/findings")
    findings = findings_resp.json()
    assert len(findings) == 1
    assert findings[0]["finding_type"] == "PRIVILEGE_ESCALATION"

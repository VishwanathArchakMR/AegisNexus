import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

pytestmark = pytest.mark.asyncio

BASE = "http://test"

@pytest_asyncio.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        yield c

async def test_list_frameworks(client: AsyncClient):
    response = await client.get("/api/v1/compliance/frameworks")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3 # OWASP, NIST, SOC2

async def test_get_framework(client: AsyncClient):
    # Get a framework ID first
    fws = await client.get("/api/v1/compliance/frameworks")
    fw_id = fws.json()[0]["id"]
    
    response = await client.get(f"/api/v1/compliance/frameworks/{fw_id}")
    assert response.status_code == 200
    assert response.json()["id"] == fw_id

async def test_list_controls(client: AsyncClient):
    response = await client.get("/api/v1/compliance/controls")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 12 # 4 controls * 3 frameworks

async def test_create_and_get_assessment(client: AsyncClient):
    # Setup
    fws = await client.get("/api/v1/compliance/frameworks")
    fw_id = fws.json()[0]["id"]
    
    agents = await client.get("/api/v1/agents")
    agent_id = agents.json()["agents"][0]["id"]
    
    # Create Assessment
    response = await client.post("/api/v1/compliance/assessments", json={
        "framework_id": fw_id,
        "agent_id": agent_id
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["framework_id"] == fw_id
    assert data["agent_id"] == agent_id
    assert "score" in data
    assert "status" in data
    assert len(data["results"]) > 0
    
    assessment_id = data["id"]
    
    # Get Assessment
    get_response = await client.get(f"/api/v1/compliance/assessments/{assessment_id}")
    assert get_response.status_code == 200
    get_data = get_response.json()
    assert get_data["id"] == assessment_id
    assert get_data["framework"]["id"] == fw_id

async def test_get_agent_posture(client: AsyncClient):
    agents = await client.get("/api/v1/agents")
    agent_id = agents.json()["agents"][0]["id"]
    
    response = await client.get(f"/api/v1/compliance/agents/{agent_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["agent_id"] == agent_id
    assert "frameworks" in data

async def test_get_summary(client: AsyncClient):
    response = await client.get("/api/v1/compliance/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_frameworks" in data
    assert "total_assessments" in data
    assert "average_score" in data

async def test_invalid_framework_assessment(client: AsyncClient):
    agents = await client.get("/api/v1/agents")
    agent_id = agents.json()["agents"][0]["id"]
    
    response = await client.post("/api/v1/compliance/assessments", json={
        "framework_id": "invalid-fw-id",
        "agent_id": agent_id
    })
    assert response.status_code == 404

async def test_invalid_agent_assessment(client: AsyncClient):
    fws = await client.get("/api/v1/compliance/frameworks")
    fw_id = fws.json()[0]["id"]
    
    response = await client.post("/api/v1/compliance/assessments", json={
        "framework_id": fw_id,
        "agent_id": "invalid-agent-id"
    })
    assert response.status_code == 404

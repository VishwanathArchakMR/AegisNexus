"""
Backend API tests for Phase 2.

Run with:
    cd backend
    .venv\\Scripts\\pip install pytest pytest-asyncio httpx
    .venv\\Scripts\\pytest tests/ -v

The tests assume the database is seeded (which happens automatically on startup).
We spin up the ASGI app in-process so no running server is needed.
"""
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app

BASE = "http://test"


@pytest_asyncio.fixture(scope="module")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE) as c:
        yield c


# ── Health ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health(client: AsyncClient) -> None:
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "AegisNexus"


# ── Agent list ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_agents_list_returns_all(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 4
    names = [a["name"] for a in data["agents"]]
    assert "Customer Support Agent" in names
    assert "Finance Agent" in names
    assert "Research Agent" in names
    assert "Internal Operations Agent" in names


@pytest.mark.asyncio
async def test_agents_list_filter_by_status(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents?status=ACTIVE")
    assert r.status_code == 200
    data = r.json()
    assert all(a["status"] == "ACTIVE" for a in data["agents"])


@pytest.mark.asyncio
async def test_agents_list_filter_by_trust_level(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents?trust_level=CRITICAL")
    assert r.status_code == 200
    data = r.json()
    assert len(data["agents"]) >= 1
    assert all(a["trust_level"] == "CRITICAL" for a in data["agents"])


@pytest.mark.asyncio
async def test_agents_list_search(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents?search=finance")
    assert r.status_code == 200
    data = r.json()
    assert len(data["agents"]) == 1
    assert data["agents"][0]["name"] == "Finance Agent"


@pytest.mark.asyncio
async def test_agents_list_filter_no_results(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents?search=nonexistent_xyz")
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 0


# ── Agent detail ───────────────────────────────────────────────────────────

CUSTOMER_SUPPORT_ID = "00000000-0000-0000-0000-000000000001"
FINANCE_ID = "00000000-0000-0000-0000-000000000002"
RESEARCH_ID = "00000000-0000-0000-0000-000000000003"
OPS_ID = "00000000-0000-0000-0000-000000000004"


@pytest.mark.asyncio
async def test_agent_detail_customer_support(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/agents/{CUSTOMER_SUPPORT_ID}")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Customer Support Agent"
    assert data["trust_level"] == "HIGH"
    assert len(data["capabilities"]) == 4
    assert len(data["credentials"]) == 3
    assert len(data["outgoing_relationships"]) >= 1


@pytest.mark.asyncio
async def test_agent_detail_finance(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/agents/{FINANCE_ID}")
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Finance Agent"
    assert data["trust_level"] == "CRITICAL"


@pytest.mark.asyncio
async def test_agent_detail_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents/00000000-0000-0000-dead-000000000000")
    assert r.status_code == 404


# ── Capabilities ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_agent_capabilities(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/agents/{CUSTOMER_SUPPORT_ID}/capabilities")
    assert r.status_code == 200
    caps = r.json()
    assert len(caps) == 4
    sensitive = [c for c in caps if c["is_sensitive"]]
    assert len(sensitive) == 3


@pytest.mark.asyncio
async def test_capabilities_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents/bad-id/capabilities")
    assert r.status_code == 404


# ── Relationships ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_agent_relationships(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/agents/{CUSTOMER_SUPPORT_ID}/relationships")
    assert r.status_code == 200
    rels = r.json()
    assert len(rels) >= 1
    for rel in rels:
        assert "relationship_type" in rel
        assert rel["source_agent_id"] == CUSTOMER_SUPPORT_ID or \
               rel["target_agent_id"] == CUSTOMER_SUPPORT_ID


# ── Blast radius ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_blast_radius_structure(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/agents/{CUSTOMER_SUPPORT_ID}/blast-radius")
    assert r.status_code == 200
    data = r.json()
    assert data["root_agent_id"] == CUSTOMER_SUPPORT_ID
    assert data["root_agent_name"] == "Customer Support Agent"
    assert len(data["nodes"]) >= 1
    assert isinstance(data["edges"], list)
    summary = data["summary"]
    assert summary["potential_impact"] in ("CRITICAL", "HIGH", "MEDIUM", "LOW")
    assert summary["propagation_depth"] >= 0
    assert isinstance(summary["impact_factors"], list)


@pytest.mark.asyncio
async def test_blast_radius_root_node_present(client: AsyncClient) -> None:
    r = await client.get(f"/api/v1/agents/{CUSTOMER_SUPPORT_ID}/blast-radius")
    assert r.status_code == 200
    nodes = r.json()["nodes"]
    root_nodes = [n for n in nodes if n["is_root"]]
    assert len(root_nodes) == 1
    assert root_nodes[0]["id"] == CUSTOMER_SUPPORT_ID


@pytest.mark.asyncio
async def test_blast_radius_finance_has_downstream(client: AsyncClient) -> None:
    """Finance Agent calls Internal Operations → downstream_agents >= 1."""
    r = await client.get(f"/api/v1/agents/{FINANCE_ID}/blast-radius")
    assert r.status_code == 200
    summary = r.json()["summary"]
    assert summary["downstream_agents"] >= 1


@pytest.mark.asyncio
async def test_blast_radius_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/v1/agents/00000000-dead-0000-0000-000000000000/blast-radius")
    assert r.status_code == 404


# ── Dashboard ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_summary(client: AsyncClient) -> None:
    r = await client.get("/api/v1/dashboard/summary")
    assert r.status_code == 200
    data = r.json()
    assert data["total_agents"] >= 4
    assert data["sensitive_capabilities"] > 0
    assert data["posture_score"] > 0
    assert data["potential_impact"] if "potential_impact" in data else True

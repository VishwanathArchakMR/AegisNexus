import pytest
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta

from app.core.agent_status import (
    compute_connection_status,
    CONNECTION_ONLINE,
    CONNECTION_STALE,
    CONNECTION_OFFLINE,
    CONNECTION_NEVER_CONNECTED,
)
from app.simulation.seed_data import CUSTOMER_SUPPORT_ID, FINANCE_ID

pytestmark = pytest.mark.asyncio


# ─────────────────────────────────────────────────────────────────────────────
# 1. Onboarding & Key Management Tests
# ─────────────────────────────────────────────────────────────────────────────

async def test_onboard_external_agent_lifecycle(client: AsyncClient):
    """Verify operator onboarding generates a unique ID, returns the plaintext key once, and stores its hash."""
    payload = {
        "name": "Billing Automation Agent",
        "description": "Processes enterprise subscriptions and automated invoicing.",
        "agent_type": "finance",
        "framework": "LangChain",
        "owner_team": "Billing Operations",
        "environment": "production",
        "deployment_location": "aws:us-east-1",
        "tags": ["billing", "finance", "external"],
        "initial_trust_level": "LOW",
        "capabilities": [
            {
                "name": "generate_invoice",
                "resource_type": "DATABASE",
                "permission_level": "WRITE",
                "is_sensitive": True,
                "description": "Writes generated invoices to billing table",
            },
            {
                "name": "query_subscription",
                "resource_type": "DATABASE",
                "permission_level": "READ",
                "is_sensitive": False,
                "description": "Reads active customer plan",
            }
        ]
    }

    resp = await client.post("/api/v1/agents/onboard", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    agent_id = data["agent_id"]
    api_key = data["api_key"]

    assert agent_id is not None
    assert api_key is not None
    assert len(api_key) >= 32
    assert data["name"] == "Billing Automation Agent"
    assert data["trust_level"] == "LOW"
    assert data["framework"] == "LangChain"
    assert data["environment"] == "production"
    assert data["api_key_status"] == "ACTIVE"

    # Verify agent detail does NOT expose plaintext api_key
    detail_resp = await client.get(f"/api/v1/agents/{agent_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert "api_key" not in detail
    assert detail["api_key_status"] == "ACTIVE"
    assert detail["framework"] == "LangChain"
    assert len(detail["capabilities"]) == 2

    # Verify key rotation
    rotate_resp = await client.post(f"/api/v1/agents/{agent_id}/rotate-key")
    assert rotate_resp.status_code == 200
    rotate_data = rotate_resp.json()
    new_api_key = rotate_data["new_api_key"]
    assert new_api_key != api_key
    assert rotate_data["api_key_status"] == "ROTATED"

    # Old key must now fail authentication
    old_auth_resp = await client.post(
        f"/api/v1/agents/{agent_id}/heartbeat",
        json={"status": "ACTIVE"},
        headers={"Authorization": f"Bearer {api_key}"},
    )
    assert old_auth_resp.status_code == 401

    # New key must succeed
    new_auth_resp = await client.post(
        f"/api/v1/agents/{agent_id}/heartbeat",
        json={"status": "ACTIVE"},
        headers={"Authorization": f"Bearer {new_api_key}"},
    )
    assert new_auth_resp.status_code == 200

    # Verify key revocation
    revoke_resp = await client.post(f"/api/v1/agents/{agent_id}/revoke-key")
    assert revoke_resp.status_code == 200
    assert revoke_resp.json()["api_key_status"] == "REVOKED"

    # Revoked key must fail authentication
    revoked_auth_resp = await client.post(
        f"/api/v1/agents/{agent_id}/heartbeat",
        json={"status": "ACTIVE"},
        headers={"Authorization": f"Bearer {new_api_key}"},
    )
    assert revoked_auth_resp.status_code == 401
    err_json = revoked_auth_resp.json()
    err_msg = err_json.get("message") or err_json.get("detail", "")
    assert "revoked" in err_msg.lower()


# ─────────────────────────────────────────────────────────────────────────────
# 2. Connection Health & Heartbeat Status Tests
# ─────────────────────────────────────────────────────────────────────────────

async def test_compute_connection_status_pure_logic():
    """Unit test for pure connection status evaluation logic across thresholds."""
    now = datetime(2026, 11, 1, 12, 0, 0, tzinfo=timezone.utc)

    # Never connected
    status, elapsed = compute_connection_status(None, None, now=now)
    assert status == CONNECTION_NEVER_CONNECTED
    assert elapsed is None

    # Online: within 60s
    recent_heartbeat = now - timedelta(seconds=20)
    status, elapsed = compute_connection_status(recent_heartbeat, now=now)
    assert status == CONNECTION_ONLINE
    assert elapsed == 20

    # Stale: between 60s and 90s
    stale_heartbeat = now - timedelta(seconds=75)
    status, elapsed = compute_connection_status(stale_heartbeat, now=now)
    assert status == CONNECTION_STALE
    assert elapsed == 75

    # Offline: beyond 90s
    offline_heartbeat = now - timedelta(seconds=120)
    status, elapsed = compute_connection_status(offline_heartbeat, now=now)
    assert status == CONNECTION_OFFLINE
    assert elapsed == 120


async def test_agent_heartbeat_and_connection_status_endpoint(client: AsyncClient):
    """Verify heartbeat updates last_seen_at and connection-status endpoint reports active state."""
    # Onboard an agent
    onboard_res = await client.post(
        "/api/v1/agents/onboard",
        json={"name": "Monitor Target", "description": "Health test", "owner_team": "SRE"},
    )
    assert onboard_res.status_code == 200
    agent_info = onboard_res.json()
    agent_id = agent_info["agent_id"]
    api_key = agent_info["api_key"]

    headers = {"Authorization": f"Bearer {api_key}"}

    # Initial connection status before any heartbeat
    status_resp = await client.get(f"/api/v1/agents/{agent_id}/connection-status")
    assert status_resp.status_code == 200
    assert status_resp.json()["connection_status"] == CONNECTION_NEVER_CONNECTED

    # Send heartbeat
    hb_resp = await client.post(
        f"/api/v1/agents/{agent_id}/heartbeat",
        json={"status": "ACTIVE", "sdk_version": "0.2.0"},
        headers=headers,
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["connection_status"] == CONNECTION_ONLINE

    # Check connection-status endpoint again
    status_resp2 = await client.get(f"/api/v1/agents/{agent_id}/connection-status")
    assert status_resp2.status_code == 200
    data2 = status_resp2.json()
    assert data2["connection_status"] == CONNECTION_ONLINE
    assert data2["last_heartbeat_at"] is not None


# ─────────────────────────────────────────────────────────────────────────────
# 3. Capability Synchronization Tests
# ─────────────────────────────────────────────────────────────────────────────

async def test_capability_synchronization(client: AsyncClient):
    """Verify external agent can report capabilities and update them idempotently."""
    onboard_res = await client.post(
        "/api/v1/agents/onboard",
        json={"name": "Cap Sync Agent", "description": "Tests capability sync", "owner_team": "Core"},
    )
    agent_info = onboard_res.json()
    agent_id = agent_info["agent_id"]
    api_key = agent_info["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    sync_payload = {
        "capabilities": [
            {
                "name": "read_customer_data",
                "resource_type": "DATABASE",
                "permission_level": "READ",
                "is_sensitive": True,
                "description": "Reads customer PII",
            },
            {
                "name": "send_slack_alert",
                "resource_type": "API",
                "permission_level": "EXECUTE",
                "is_sensitive": False,
                "description": "Posts to ops slack channel",
            }
        ]
    }

    # First sync: creates 2 capabilities
    sync_resp1 = await client.post(
        f"/api/v1/agents/{agent_id}/capabilities/sync",
        json=sync_payload,
        headers=headers,
    )
    assert sync_resp1.status_code == 200
    data1 = sync_resp1.json()
    assert data1["created_count"] == 2
    assert data1["synced_count"] == 2

    # Second sync with update: updates existing, creates 1 more
    sync_payload2 = {
        "capabilities": [
            {
                "name": "read_customer_data",
                "resource_type": "DATABASE",
                "permission_level": "READ",
                "is_sensitive": False,  # update flag
                "description": "Updated description",
            },
            {
                "name": "trigger_workflow",
                "resource_type": "API",
                "permission_level": "EXECUTE",
                "is_sensitive": False,
                "description": "Triggers execution workflow",
            }
        ]
    }

    sync_resp2 = await client.post(
        f"/api/v1/agents/{agent_id}/capabilities/sync",
        json=sync_payload2,
        headers=headers,
    )
    assert sync_resp2.status_code == 200
    data2 = sync_resp2.json()
    assert data2["created_count"] == 1
    assert data2["updated_count"] == 1

    # Verify via agent capabilities endpoint
    caps_list = (await client.get(f"/api/v1/agents/{agent_id}/capabilities")).json()
    names = [c["capability_name"] for c in caps_list]
    assert "read_customer_data" in names
    assert "send_slack_alert" in names
    assert "trigger_workflow" in names


# ─────────────────────────────────────────────────────────────────────────────
# 4. Telemetry Event Ingestion & Runtime Detection Tests
# ─────────────────────────────────────────────────────────────────────────────

async def test_runtime_processor_detects_undeclared_capability(client: AsyncClient):
    """Verify invoking an undeclared tool call generates an evidence-backed runtime finding."""
    onboard_res = await client.post(
        "/api/v1/agents/onboard",
        json={
            "name": "Scoped Worker Agent",
            "description": "Has limited tool access",
            "owner_team": "Support",
            "capabilities": [
                {
                    "name": "read_docs",
                    "resource_type": "FILE",
                    "permission_level": "READ",
                    "is_sensitive": False,
                }
            ]
        },
    )
    agent_info = onboard_res.json()
    agent_id = agent_info["agent_id"]
    api_key = agent_info["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # 1. Safe authorized tool call -> No detection
    safe_event = {
        "event_type": "TOOL_CALL_COMPLETED",
        "tool": "file_reader",
        "action": "read_docs",
        "resource_type": "FILE",
        "permission_level": "READ",
        "status": "SUCCESS",
    }
    r1 = await client.post(f"/api/v1/agents/{agent_id}/events", json=safe_event, headers=headers)
    assert r1.status_code == 200
    assert r1.json()["detection_triggered"] is False

    # 2. Undeclared tool execution -> Generates RUNTIME_VIOLATION finding
    unsafe_event = {
        "event_type": "TOOL_CALL_COMPLETED",
        "tool": "payment_gateway",
        "action": "disburse_unauthorized_funds",
        "resource_type": "PAYMENT",
        "permission_level": "EXECUTE",
        "status": "SUCCESS",
        "trace_id": "trace-viol-001",
        "metadata": {"amount": 5000, "currency": "USD"},
    }
    r2 = await client.post(f"/api/v1/agents/{agent_id}/events", json=unsafe_event, headers=headers)
    assert r2.status_code == 200
    res2 = r2.json()
    assert res2["detection_triggered"] is True
    assert res2["finding_id"] is not None

    # 3. Verify the finding in the findings database
    finding_resp = await client.get(f"/api/v1/findings/{res2['finding_id']}")
    assert finding_resp.status_code == 200
    finding = finding_resp.json()
    assert finding["source_type"] == "RUNTIME_DETECTION"
    assert finding["severity"] == "CRITICAL"
    assert "Undeclared" in finding["title"]
    assert "trace-viol-001" in finding["evidence"]
    # Verify no fabricated AttackExecution exists
    assert finding["execution"] is None


async def test_runtime_processor_detects_permission_exceedance(client: AsyncClient):
    """Verify requesting WRITE when only READ is declared triggers permission exceedance."""
    onboard_res = await client.post(
        "/api/v1/agents/onboard",
        json={
            "name": "Read-Only Database Agent",
            "description": "Strict read permissions",
            "owner_team": "Analytics",
            "capabilities": [
                {
                    "name": "analytics_query",
                    "resource_type": "DATABASE",
                    "permission_level": "READ",
                    "is_sensitive": False,
                }
            ]
        },
    )
    agent_info = onboard_res.json()
    agent_id = agent_info["agent_id"]
    api_key = agent_info["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    # Attempt WRITE on analytics_query
    exceedance_event = {
        "event_type": "TOOL_CALL_COMPLETED",
        "tool": "db_client",
        "action": "analytics_query",
        "resource_type": "DATABASE",
        "permission_level": "WRITE",
        "status": "SUCCESS",
        "trace_id": "trace-exceed-002",
    }
    resp = await client.post(f"/api/v1/agents/{agent_id}/events", json=exceedance_event, headers=headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["detection_triggered"] is True

    finding = (await client.get(f"/api/v1/findings/{res['finding_id']}")).json()
    assert "Permission Exceedance" in finding["title"]
    assert finding["source_type"] == "RUNTIME_DETECTION"


async def test_batch_event_ingestion_and_deduplication(client: AsyncClient):
    """Verify batch ingestion handles multiple events and deduplicates identical event IDs."""
    onboard_res = await client.post(
        "/api/v1/agents/onboard",
        json={"name": "Batch Telemetry Agent", "description": "Batch testing", "owner_team": "Core"},
    )
    agent_info = onboard_res.json()
    agent_id = agent_info["agent_id"]
    api_key = agent_info["api_key"]
    headers = {"Authorization": f"Bearer {api_key}"}

    batch_payload = {
        "events": [
            {
                "event_id": "batch-ev-001",
                "event_type": "AGENT_STARTED",
                "status": "SUCCESS",
            },
            {
                "event_id": "batch-ev-002",
                "event_type": "TOOL_CALL_COMPLETED",
                "tool": "test_tool",
                "action": "ping",
                "status": "SUCCESS",
            },
            {
                "event_id": "batch-ev-001",  # Duplicate event_id in same or subsequent batch
                "event_type": "AGENT_STARTED",
                "status": "SUCCESS",
            }
        ]
    }

    resp = await client.post(f"/api/v1/agents/{agent_id}/events/batch", json=batch_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["processed_count"] == 3

    # Query events list
    ev_list_resp = await client.get(f"/api/v1/agents/{agent_id}/events")
    assert ev_list_resp.status_code == 200
    ev_list = ev_list_resp.json()
    assert ev_list["total"] == 2  # Deduplicated in database!


# ─────────────────────────────────────────────────────────────────────────────
# 5. Observed Inter-Agent Relationships Tests
# ─────────────────────────────────────────────────────────────────────────────

async def test_observed_relationship_discovery(client: AsyncClient):
    """Verify that reporting an agent interaction dynamically discovers and labels an OBSERVED relationship."""
    onboard_a = (await client.post(
        "/api/v1/agents/onboard",
        json={"name": "Delegator Agent A", "description": "Sender", "owner_team": "Team A"},
    )).json()

    onboard_b = (await client.post(
        "/api/v1/agents/onboard",
        json={"name": "Worker Agent B", "description": "Receiver", "owner_team": "Team B"},
    )).json()

    agent_a_id = onboard_a["agent_id"]
    agent_b_id = onboard_b["agent_id"]
    key_a = onboard_a["api_key"]

    headers_a = {"Authorization": f"Bearer {key_a}"}

    # Agent A delegates a task to Agent B
    delegation_event = {
        "event_type": "AGENT_DELEGATION",
        "action": "execute_subtask",
        "target_agent_id": agent_b_id,
        "status": "SUCCESS",
        "metadata": {"task": "process_records"},
    }

    ev_resp = await client.post(
        f"/api/v1/agents/{agent_a_id}/events",
        json=delegation_event,
        headers=headers_a,
    )
    assert ev_resp.status_code == 200

    # Verify that relationship was created with OBSERVED provenance
    rels_resp = await client.get(f"/api/v1/agents/{agent_a_id}/relationships")
    assert rels_resp.status_code == 200
    rels = rels_resp.json()
    assert len(rels) >= 1
    rel = next((r for r in rels if r["target_agent_id"] == agent_b_id), None)
    assert rel is not None
    assert rel["provenance"] == "OBSERVED"
    assert rel["relationship_type"] == "DELEGATES"
    assert rel["interaction_count"] == 1

    # Verify blast radius graph includes this observed edge
    br_resp = await client.get(f"/api/v1/agents/{agent_a_id}/blast-radius")
    assert br_resp.status_code == 200
    br_data = br_resp.json()
    edge = next((e for e in br_data["edges"] if e["target"] == agent_b_id), None)
    assert edge is not None
    assert edge["provenance"] == "OBSERVED"

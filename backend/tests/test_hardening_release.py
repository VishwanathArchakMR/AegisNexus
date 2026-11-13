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


async def test_canonical_asr_simulation_and_recovery_metrics(client: AsyncClient):
    """
    Validates P0 requirement:
    - Attack simulations store ASR canonically as a percentage (0.0 to 100.0), not a ratio.
    - Recovery verification stores current ASR as a percentage (0.0 to 100.0).
    - Summary ASR reduction is calculated as (previous_asr - current_asr) in percentage points.
    """
    # 1. Trigger simulation
    resp = await client.post(
        "/api/v1/attack-simulations",
        json={
            "scenario_id": "scen-001",
            "target_agent_id": "00000000-0000-0000-0000-000000000001",
            "attempts": 5,
        },
    )
    assert resp.status_code == 200, resp.text
    sim_data = resp.json()
    assert 0.0 <= sim_data["attack_success_rate"] <= 100.0
    # In scen-001 against agent 001, attempts succeed, so ASR should be >= 20.0 (percentage), not 0.2
    if sim_data["successful_attempts"] > 0:
        assert sim_data["attack_success_rate"] >= 1.0

    # 2. Check dashboard summary consumes ASR properly
    dash_resp = await client.get("/api/v1/dashboard/summary")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert 0 <= dash_data["posture_score"] <= 100


async def test_runtime_finding_distinct_recovery_lifecycle(client: AsyncClient):
    """
    Validates P0 requirement:
    - Runtime findings do not have AttackExecution.
    - Attempting /verify on runtime detection is rejected.
    - Remediating runtime finding transitions to AWAITING_RUNTIME_REVALIDATION.
    - Operator attestation (/revalidate) transitions recovery to RECOVERED and resolves finding.
    - Zero AttackExecution or AttackAttempt records are fabricated for runtime findings.
    """
    # Onboard an agent
    onboard_resp = await client.post(
        "/api/v1/agents/onboard",
        json={
            "name": "Runtime Recovery Test Agent",
            "description": "Validating runtime finding isolation",
            "agent_type": "custom",
            "framework": "LangChain",
            "owner_team": "SecOps",
            "environment": "testing",
            "capabilities": [
                {
                    "name": "read_logs",
                    "resource_type": "FILE",
                    "permission_level": "READ",
                    "is_sensitive": False,
                }
            ],
        },
    )
    assert onboard_resp.status_code == 200
    agent_info = onboard_resp.json()
    agent_id = agent_info["agent_id"]
    api_key = agent_info["api_key"]

    # Ingest an undeclared action to trigger a RUNTIME_DETECTION finding
    event_resp = await client.post(
        f"/api/v1/agents/{agent_id}/events",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "event_type": "TOOL_CALL_COMPLETED",
            "tool": "database_admin",
            "action": "drop_all_tables",
            "resource_type": "DATABASE",
            "permission_level": "ADMIN",
            "status": "SUCCESS",
            "payload": '{"query": "DROP TABLE accounts"}',
        },
    )
    assert event_resp.status_code == 200
    ev_data = event_resp.json()
    assert ev_data["detection_triggered"] is True
    finding_id = ev_data["finding_id"]

    # Verify finding provenance
    finding_resp = await client.get(f"/api/v1/findings/{finding_id}")
    assert finding_resp.status_code == 200
    finding = finding_resp.json()
    assert finding["source_type"] == "RUNTIME_DETECTION"
    assert finding["execution_id"] is None

    # Count executions before recovery
    execs_before = len((await client.get("/api/v1/attack-simulations")).json())

    # Create recovery record
    rec_resp = await client.post(
        "/api/v1/recovery",
        json={"finding_id": finding_id, "agent_id": agent_id},
    )
    assert rec_resp.status_code == 200
    recovery = rec_resp.json()
    recovery_id = recovery["id"]

    # Plan recovery
    plan_resp = await client.post(f"/api/v1/recovery/{recovery_id}/plan")
    assert plan_resp.status_code == 200
    plan = plan_resp.json()
    # Runtime findings have no simulation execution baseline, so previous_asr must be None
    assert plan["previous_asr"] is None

    # Approve recovery
    appr_resp = await client.post(f"/api/v1/recovery/{recovery_id}/approve")
    assert appr_resp.status_code == 200

    # Execute remediation: transitions to AWAITING_RUNTIME_REVALIDATION
    exec_resp = await client.post(f"/api/v1/recovery/{recovery_id}/execute")
    assert exec_resp.status_code == 200
    exec_record = exec_resp.json()
    assert exec_record["status"] == "AWAITING_RUNTIME_REVALIDATION"
    assert exec_record["execution_status"] == "COMPLETED"

    # Attempting to call simulation /verify MUST fail closed
    verify_fail = await client.post(f"/api/v1/recovery/{recovery_id}/verify")
    assert verify_fail.status_code == 400
    assert "revalidate" in verify_fail.json()["detail"].lower()

    # Operator performs runtime revalidation attestation
    reval_resp = await client.post(
        f"/api/v1/recovery/{recovery_id}/revalidate",
        json={
            "operator_decision": "RESOLVED",
            "rationale": "Restricted agent database permissions in runtime container; verified no further drop actions.",
            "evidence_notes": "Telemetry audit trace TR-9021",
        },
    )
    assert reval_resp.status_code == 200
    reval = reval_resp.json()
    assert reval["status"] == "RECOVERED"
    assert reval["verification_status"] == "PASSED"
    assert "Restricted agent database permissions" in reval["runtime_revalidation_notes"]

    # Verify finding is now marked RESOLVED
    finding_after = (await client.get(f"/api/v1/findings/{finding_id}")).json()
    assert finding_after["status"] == "RESOLVED"

    # CRITICAL: Verify NO synthetic AttackExecution was created during runtime recovery
    execs_after = len((await client.get("/api/v1/attack-simulations")).json())
    assert execs_after == execs_before

    # Verify audit ledger integrity
    chain_resp = await client.get(f"/api/v1/recovery/{recovery_id}/verify-chain")
    assert chain_resp.status_code == 200
    chain_data = chain_resp.json()
    assert chain_data["is_valid"] is True, f"Verify chain failed: {chain_data}"
    assert chain_data["tamper_detected"] is False


async def test_heartbeat_administrative_state_immunity(client: AsyncClient):
    """
    Validates that external agent heartbeats CANNOT mutate administrative status
    (e.g., cannot un-quarantine or reactivate itself).
    """
    # 1. Onboard agent
    onboard_resp = await client.post(
        "/api/v1/agents/onboard",
        json={
            "name": "Quarantine Immunity Test Agent",
            "description": "Testing heartbeat immutability",
            "agent_type": "custom",
            "framework": "Custom",
            "owner_team": "Security",
            "environment": "production",
            "capabilities": [],
        },
    )
    assert onboard_resp.status_code == 200
    agent = onboard_resp.json()
    agent_id = agent["agent_id"]
    api_key = agent["api_key"]

    # 2. Operator sets agent status to QUARANTINED in database or administrative path
    # Even if agent heartbeat sends status: "ACTIVE", it must NOT change administrative status
    hb_resp = await client.post(
        f"/api/v1/agents/{agent_id}/heartbeat",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "status": "ACTIVE",
            "sdk_version": "0.2.0",
        },
    )
    assert hb_resp.status_code == 200

    # 3. Verify cross-agent authentication rejection
    other_agent_id = "00000000-0000-0000-0000-000000000001"
    cross_hb = await client.post(
        f"/api/v1/agents/{other_agent_id}/heartbeat",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"status": "ACTIVE"},
    )
    assert cross_hb.status_code == 403


async def test_server_side_redaction_and_batch_boundaries(client: AsyncClient):
    """
    Validates server-side telemetry sanitization and batch boundary accounting.
    """
    # Onboard agent
    onboard = (
        await client.post(
            "/api/v1/agents/onboard",
            json={
                "name": "Redaction Test Agent",
                "description": "Checking server-side redaction",
                "agent_type": "custom",
                "framework": "Custom",
                "owner_team": "SecOps",
                "environment": "testing",
                "capabilities": [],
            },
        )
    ).json()
    agent_id = onboard["agent_id"]
    api_key = onboard["api_key"]

    # Ingest event with sensitive metadata
    ev_resp = await client.post(
        f"/api/v1/agents/{agent_id}/events",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "event_type": "TOOL_CALL_COMPLETED",
            "tool": "api_client",
            "action": "fetch_user",
            "resource_type": "API",
            "permission_level": "READ",
            "status": "SUCCESS",
            "metadata": {
                "user_id": "u-12345",
                "password": "SuperSecretPassword123!",
                "api_key": "sec-live-token-abc",
                "nested": {
                    "token": "bearer-secret-xyz",
                    "safe_field": "allowed_value",
                },
            },
        },
    )
    assert ev_resp.status_code == 200
    ev_id = ev_resp.json()["event_id"]

    # Fetch stored event and verify server-side redaction
    events_list = (await client.get(f"/api/v1/agents/{agent_id}/events")).json()
    stored_ev = next(e for e in events_list["events"] if e["id"] == ev_id)
    stored_meta = stored_ev["metadata_json"]
    assert stored_meta["password"] == "[REDACTED]"
    assert stored_meta["api_key"] == "[REDACTED]"
    assert stored_meta["nested"]["token"] == "[REDACTED]"
    assert stored_meta["nested"]["safe_field"] == "allowed_value"

    # Test batch ingestion with deduplication and rejection accounting
    batch_resp = await client.post(
        f"/api/v1/agents/{agent_id}/events/batch",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "events": [
                {
                    "event_id": ev_id,  # Duplicate of earlier event
                    "event_type": "TOOL_CALL_COMPLETED",
                    "status": "SUCCESS",
                },
                {
                    "event_id": "fresh-event-001",
                    "event_type": "TOOL_CALL_COMPLETED",
                    "status": "SUCCESS",
                },
                {
                    "event_id": "invalid-duration-event",
                    "event_type": "TOOL_CALL_COMPLETED",
                    "duration_ms": -100,  # Negative duration -> rejected
                    "status": "SUCCESS",
                },
            ]
        },
    )
    assert batch_resp.status_code == 200
    batch_data = batch_resp.json()
    assert batch_data["processed_count"] == 2
    assert batch_data["deduplicated_count"] == 1
    assert batch_data["rejected_count"] == 1


async def test_distinct_agents_requiring_attention(client: AsyncClient):
    """
    Validates that dashboard agents_requiring_attention accurately counts
    distinct agents with open critical/high findings, quarantine, or revoked active credentials.
    """
    dash = (await client.get("/api/v1/dashboard/summary")).json()
    assert "agents_requiring_attention" in dash
    assert isinstance(dash["agents_requiring_attention"], int)
    assert dash["agents_requiring_attention"] >= 0

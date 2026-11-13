import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.recovery import RecoveryRecord, RecoveryEvent
from app.services.recovery_engine import RecoveryEngine
from app.simulation.seed_data import CUSTOMER_SUPPORT_ID

pytestmark = pytest.mark.asyncio


async def test_ledger_hash_chain_validity(client: AsyncClient):
    """Verify that legitimate recovery operations form a valid, verifiable hash chain."""
    # 1. Run simulation to get a finding
    sim_resp = await client.post(
        "/api/v1/attack-simulations",
        json={"scenario_id": "scen-002", "target_agent_id": CUSTOMER_SUPPORT_ID, "attempts": 3},
    )
    assert sim_resp.status_code == 200

    findings = (await client.get(f"/api/v1/findings?agent_id={CUSTOMER_SUPPORT_ID}")).json()
    assert len(findings) > 0
    finding_id = findings[0]["id"]

    # 2. Create recovery record
    rec_resp = await client.post("/api/v1/recovery", json={"finding_id": finding_id, "agent_id": CUSTOMER_SUPPORT_ID})
    rec_id = rec_resp.json()["id"]

    # 3. Create plan and approve
    await client.post(f"/api/v1/recovery/{rec_id}/plan")
    await client.post(f"/api/v1/recovery/{rec_id}/approve")

    # 4. Fetch events
    events = (await client.get(f"/api/v1/recovery/{rec_id}/events")).json()
    assert len(events) >= 3
    for ev in events:
        assert ev["event_hash"] is not None
        assert ev["previous_hash"] is not None
        assert len(ev["event_hash"]) == 64

    # 5. Verify chain via endpoint
    verify_resp = await client.get(f"/api/v1/recovery/{rec_id}/verify-chain")
    assert verify_resp.status_code == 200
    chain_info = verify_resp.json()
    assert chain_info["is_valid"] is True, f"Chain invalid: {chain_info}"
    assert chain_info["tamper_detected"] is False
    assert chain_info["first_invalid_event_id"] is None
    assert chain_info["total_events"] >= 3


async def _get_or_create_recovery_record(client: AsyncClient) -> str:
    records = (await client.get("/api/v1/recovery")).json()
    if records:
        return records[0]["id"]
    await client.post(
        "/api/v1/attack-simulations",
        json={"scenario_id": "scen-002", "target_agent_id": CUSTOMER_SUPPORT_ID, "attempts": 3},
    )
    findings = (await client.get(f"/api/v1/findings?agent_id={CUSTOMER_SUPPORT_ID}")).json()
    rec_resp = await client.post("/api/v1/recovery", json={"finding_id": findings[0]["id"], "agent_id": CUSTOMER_SUPPORT_ID})
    rec_id = rec_resp.json()["id"]
    await client.post(f"/api/v1/recovery/{rec_id}/plan")
    await client.post(f"/api/v1/recovery/{rec_id}/approve")
    return rec_id


async def test_ledger_detects_tampered_event_content(client: AsyncClient):
    """Verify that modifying an event's payload is detected by verify_chain."""
    rec_id = await _get_or_create_recovery_record(client)

    # Fetch events
    events = (await client.get(f"/api/v1/recovery/{rec_id}/events")).json()
    assert len(events) >= 1
    target_event_id = events[0]["id"]

    # Simulate unauthorized tamper directly in the database
    from tests.conftest import TestSessionLocal
    async with TestSessionLocal() as session:
        ev = await session.get(RecoveryEvent, target_event_id)
        if ev:
            ev.message = "TAMPERED: Unauthorized modification of audit log"
            await session.commit()

    # Chain verification must now detect tamper
    verify_resp = await client.get(f"/api/v1/recovery/{rec_id}/verify-chain")
    assert verify_resp.status_code == 200
    chain_info = verify_resp.json()
    assert chain_info["is_valid"] is False
    assert chain_info["tamper_detected"] is True
    assert chain_info["first_invalid_event_id"] == target_event_id
    assert "mismatch" in chain_info["reason"].lower()


async def test_ledger_detects_broken_hash_link(client: AsyncClient):
    """Verify that altering previous_hash breaks the chain and is detected."""
    rec_id = await _get_or_create_recovery_record(client)

    # Fetch events
    events = (await client.get(f"/api/v1/recovery/{rec_id}/events")).json()
    assert len(events) >= 2
    second_event_id = events[1]["id"]
    from tests.conftest import TestSessionLocal
    async with TestSessionLocal() as session:
        ev = await session.get(RecoveryEvent, second_event_id)
        if ev:
            ev.previous_hash = "0" * 64
            await session.commit()

    verify_resp = await client.get(f"/api/v1/recovery/{rec_id}/verify-chain")
    assert verify_resp.status_code == 200
    chain_info = verify_resp.json()
    assert chain_info["is_valid"] is False
    assert chain_info["tamper_detected"] is True

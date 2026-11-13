import pytest
from aegisnexus_sdk.client import AegisNexusClient


def test_track_tool_call_success():
    client = AegisNexusClient(
        base_url="http://localhost:8000",
        agent_id="test-agent",
        api_key="test-key",
        fail_open=True,
    )

    with client.track_tool_call(
        tool="test_db",
        action="read_record",
        resource_type="DATABASE",
        permission_level="READ",
    ):
        result = 10 + 20

    assert result == 30
    assert not client._event_queue.empty()
    event = client._event_queue.get_nowait()
    assert event.tool == "test_db"
    assert event.action == "read_record"
    assert event.status == "SUCCESS"
    assert event.duration_ms is not None
    assert event.duration_ms >= 0


def test_track_tool_call_failure():
    client = AegisNexusClient(
        base_url="http://localhost:8000",
        agent_id="test-agent",
        api_key="test-key",
        fail_open=True,
    )

    with pytest.raises(ValueError):
        with client.track_tool_call(
            tool="test_payment",
            action="charge",
            resource_type="PAYMENT",
            permission_level="EXECUTE",
        ):
            raise ValueError("Payment gateway timed out")

    assert not client._event_queue.empty()
    event = client._event_queue.get_nowait()
    assert event.tool == "test_payment"
    assert event.action == "charge"
    assert event.status == "FAILURE"
    assert event.metadata.get("error_type") == "ValueError"


def test_decorator_instrumentation():
    client = AegisNexusClient(
        base_url="http://localhost:8000",
        agent_id="test-agent",
        api_key="test-key",
    )

    @client.instrument_tool(
        tool="math_tool",
        action="multiply",
        resource_type="API",
        permission_level="READ",
    )
    def multiply(a: int, b: int) -> int:
        return a * b

    res = multiply(6, 7)
    assert res == 42
    assert not client._event_queue.empty()
    ev = client._event_queue.get_nowait()
    assert ev.tool == "math_tool"
    assert ev.action == "multiply"
    assert ev.status == "SUCCESS"


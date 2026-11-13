import os
import pytest
from aegisnexus_sdk.client import AegisNexusClient
from aegisnexus_sdk.exceptions import ConfigurationError


def test_missing_config_raises_error():
    with pytest.raises(ConfigurationError):
        AegisNexusClient(base_url="", agent_id="123", api_key="abc")

    with pytest.raises(ConfigurationError):
        AegisNexusClient(base_url="http://localhost:8000", agent_id="", api_key="abc")

    with pytest.raises(ConfigurationError):
        AegisNexusClient(base_url="http://localhost:8000", agent_id="123", api_key="")


def test_from_env(monkeypatch):
    monkeypatch.setenv("AEGISNEXUS_BASE_URL", "http://test-server:9000")
    monkeypatch.setenv("AEGISNEXUS_AGENT_ID", "env-agent-001")
    monkeypatch.setenv("AEGISNEXUS_API_KEY", "env-api-key-xyz")
    monkeypatch.setenv("AEGISNEXUS_HEARTBEAT_INTERVAL", "15.0")

    client = AegisNexusClient.from_env()
    assert client.base_url == "http://test-server:9000"
    assert client.agent_id == "env-agent-001"
    assert client.api_key == "env-api-key-xyz"
    assert client.heartbeat_interval == 15.0


def test_queue_overflow_bounding():
    # Test queue bounding to prevent memory leaks
    client = AegisNexusClient(
        base_url="http://localhost:8000",
        agent_id="test-agent",
        api_key="test-key",
        max_queue_size=5,
    )

    from aegisnexus_sdk.models import TelemetryEvent
    for i in range(10):
        client.emit_event(TelemetryEvent(event_type=f"EVENT_{i}"))

    # Queue should be bounded to max_queue_size
    assert client._event_queue.qsize() == 5


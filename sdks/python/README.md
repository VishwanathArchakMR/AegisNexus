# AegisNexus Python SDK (`aegisnexus-sdk`)

**AegisNexus SDK** connects independently running AI agents to the **AegisNexus** security, governance, and verifiable recovery platform.

It provides automated heartbeats, tool-call tracking, capability synchronization, inter-agent delegation reporting, and sensitive data redaction with minimal code overhead.

---

## 1. Installation

Install the package directly into your agent's environment:

```bash
pip install aegisnexus-sdk
```

Or for local development / editable installation:

```bash
pip install -e ./sdks/python
```

---

## 2. Quickstart

```python
from aegisnexus_sdk import AegisNexusClient

# 1. Initialize client (reads AEGISNEXUS_AGENT_ID, AEGISNEXUS_API_KEY from environment)
client = AegisNexusClient.from_env()

# 2. Start background heartbeat daemon and telemetry flush worker
client.start()

# 3. Synchronize declared agent capabilities
client.report_capabilities([
    {
        "name": "query_customer_database",
        "resource_type": "DATABASE",
        "permission_level": "READ",
        "is_sensitive": True,
        "description": "Reads customer CRM records",
    },
    {
        "name": "send_email_notification",
        "resource_type": "EMAIL",
        "permission_level": "EXECUTE",
        "is_sensitive": False,
        "description": "Sends customer support emails",
    }
])

# 4. Instrument a tool call using the Context Manager
with client.track_tool_call(
    tool="customer_crm",
    action="query_customer_database",
    resource_type="DATABASE",
    permission_level="READ",
):
    # Your agent's normal tool execution
    records = {"user_id": 1234, "status": "active"}

# 5. Instrument a tool call using the Decorator
@client.instrument_tool(
    tool="email_gateway",
    action="send_email_notification",
    resource_type="EMAIL",
    permission_level="EXECUTE",
)
def send_email(to: str, message: str):
    return True

send_email("user@example.com", "Ticket resolved.")

# 6. Report inter-agent delegation / interaction
client.report_interaction(
    target_agent_id="00000000-0000-0000-0000-000000000002",
    interaction_type="DELEGATES",
    action="request_financial_reconciliation",
    status="SUCCESS",
)

# 7. Stop client cleanly on shutdown
client.stop()
```

---

## 3. Configuration & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `AEGISNEXUS_BASE_URL` | `http://localhost:8000` | Backend API URL of AegisNexus |
| `AEGISNEXUS_AGENT_ID` | *(Required)* | Agent UUID issued during dashboard onboarding |
| `AEGISNEXUS_API_KEY` | *(Required)* | Secure one-time integration token |
| `AEGISNEXUS_HEARTBEAT_INTERVAL` | `30.0` | Heartbeat frequency in seconds |
| `AEGISNEXUS_FAIL_OPEN` | `true` | If true, network errors will not crash your agent |

---

## 4. Privacy & Sensitive Data Minimization

The SDK automatically sanitizes and redacts common sensitive keys (passwords, tokens, API keys, private keys, SSNs, credit card numbers) before metadata is transmitted. Raw prompts and complete model outputs are never captured by default.

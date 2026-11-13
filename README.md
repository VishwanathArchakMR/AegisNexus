# AegisNexus 2.0

**Continuous Adversarial Security, Runtime Governance, and Verifiable Recovery Platform for Autonomous AI Agents.**

```
DISCOVER & ONBOARD → SYNC CAPABILITIES → RUNTIME TELEMETRY → ADVERSARIAL EVALUATION → DETECT RISKS → REMEDIATE → REVALIDATE → HASH-CHAINED AUDIT LEDGER
```

AegisNexus is an enterprise security control plane built to monitor, govern, adversarially evaluate, and remediate autonomous AI agents across their complete operational lifecycle. It supports both **internally modeled agents** and **independently running external AI agents** integrated via the official Python SDK.

---

## Key Capabilities & Architectural Pillars

### 1. External Agent Onboarding & Continuous Telemetry
- **Dashboard Onboarding Wizard:** First-class "Add External Agent" workflow generating high-entropy API keys (stored only as salted SHA-256 hashes).
- **Official Python SDK (`aegisnexus_sdk`):** Lightweight, asynchronous, thread-safe client with background heartbeat daemon, batched event ingestion, and dropped event monitoring (`dropped_events_count`).
- **Telemetry Instrumentation:** Decorator (`@client.instrument_tool`) and context manager (`with client.track_tool_call(...)`) to capture tool executions, parameters, inter-agent delegations, and execution durations.
- **Bi-Level Telemetry Redaction:** Client-side and server-side recursive redaction stripping passwords, API keys, bearer tokens, credit cards, and private credentials before storage.
- **Real-Time Runtime Intelligence:** Automatic runtime detection for undeclared tool usage, privilege escalation, abnormal error surges, and dynamic relationship discovery.

### 2. Standardized Canonical ASR & Posture Metrics
- **Canonical ASR Representation:** Attack Success Rate (ASR) is strictly modeled, stored, and exchanged as a percentage float between `0.0` and `100.0`.
- **Positive ASR Reduction:** Remediation efficacy is calculated as positive percentage points (`previous_asr - current_asr`, e.g. `60.0% → 0.0% (+60.0 pts)`).
- **Non-Conflated Posture Scoring:** Posture calculations accurately weigh high-risk findings, compliance pass ratios, and empirical vulnerability test results without unit mismatch or double-scaling bugs.

### 3. Distinct Remediation Lifecycles
- **Simulated Vulnerability Lifecycle:**
  `OPEN` → `PLANNED` → `APPROVED` → `EXECUTING` → `VERIFIED` / `RECOVERED`
  Simulated findings verify remediation by re-executing the original attack scenario against the hardened agent profile, recording empirical ASR reduction.
- **Runtime Anomaly Lifecycle:**
  `OPEN` → `PLANNED` → `APPROVED` → `EXECUTING` → `AWAITING_RUNTIME_REVALIDATION` → `REVALIDATED`
  Runtime detections (e.g. undeclared capability access, abnormal communication paths) require real-world validation. AegisNexus explicitly forbids arbitrary fallback simulations or fabricated attack attempts. Operators submit cryptographic attestation evidence via `/api/v1/recovery/{id}/revalidate`.

### 4. Cryptographic SHA-256 Hash-Chained Audit Ledger
- Immutable recovery audit ledger where each event is cryptographically linked to the previous event (`previous_hash` + SHA-256 digest of record payload).
- Independent tamper detection verifying ledger integrity across the entire timeline (`/api/v1/recovery/ledger/verify`).

### 5. Blast Radius Graph & Compliance Control
- **Interactive Blast Radius Canvas:** React Flow directed graph visualizing direct dependencies, credential sharing, and transitive downstream compromise impact.
- **Compliance Framework Alignment:** Automated mapping and assessment against OWASP Top 10 for LLMs, NIST AI RMF, and SOC 2 Trust Services Criteria.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, React Flow, TanStack Query, Axios, Lucide Icons, Tailwind CSS |
| **Backend API** | FastAPI, Python 3.11+, SQLAlchemy 2.x (asyncio), Pydantic v2, Uvicorn |
| **Database & Migrations** | SQLite (via `aiosqlite`) / PostgreSQL-ready, Alembic linear migration chain |
| **Client SDK** | Python 3.9+, HTTPX, Threading, Batch Queueing, Sensitive Field Redaction |

---

## Database Migrations (Alembic)

AegisNexus maintains a clean, linear, version-controlled database migration chain:

```
<base>
  └── 001_initial_schema (Initial baseline schema)
        └── 002_external_agent_monitoring (External agent telemetry & fields)
              └── 003_canonical_asr_and_runtime_recovery (Canonical ASR & runtime revalidation notes)
```

To run migrations:
```powershell
# Windows
.\backend\.venv\Scripts\alembic -c backend\alembic.ini upgrade head

# Linux / macOS
alembic -c backend/alembic.ini upgrade head
```

---

## Quickstart & Local Setup

### Prerequisites
- Python 3.11 or higher
- Node.js 18 or 20
- npm 9+

### 1. Backend Setup

```powershell
# Navigate to backend
cd backend

# Create & activate virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt -r requirements-dev.txt

# Run database migrations
alembic -c alembic.ini upgrade head

# Start API server (port 8000)
uvicorn app.main:app --reload --port 8000
```

*(On Linux/macOS, use `source .venv/bin/activate`)*

- API Base URL: `http://localhost:8000`
- Swagger UI / Interactive Docs: `http://localhost:8000/api/docs`
- Health Check: `http://localhost:8000/api/v1/health`
- Readiness Check: `http://localhost:8000/api/v1/readiness`

### 2. Frontend Setup

```powershell
# Open a new terminal and navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

- Web Dashboard: `http://localhost:5173`

---

## External Agent Integration Guide

### 1. Onboard Agent via Dashboard
1. Open `http://localhost:5173/agents`.
2. Click **Add External Agent**.
3. Fill in agent details: Name, Framework (e.g. LangChain, CrewAI, AutoGen, Custom), Environment, and initial declared capabilities.
4. Securely copy the generated **API Key** and **Agent ID**.

### 2. Install & Configure the Python SDK

Install the SDK in your agent's environment:
```bash
pip install -e sdks/python
```

Configure your agent:
```python
import os
from aegisnexus_sdk import AegisNexusClient, CapabilityDeclaration

client = AegisNexusClient(
    endpoint=os.getenv("AEGISNEXUS_ENDPOINT", "http://localhost:8000/api/v1"),
    agent_id=os.getenv("AEGISNEXUS_AGENT_ID"),
    api_key=os.getenv("AEGISNEXUS_API_KEY"),
    heartbeat_interval=15,  # Background heartbeat interval in seconds
    fail_open=True,         # Ensures agent operations continue even if security plane is unreachable
)

# Start background heartbeat daemon
client.start()

# Register declared capabilities
client.report_capabilities([
    CapabilityDeclaration(
        name="lookup_customer",
        resource_type="DATABASE",
        permission_level="READ",
        is_sensitive=False,
        description="Reads customer profiles",
    ),
    CapabilityDeclaration(
        name="refund_payment",
        resource_type="PAYMENT",
        permission_level="WRITE",
        is_sensitive=True,
        description="Issues transaction refunds",
    ),
])
```

### 3. Instrument Tool Executions

**Using Decorator:**
```python
@client.instrument_tool(
    name="lookup_customer",
    resource_type="DATABASE",
    permission_level="READ",
)
def fetch_customer(customer_id: str):
    return db.query(customer_id)
```

**Using Context Manager:**
```python
with client.track_tool_call(
    tool_name="refund_payment",
    resource_type="PAYMENT",
    permission_level="WRITE",
    is_sensitive=True,
    parameters={"customer_id": "cust_123", "amount": 49.99},
) as tracker:
    result = payment_gateway.refund(customer_id, amount)
    tracker.set_result(result)
```

### 4. Run the Runnable Reference Agent

A fully runnable standalone reference agent is provided:
```powershell
# Set environment variables
$env:AEGISNEXUS_AGENT_ID="<YOUR_AGENT_ID>"
$env:AEGISNEXUS_API_KEY="<YOUR_API_KEY>"

# Run example agent
python examples/external_agent/agent.py
```

---

## Test Suites & Quality Verification

### Run Backend Tests (52 tests):
```powershell
cd backend
.\.venv\Scripts\pytest tests/ -v
```

### Run SDK Tests (7 tests):
```powershell
cd sdks/python
pytest tests/ -v
```

### Run Frontend Typecheck & Production Build:
```powershell
cd frontend
npm run typecheck
npm run build
```

---

## Enterprise Hardening Highlights

- **Administrative Immunity:** Heartbeat endpoints update connectivity state only; agents cannot modify their own status (`ACTIVE`, `INACTIVE`, `QUARANTINED`) or trust level.
- **Server-Side Bounds:** Enforced event duration clamping (0–3600s), future timestamp rejection (< +60s), and batch size limits.
- **Queue Overflow Telemetry:** When bounded memory buffers overflow under network partition, `dropped_events_count` provides operators transparent loss metrics.
- **Operator Authorization:** Sensitive control plane operations (`/register`, `/attack-simulations`, `/revalidate`, `/assessments`) require operator access scopes.
- **Pristine Production Build:** Zero TypeScript warnings, zero compilation errors, and complete Settings UI replacing all legacy stubs.

---

## License

Distributed under the Apache 2.0 License. See `LICENSE` for details.

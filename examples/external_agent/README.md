# AegisNexus 2.0 — Reference External Agent Integration

This directory contains a complete, runnable demonstration of an external AI agent integrated with AegisNexus using the official Python SDK (`aegisnexus_sdk`).

---

## 🚀 Quickstart Guide

### Step 1: Onboard the Agent in AegisNexus Dashboard

1. Start the AegisNexus backend and frontend:
   ```bash
   # Backend:
   cd backend
   uvicorn app.main:app --reload --port 8000

   # Frontend:
   cd frontend
   npm run dev
   ```
2. Navigate to **Agent Inventory** (`http://localhost:5173/agents`).
3. Click the **"Add External Agent"** button in the top right.
4. Complete the 4-stage wizard:
   - **Stage 1 (Agent Info):**
     - Name: `Billing Automation Agent`
     - Framework: `LangChain`
     - Environment: `production`
   - **Stage 2 (Security Profile):**
     - Add declared capabilities: `lookup_customer`, `calculate_tax`, `process_subscription_refund`.
   - **Stage 3 (Credentials):**
     - AegisNexus generates an Agent ID and a secure plaintext API key (shown only once).
     - Copy both values.
   - **Stage 4 (Integration Guide):**
     - Review the SDK setup snippets and test instructions.

---

### Step 2: Configure Environment Variables

In this directory (`examples/external_agent/`), copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Agent ID and API Key:

```env
AEGISNEXUS_ENDPOINT=http://localhost:8000/api/v1
AEGISNEXUS_AGENT_ID=your-agent-uuid-here
AEGISNEXUS_API_KEY=anx_live_your_api_key_here
```

---

### Step 3: Run the Agent

Run the reference agent script:

```bash
python agent.py
```

---

### Step 4: Observe Continuous Runtime Monitoring in AegisNexus

While the agent runs, check the AegisNexus Dashboard:

1. **Agent Inventory (`/agents`)**:
   - The agent displays an active **ONLINE** indicator (green badge).
   - Its framework (`LangChain`), environment (`production`), and event counters are updated in real-time.
2. **Agent Detail (`/agents/<id>`)**:
   - **Connection Health Card**: Shows Heartbeat Interval, Last Heartbeat timestamp, and current connection status.
   - **Live Activity Timeline**: Shows all tool calls, start/completed timestamps, durations, and sanitised metadata.
   - **Credentials Management**: View API key status (`ACTIVE`), rotate keys, or revoke keys directly from the UI.
   - **Capabilities**: View declared capabilities with `SELF_REPORTED` or `OBSERVED` provenance.
3. **Security Findings (`/findings`)**:
   - Notice the **Runtime Security Finding** triggered by the agent attempting to execute `dump_database_backup` (an undeclared sensitive tool).
   - The finding links directly to the originating telemetry event and detection rule without fabricating fake attack simulations.
4. **Blast Radius Graph (`/blast-radius`)**:
   - Observe the dynamic edge between your external agent and the Customer Support agent, marked with `OBSERVED` provenance and call counter.

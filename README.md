# AegisNexus

**Continuous adversarial security, governance, and recovery platform for AI agents.**

```
DISCOVER → MAP BLAST RADIUS → ATTACK → COLLECT EVIDENCE → FIND → REMEDIATE → RETEST → VERIFY → SEAL
```

AegisNexus answers four critical enterprise security questions:
1. **What AI agents exist** across an organization, and what trust tiers, capabilities, and credentials do they hold?
2. **What could each agent access or impact if compromised** (Blast Radius analysis across inter-agent delegation and sensitive tools)?
3. **Has the agent been adversarially tested** against prompt injection, privilege escalation, PII exfiltration, and tool misuse?
4. **Is the agent compliant** with industry security standards (OWASP Top 10 for LLMs, NIST AI RMF, SOC 2), and can remediation be verifiably tracked?

---

## Architecture Overview

- **Frontend**: React 18, TypeScript, Vite, ReactFlow graph canvas, TanStack Query, and a high-contrast dark cybersecurity design system.
- **Backend API**: FastAPI with asynchronous SQLAlchemy ORM, centralized error handling, and structured logging.
- **Engines & Services**:
  - `BlastRadiusService`: Breadth-first graph traversal of upstream and downstream relationships and capability-based impact scoring.
  - `AttackEngine` & `SimulationService`: Deterministic adversarial evaluation testing agents across multiple attempts with automated finding generation.
  - `ComplianceEngine`: Automated auditing across OWASP Top 10 for LLMs, NIST AI RMF, and SOC 2 Trust Services Criteria.
  - `RecoveryEngine`: Multi-stage remediation lifecycle (`OPEN` → `PLANNED` → `APPROVED` → `EXECUTING` → `VERIFIED`/`RECOVERED`) with empirical verification re-testing.
- **Persistence**: Zero-setup local SQLite via `aiosqlite` (`backend/aegisnexus.db`) with configurable `DATABASE_URL` (PostgreSQL ready).

---

## 3–5 Minute End-to-End Demonstration Sequence

Follow this sequence to demonstrate the complete workflow:

1. **Dashboard & Posture Overview** (`/dashboard`):
   - View seeded security posture, active agent counts, total capabilities, open vulnerabilities, and real-time posture score.
2. **Agent Inventory & Detail** (`/agents`):
   - Browse the 4 seeded agents (Customer Support, Finance, Research, Internal Operations).
   - Click into **Customer Support Agent** or **Finance Agent** to inspect granular permissions, sensitive credentials, and inbound/outbound communication links.
3. **Interactive Blast Radius** (`/blast-radius`):
   - Select **Customer Support Agent** or **Finance Agent** in the dropdown.
   - Inspect the interactive ReactFlow canvas visualizing direct connections, credential sharing, and transitive downstream systems that could be affected if compromised.
4. **Adversarial Attack Lab** (`/attack-simulation`):
   - Select **Customer Support Agent** and **Customer PII Exfiltration (scen-002)** with 5 attempts.
   - Click **Launch Simulation**. The execution runs deterministically, logging individual attempts, observed behaviors, and calculates the Attack Success Rate (ASR).
5. **Security Findings & Evidence** (`/findings`):
   - Open the generated finding (`Vulnerability: Customer PII Exfiltration`).
   - Review the captured evidence, severity classification, and mitigation guidance.
6. **Remediation & Recovery Workflow** (`/recovery`):
   - From the finding page, click **Initialize Recovery Plan** to create an entry in the Recovery Ledger.
   - Click **Create Plan** → **Approve Plan** → **Execute Simulated Remediation**.
   - Click **Verify Recovery (Re-test)**: AegisNexus re-runs the attack scenario against the hardened profile, verifying that ASR drops (e.g., from 60% down to 0%) and marking the finding as `RESOLVED`.
7. **Compliance Matrix** (`/compliance`):
   - Inspect compliance assessments for OWASP LLM, NIST AI RMF, and SOC 2, showing pass/fail status tied to findings.

---

## Quickstart & Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend Setup

```powershell
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start backend server (auto-creates database and seeds demo agents & scenarios)
uvicorn app.main:app --reload --port 8000
```

- API Base: `http://localhost:8000`
- Swagger UI Documentation: `http://localhost:8000/api/docs`
- Health check: `http://localhost:8000/api/v1/health`
- Readiness check: `http://localhost:8000/api/v1/readiness`

### 2. Frontend Setup

```powershell
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

- Web UI: `http://localhost:5173`

### 3. Running Backend Tests & Verification

```powershell
# From backend directory
.\.venv\Scripts\pytest -v

# From frontend directory
npm run typecheck
npm run build
```

---

## Cloud Deployment Guide

### Backend (Render / Railway / Container)
- A multi-stage [Dockerfile](file:///c:/Users/vishw/OneDrive/Desktop/AegisNexus/backend/Dockerfile) is provided in `backend/`.
- Set environment variables based on `backend/.env.example`:
  - `PORT=8000`
  - `ENVIRONMENT=production`
  - `DATABASE_URL=sqlite+aiosqlite:////data/aegisnexus.db` (with persistent disk) or `postgresql+asyncpg://...`
  - `CORS_ORIGINS=https://your-frontend.vercel.app`

### Frontend (Vercel)
- Set Framework to **Vite**.
- Root directory: `frontend`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Environment variable: `VITE_API_BASE_URL=https://your-backend.onrender.com`.
- SPA rewrites are pre-configured in `frontend/vercel.json`.

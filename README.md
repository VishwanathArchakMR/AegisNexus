# AegisNexus

**Continuous adversarial security, governance, and compliance platform for AI agents.**

> Built for the hackathon — Phase 1 Foundation.

---

## What This Is

AegisNexus answers three questions:

1. What AI agents exist in an organization?
2. What could each agent access or do if compromised?
3. Has the agent been tested against adversarial behaviour?

### Security Pipeline

```
DISCOVER → MAP BLAST RADIUS → ADVERSARIAL TEST → MEASURE RISK → CLASSIFY COMPLIANCE → TRACK RECOVERY
```

---

## Phase 1 Status

✅ Backend API with FastAPI + SQLAlchemy  
✅ 4 demo agents seeded with capabilities, credentials, relationships  
✅ Dashboard summary metrics (from real DB data)  
✅ Agent inventory endpoint  
✅ Professional security operations UI  
⏳ Blast radius graph — Phase 2  
⏳ Attack engine — Phase 3  
⏳ Risk scoring engine — Phase 4  
⏳ Compliance + Recovery — Phase 5  

---

## Prerequisites

- Python 3.11+
- Node.js 18+

---

## Setup & Run

### 1. Backend

```powershell
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server (auto-creates DB + seeds demo data)
uvicorn app.main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**  
API docs: **http://localhost:8000/api/docs**

### 2. Frontend

```powershell
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Liveness check |
| GET | `/api/v1/agents` | List all agents |
| GET | `/api/v1/agents/{id}` | Agent detail |
| GET | `/api/v1/agents/{id}/capabilities` | Agent capabilities |
| GET | `/api/v1/agents/{id}/relationships` | Agent relationships |
| GET | `/api/v1/dashboard/summary` | Executive dashboard metrics |

---

## Demo Agents

| Agent | Trust Level | Key Capabilities |
|-------|-------------|-----------------|
| Customer Support Agent | HIGH | PII access, refund issuance, email sending |
| Finance Agent | CRITICAL | Payment gateway, invoice access |
| Research Agent | MEDIUM | Document browse, inter-agent messaging |
| Internal Operations Agent | HIGH | DB write access, business tools |

### Relationships

```
Customer Support → Finance       (refund escalation)
Research → Customer Support      (document summaries)
Customer Support → Research      (document lookups)
Finance → Internal Operations    (record reconciliation)
```

---

## Project Structure

```
AegisNexus/
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py          # FastAPI app + lifespan
│   │   ├── config.py        # Settings
│   │   ├── database.py      # SQLAlchemy async engine
│   │   ├── dependencies.py  # FastAPI DI
│   │   ├── models/          # ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── routers/         # API route handlers
│   │   └── simulation/      # Demo seed data
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── router.tsx
    │   ├── types/            # TypeScript types
    │   ├── lib/              # API client, query config
    │   ├── styles/           # Global CSS design system
    │   ├── components/       # Layout + UI components
    │   └── pages/            # Route pages
```

---

## Database

SQLite (local) — stored at `backend/aegisnexus.db`  
Auto-created on first startup. Demo data is seeded once using stable UUIDs.

To reset: delete `aegisnexus.db` and restart the backend.

---

## Next Phase

Phase 2: Blast Radius graph + Agent Detail page  
Phase 3: Attack Engine + Adversarial Simulation  
Phase 4: Risk Scoring + Security Findings  
Phase 5: Compliance classification + Recovery Ledger  

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Server,
  Shield,
  Radio,
  Sliders,
  Hash,
  Terminal,
  Copy,
  Check,
} from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { Badge } from '../../components/ui/Badge'

export default function Settings() {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedInstall, setCopiedInstall] = useState(false)

  const { data: health, isLoading: isHealthLoading } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => api.health.get(),
  })

  const installCommand = 'pip install -e ./sdks/python'

  const pythonExampleCode = `import os
from aegisnexus_sdk import AegisNexusClient, CapabilityDeclaration

# Initialize client from environment or explicitly
client = AegisNexusClient(
    endpoint=os.getenv("AEGISNEXUS_ENDPOINT", "http://localhost:8000/api/v1"),
    agent_id=os.getenv("AEGISNEXUS_AGENT_ID"),
    api_key=os.getenv("AEGISNEXUS_API_KEY"),
    heartbeat_interval=15,  # Automatic background heartbeat daemon
    fail_open=True,         # Never block agent execution on network partition
)

# Start background heartbeat & telemetry buffer thread
client.start()

# Synchronize declared security capabilities
client.report_capabilities([
    CapabilityDeclaration(
        name="lookup_customer",
        resource_type="DATABASE",
        permission_level="READ",
        is_sensitive=False,
        description="Reads customer account profiles",
    ),
])

# Instrument tool executions using decorator
@client.instrument_tool(
    name="lookup_customer",
    resource_type="DATABASE",
    permission_level="READ",
)
def fetch_customer(customer_id: str):
    # Tool execution is automatically monitored, timed, and redacted
    return {"id": customer_id, "status": "active"}

# Or instrument dynamically using context manager
with client.track_tool_call(
    tool_name="process_refund",
    resource_type="PAYMENT",
    permission_level="WRITE",
    is_sensitive=True,
    parameters={"amount": 49.99},
) as tracker:
    # Business logic executes here
    tracker.set_result({"status": "success"})
`

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pythonExampleCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyInstall = () => {
    navigator.clipboard.writeText(installCommand)
    setCopiedInstall(true)
    setTimeout(() => setCopiedInstall(false), 2000)
  }

  return (
    <div>
      <PageHeader
        title="Settings & System Governance"
        subtitle="Operational parameters, agent security boundaries, cryptographic ledger configuration, and SDK telemetry guardrails."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* ── Section A: Platform Overview ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Server size={18} color="var(--accent-light)" />
              <span className="card-title">Platform Architecture</span>
            </div>
            {isHealthLoading ? (
              <Skeleton width={60} height={20} />
            ) : health ? (
              <Badge variant="low">
                <span className="status-dot status-dot-active" /> ONLINE
              </Badge>
            ) : (
              <Badge variant="critical">OFFLINE</Badge>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Product Edition</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                AegisNexus 2.0 Hardened
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Control Plane Version</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {health?.version || '2.0.0-rc2'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Backend Runtime</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                FastAPI / Python 3.12 (SQLAlchemy Async ORM)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Persistence Engine</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--low)' }}>
                SQLite (aiosqlite) / PostgreSQL-Ready
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Official Python SDK</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-light)' }}>
                aegisnexus-sdk v0.2.0
              </span>
            </div>
          </div>
        </div>

        {/* ── Section B: Agent Security Policies ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="var(--info)" />
              <span className="card-title">Agent Security & Auth Policies</span>
            </div>
            <Badge variant="accent">POLICY ENFORCED</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Default Trust Assignment</span>
              <Badge variant="low">LOW (Conservative Default)</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Agent Authentication</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                Salted SHA-256 Bearer Tokens
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Administrative State Protection</span>
              <span style={{ color: 'var(--low)', fontWeight: 600 }}>
                Immutable to Heartbeats (Enforced)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Operator Access Scope</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                get_operator_access (Fail-Closed)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Credential Lifecycle</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                ACTIVE · ROTATED · REVOKED
              </span>
            </div>
          </div>
        </div>

        {/* ── Section C: Connectivity & Heartbeat Thresholds ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={18} color="var(--high)" />
              <span className="card-title">Connectivity & Telemetry Thresholds</span>
            </div>
            <Badge variant="neutral">DAEMON CONTROLLED</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Heartbeat Interval</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                30 seconds (Default)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Stale Status Threshold</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--medium)' }}>
                60 seconds without contact
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Offline Status Threshold</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--critical)' }}>
                120 seconds without contact
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Telemetry Batch Limit</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                100 events / request
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Connection States</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ONLINE · STALE · OFFLINE · NEVER_CONNECTED
              </span>
            </div>
          </div>
        </div>

        {/* ── Section D: Telemetry Guardrails & Redaction ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={18} color="var(--low)" />
              <span className="card-title">Telemetry Guardrails & Sanitization</span>
            </div>
            <Badge variant="low">SERVER REDACTION ACTIVE</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Server-Side Redaction</span>
              <span style={{ color: 'var(--low)', fontWeight: 600 }}>
                Recursive (token, password, secret, key)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Execution Duration Bounding</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                Clamped between 0.0s – 3600.0s
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Timestamp Boundary</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                Reject events &gt; 60s in future
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Event Deduplication</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                Idempotent event_id ingestion
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Queue Overflow Telemetry</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--high)' }}>
                dropped_events_count tracking
              </span>
            </div>
          </div>
        </div>

        {/* ── Section E: SHA-256 Audit Ledger ── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hash size={18} color="var(--accent-light)" />
              <span className="card-title">Cryptographic SHA-256 Hash-Chained Audit Ledger</span>
            </div>
            <Badge variant="accent">IMMUTABLE AUDIT TRAIL</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, fontSize: '0.8125rem' }}>
            <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Digest Algorithm
              </div>
              <div style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                SHA-256 (FIPS 180-4 compliant)
              </div>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Every remediation lifecycle action computes a SHA-256 digest over the canonical event payload combined with the preceding event's hash.
              </p>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Hash-Chain Linking Architecture
              </div>
              <div style={{ color: 'var(--low)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                Sequential previous_hash pointer
              </div>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Events form a cryptographically linked chronological chain. Altering historical entries or metadata invalidates downstream hashes.
              </p>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Tamper Detection Verification
              </div>
              <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                O(N) Full-Chain Deterministic Retest
              </div>
              <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Live validation is available per-ledger via the <code>/verify-chain</code> endpoint, certifying complete chain integrity without Merkle tree inflation.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section F: Python SDK Integration ── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={18} color="var(--accent-light)" />
              <span className="card-title">External Agent Python SDK Integration</span>
            </div>
            <button
              onClick={handleCopyCode}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {copiedCode ? <Check size={14} color="var(--low)" /> : <Copy size={14} />}
              {copiedCode ? 'Copied Code' : 'Copy Integration Snippet'}
            </button>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Connect any standalone AI agent (LangChain, CrewAI, AutoGen, or custom) to AegisNexus using the verified local package.
          </p>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Installation (From Local Monorepo)
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#040612',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8125rem',
                color: 'var(--accent-light)',
              }}
            >
              <code>{installCommand}</code>
              <button
                onClick={handleCopyInstall}
                className="link-btn"
                title="Copy installation command"
              >
                {copiedInstall ? <Check size={14} color="var(--low)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
              Minimal Verified Integration Code
            </div>
            <div className="code-block" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <pre style={{ margin: 0 }}>{pythonExampleCode}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

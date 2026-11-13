import { Shield, Cpu, Radio, CheckCircle2, Server, Terminal } from 'lucide-react'

export default function Settings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">System Settings & Governance Policies</h1>
        <p className="text-gray-400 mt-1">
          Operational configuration, agent integration parameters, cryptographic ledger policies, and runtime boundaries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Platform Overview */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3 text-cyan-400">
            <Server size={22} />
            <h2 className="text-lg font-semibold text-white">Platform Architecture</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Platform Edition</span>
              <span className="text-white font-mono">AegisNexus 2.0 Hardened</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Backend Runtime</span>
              <span className="text-white font-mono">FastAPI / Python 3.12 (Async ORM)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Supported Database</span>
              <span className="text-emerald-400 font-mono">SQLite (Transactional ACID)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Cryptographic Ledger</span>
              <span className="text-white font-mono">SHA-256 Hash-Chained Blockchain</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Python SDK Version</span>
              <span className="text-cyan-400 font-mono">aegisnexus-sdk v0.2.0</span>
            </div>
          </div>
        </div>

        {/* Security & Access Controls */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3 text-indigo-400">
            <Shield size={22} />
            <h2 className="text-lg font-semibold text-white">Control Plane & Auth Policies</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Operator Access Control</span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 size={14} /> Fail-Closed in Production
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Agent Authentication</span>
              <span className="text-white font-mono">SHA-256 Hashed Bearer Tokens</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Administrative State Protection</span>
              <span className="text-emerald-400 font-medium">Immutable to Heartbeats</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Initial External Trust Default</span>
              <span className="text-amber-400 font-medium">LOW (Conservative Default)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Key Lifecycle Support</span>
              <span className="text-white font-mono">Active / Rotated / Revoked</span>
            </div>
          </div>
        </div>

        {/* Heartbeat & Liveness Thresholds */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <Radio size={22} />
            <h2 className="text-lg font-semibold text-white">Connectivity Telemetry Thresholds</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Default Heartbeat Interval</span>
              <span className="text-white font-mono">30 seconds</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Stale Connection Warning</span>
              <span className="text-amber-400 font-mono">60 seconds without contact</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Offline Threshold</span>
              <span className="text-red-400 font-mono">120 seconds without contact</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Telemetry Ingestion Batch Limit</span>
              <span className="text-white font-mono">100 events / request</span>
            </div>
          </div>
        </div>

        {/* Telemetry Redaction & Guardrails */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3 text-emerald-400">
            <Cpu size={22} />
            <h2 className="text-lg font-semibold text-white">Runtime Ingestion Guardrails</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Server-Side Redaction</span>
              <span className="text-emerald-400 font-medium">Active (Recursive Key Scrub)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Redacted Token Patterns</span>
              <span className="text-white font-mono text-xs">password, secret, token, key, auth</span>
            </div>
            <div className="flex justify-between py-2 border-b border-white/5">
              <span className="text-gray-400">Max Event Payload Boundary</span>
              <span className="text-white font-mono">1 MB (1,048,576 bytes)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">Event Idempotency Check</span>
              <span className="text-cyan-400 font-medium">Deduplication by event_id</span>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Reference */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 text-cyan-400">
          <Terminal size={22} />
          <h2 className="text-lg font-semibold text-white">External Agent SDK Integration Reference</h2>
        </div>
        <p className="text-sm text-gray-400">
          External agents integrate with AegisNexus using the official Python client. Telemetry, heartbeats, and capability sync run asynchronously with configurable fail-open protection.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
          <div className="bg-black/60 p-4 rounded-lg border border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SDK Installation</h3>
            <pre className="text-xs text-cyan-300 font-mono overflow-x-auto">
              pip install sdks/python/
            </pre>
          </div>

          <div className="bg-black/60 p-4 rounded-lg border border-white/5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quickstart Initialization</h3>
            <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
{`from aegisnexus_sdk import AegisNexusClient

client = AegisNexusClient(
    base_url="http://localhost:8000",
    agent_id="YOUR_AGENT_UUID",
    api_key="YOUR_PLAINTEXT_SECRET",
    fail_open=True,
)`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

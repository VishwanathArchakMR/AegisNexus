import { useNavigate, useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bot,
  Lock,
  Key,
  GitFork,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { api } from '../../../lib/api'
import { TrustBadge, StatusBadge, Badge } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/Skeleton'
import type {
  AgentCapability,
  AgentCredential,
  AgentRelationship,
  ImpactLevel,
  PermissionLevel,
  ResourceType,
} from '../../../types'

// ── Helpers ────────────────────────────────────────────────────────────────

const AGENT_TYPE_LABELS: Record<string, string> = {
  customer_support: 'Customer Support',
  finance: 'Finance',
  research: 'Research',
  ops: 'Operations',
  custom: 'Custom',
}

const RESOURCE_COLORS: Record<ResourceType, string> = {
  PAYMENT: 'var(--critical)',
  EMAIL: 'var(--medium)',
  DATABASE: 'var(--accent-light)',
  FILE: 'var(--text-secondary)',
  API: 'var(--info)',
  AGENT_COMMS: 'var(--high)',
}

const PERMISSION_VARIANTS: Record<PermissionLevel, 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral'> = {
  ADMIN: 'critical',
  EXECUTE: 'high',
  WRITE: 'medium',
  READ: 'neutral',
}

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  CRITICAL: 'var(--critical)',
  HIGH: 'var(--high)',
  MEDIUM: 'var(--medium)',
  LOW: 'var(--low)',
}

const IMPACT_BG: Record<ImpactLevel, string> = {
  CRITICAL: 'var(--critical-dim)',
  HIGH: 'var(--high-dim)',
  MEDIUM: 'var(--medium-dim)',
  LOW: 'var(--low-dim)',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '12px 20px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(255,255,255,0.01)',
    }}>
      <span style={{
        fontSize: '0.6875rem', fontWeight: 700,
        letterSpacing: '0.07em', textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{
          fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          padding: '1px 5px',
          color: 'var(--text-secondary)',
        }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── Capabilities table ──────────────────────────────────────────────────────

function CapabilitiesSection({ capabilities }: { capabilities: AgentCapability[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader label="Capabilities" count={capabilities.length} />
      <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Capability</th>
              <th>Resource</th>
              <th>Permission</th>
              <th>Sensitive</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr key={cap.id} style={{ cursor: 'default' }}>
                <td style={{ fontWeight: 500 }}>{cap.capability_name}</td>
                <td>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: RESOURCE_COLORS[cap.resource_type] ?? 'var(--text-secondary)',
                  }}>
                    {cap.resource_type}
                  </span>
                </td>
                <td>
                  <Badge variant={PERMISSION_VARIANTS[cap.permission_level] ?? 'neutral'}>
                    {cap.permission_level}
                  </Badge>
                </td>
                <td>
                  {cap.is_sensitive ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--high)' }}>
                      <AlertTriangle size={12} /> <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Yes</span>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={12} /> <span style={{ fontSize: '0.75rem' }}>No</span>
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', maxWidth: 300 }}>
                  {cap.description ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Credentials section ────────────────────────────────────────────────────

function CredentialsSection({ credentials }: { credentials: AgentCredential[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader label="Credential Metadata" count={credentials.length} />
      <div style={{
        padding: '8px 12px',
        background: 'rgba(239,68,68,0.06)',
        borderBottom: '1px solid rgba(239,68,68,0.1)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: '0.6875rem', color: 'var(--text-secondary)',
      }}>
        <Lock size={10} color="var(--critical)" />
        <span>Displaying metadata only. Actual secret values are never exposed.</span>
      </div>
      <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Scope</th>
              <th>Rotated</th>
              <th>Last Used</th>
            </tr>
          </thead>
          <tbody>
            {credentials.map((cred) => (
              <tr key={cred.id} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <Key size={12} color="var(--text-muted)" />
                    {cred.credential_name}
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {cred.credential_type}
                  </span>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)', maxWidth: 200 }}>
                  {cred.scope}
                </td>
                <td>
                  {cred.is_rotated ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--low)' }}>
                      <CheckCircle2 size={12} /> <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Yes</span>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--high)' }}>
                      <XCircle size={12} /> <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>No</span>
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} color="var(--text-muted)" />
                    {formatDate(cred.last_used_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Relationships section ──────────────────────────────────────────────────

function RelationshipsSection({
  outgoing,
  incoming,
  agents,
}: {
  outgoing: AgentRelationship[]
  incoming: AgentRelationship[]
  agents: Record<string, string>
}) {
  const REL_COLORS: Record<string, string> = {
    CALLS: 'var(--accent-light)',
    DELEGATES: 'var(--medium)',
    SHARES_CREDENTIAL: 'var(--high)',
    MONITORS: 'var(--info)',
  }

  function RelRow({ rel, direction }: { rel: AgentRelationship; direction: 'OUT' | 'IN' }) {
    const peerId = direction === 'OUT' ? rel.target_agent_id : rel.source_agent_id
    const peerName = agents[peerId] ?? peerId.slice(0, 8) + '…'
    const color = REL_COLORS[rel.relationship_type] ?? 'var(--text-secondary)'

    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: direction === 'OUT' ? 'var(--accent)' : 'var(--text-muted)',
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{peerName}</span>
            <span style={{
              fontSize: '0.625rem', fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              color, fontFamily: 'var(--font-mono)',
              background: `${color}14`,
              border: `1px solid ${color}30`,
              borderRadius: 3, padding: '1px 5px',
            }}>
              {rel.relationship_type}
            </span>
            <span style={{
              fontSize: '0.625rem', color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 3, padding: '1px 5px',
            }}>
              {direction === 'OUT' ? '→ Outgoing' : '← Incoming'}
            </span>
          </div>
          {rel.description && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {rel.description}
            </div>
          )}
        </div>
        <Link
          to={`/agents/${peerId}`}
          style={{ color: 'var(--text-muted)', display: 'flex' }}
          title="Open agent"
        >
          <ChevronRight size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <SectionHeader label="Relationships" count={outgoing.length + incoming.length} />
      {outgoing.length === 0 && incoming.length === 0 ? (
        <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          No relationships registered.
        </div>
      ) : (
        <>
          {outgoing.map((r) => <RelRow key={r.id} rel={r} direction="OUT" />)}
          {incoming.map((r) => <RelRow key={r.id} rel={r} direction="IN" />)}
        </>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const agentQuery = useQuery({
    queryKey: ['agents', id],
    queryFn: () => api.agents.get(id!),
    enabled: !!id,
    retry: (failCount, error) => {
      // Don't retry 404s
      if ((error as { response?: { status: number } }).response?.status === 404) return false
      return failCount < 2
    },
  })

  const blastQuery = useQuery({
    queryKey: ['agents', id, 'blast-radius'],
    queryFn: () => api.agents.blastRadius(id!),
    enabled: !!id,
  })

  const agentListQuery = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: () => api.agents.list(),
  })

  // Build a quick id→name lookup map
  const agentNameMap = Object.fromEntries(
    (agentListQuery.data?.agents ?? []).map((a) => [a.id, a.name])
  )

  // ── Loading state ─────────────────────────────────────────────────────
  if (agentQuery.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Skeleton height={24} width={200} />
        <Skeleton height={80} />
        <div className="grid-2" style={{ gap: 16 }}>
          <Skeleton height={300} />
          <Skeleton height={300} />
        </div>
      </div>
    )
  }

  // ── 404 / error state ─────────────────────────────────────────────────
  if (agentQuery.error || !agentQuery.data) {
    const is404 = (agentQuery.error as { response?: { status: number } })?.response?.status === 404
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start' }}>
        <button className="link-btn" onClick={() => navigate('/agents')}>
          <ArrowLeft size={13} /> Agent Inventory
        </button>
        <div className="error-state">
          <AlertTriangle size={16} />
          <span>
            {is404
              ? `Agent '${id}' was not found. It may have been removed or never registered.`
              : 'Failed to load agent. Ensure the backend is running.'}
          </span>
        </div>
      </div>
    )
  }

  const agent = agentQuery.data
  const blast = blastQuery.data
  const impact = blast?.summary.potential_impact ?? null
  const impactColor = impact ? IMPACT_COLORS[impact] : 'var(--text-muted)'
  const impactBg = impact ? IMPACT_BG[impact] : 'rgba(255,255,255,0.04)'

  const sensCount = agent.capabilities.filter((c) => c.is_sensitive).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Back nav ── */}
      <button className="link-btn" onClick={() => navigate('/agents')}>
        <ArrowLeft size={13} /> Agent Inventory
      </button>

      {/* ── Agent header ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, flex: 1 }}>
            {/* Icon */}
            <div style={{
              width: 44, height: 44, borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Bot size={22} color="var(--accent-light)" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>
                {agent.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {AGENT_TYPE_LABELS[agent.agent_type] ?? agent.agent_type}
                </span>
                <span style={{ color: 'var(--border-default)' }}>·</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{agent.owner_team}</span>
                <span style={{ color: 'var(--border-default)' }}>·</span>
                <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {agent.id}
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 640 }}>
                {agent.description}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <TrustBadge level={agent.trust_level} />
            <StatusBadge status={agent.status} />
          </div>
        </div>

        {/* Metric strip */}
        <div style={{
          display: 'flex', gap: 0,
          marginTop: 20,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 16,
        }}>
          {[
            { label: 'Capabilities', value: agent.capabilities.length, icon: <Zap size={13} color="var(--accent)" /> },
            { label: 'Sensitive', value: sensCount, icon: <Lock size={13} color={sensCount > 0 ? 'var(--high)' : 'var(--text-muted)'} />, highlight: sensCount > 0 },
            { label: 'Relationships', value: agent.outgoing_relationships.length + agent.incoming_relationships.length, icon: <GitFork size={13} color="var(--info)" /> },
            { label: 'Credentials', value: agent.credentials.length, icon: <Key size={13} color="var(--text-secondary)" /> },
          ].map((m, i) => (
            <div key={m.label} style={{
              flex: 1,
              padding: '8px 16px',
              borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                {m.icon}
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {m.label}
                </span>
              </div>
              <div style={{
                fontSize: '1.375rem', fontWeight: 700,
                color: (m as { highlight?: boolean }).highlight ? 'var(--high)' : 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}>
                {m.value}
              </div>
            </div>
          ))}
          {/* Blast radius impact */}
          <div style={{ flex: 1, padding: '8px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <ShieldAlert size={13} color={impactColor} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Blast Radius
              </span>
            </div>
            {blastQuery.isLoading ? (
              <Skeleton height={22} width={60} />
            ) : (
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: impactColor }}>
                {impact ?? '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Left: Capabilities + Credentials + Relationships */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CapabilitiesSection capabilities={agent.capabilities} />
          <CredentialsSection credentials={agent.credentials} />
          <RelationshipsSection
            outgoing={agent.outgoing_relationships}
            incoming={agent.incoming_relationships}
            agents={agentNameMap}
          />
        </div>

        {/* Right: Blast Radius Assessment */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <SectionHeader label="Blast Radius Assessment" />

            {blastQuery.isLoading ? (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[...Array(4)].map((_, i) => <Skeleton key={i} height={14} />)}
              </div>
            ) : blast ? (
              <>
                {/* Impact banner */}
                <div style={{
                  padding: '14px 20px',
                  background: impactBg,
                  borderBottom: `1px solid ${impactColor}22`,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <ShieldAlert size={18} color={impactColor} />
                  <div>
                    <div style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: impactColor }}>
                      Potential Impact
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: impactColor, letterSpacing: '-0.02em' }}>
                      {blast.summary.potential_impact}
                    </div>
                  </div>
                </div>

                {/* Metrics grid */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  {[
                    { label: 'Direct Connections', value: blast.summary.direct_connections },
                    { label: 'Downstream Agents', value: blast.summary.downstream_agents },
                    { label: 'Sensitive Capabilities', value: blast.summary.sensitive_capabilities },
                    { label: 'Total Capabilities', value: blast.summary.total_capabilities },
                    { label: 'Propagation Depth', value: blast.summary.propagation_depth, suffix: ' hops' },
                  ].map((m) => (
                    <div key={m.label} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.label}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {m.value}{m.suffix ?? ''}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Impact factors */}
                {blast.summary.impact_factors.length > 0 && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{
                      fontSize: '0.625rem', fontWeight: 700,
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      color: 'var(--text-muted)', marginBottom: 8,
                    }}>
                      Impact Factors
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {blast.summary.impact_factors.map((factor, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: 6, alignItems: 'flex-start',
                          fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.4,
                        }}>
                          <span style={{ color: impactColor, flexShrink: 0, marginTop: 1 }}>▸</span>
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.01)' }}>
                  <p style={{ fontSize: '0.6125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Preliminary assessment based on capability exposure and relationship graph.
                    Impact will be calibrated by attack simulation results in Phase 3.
                  </p>
                </div>

                {/* Actions */}
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Link
                    to={`/blast-radius?agent=${agent.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 14px',
                      background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem', fontWeight: 500, color: 'var(--accent-light)',
                      cursor: 'pointer', textDecoration: 'none',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <GitFork size={14} /> View Blast Radius Graph
                  </Link>
                  <Link
                    to={`/attack-simulation?agent=${agent.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 14px',
                      background: 'transparent', border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)',
                      cursor: 'pointer', textDecoration: 'none',
                      transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                    }}
                  >
                    <Zap size={14} /> View Attack Simulations
                  </Link>
                  <Link
                    to={`/compliance/agents/${agent.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px 14px',
                      background: 'transparent', border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)',
                      cursor: 'pointer', textDecoration: 'none',
                      transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                    }}
                  >
                    <ShieldAlert size={14} /> View Compliance Report
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Blast radius data unavailable.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

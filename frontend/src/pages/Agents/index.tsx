import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Lock, Search, Filter, Plus, Activity } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { TrustBadge, StatusBadge, Badge } from '../../components/ui/Badge'
import { ConnectionStatusPill } from '../../components/ui/ConnectionStatusPill'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { OnboardWizardModal } from './OnboardWizardModal'
import type { AgentSummary, AgentListParams } from '../../types'

const AGENT_TYPE_LABELS: Record<string, string> = {
  customer_support: 'Customer Support',
  finance: 'Finance',
  research: 'Research',
  ops: 'Operations',
  custom: 'Custom',
}

function formatLastSeen(dateStr: string | null, isOffline: boolean): string {
  if (!dateStr) return 'Never'
  if (isOffline) return 'Offline'
  
  const diff = Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + "Z").getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

export default function AgentsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [params, setParams] = useState<AgentListParams>({
    search: '',
    status: '',
    trust_level: '',
    agent_type: '',
  })

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['agents', 'list', params],
    queryFn: () => api.agents.list(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== ''))
    ),
    refetchInterval: 10_000, // Poll every 10s to keep connection statuses live
  })

  const updateFilter = useCallback((key: keyof AgentListParams, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  return (
    <div>
      <PageHeader
        title="Agent Inventory"
        subtitle={
          data ? `${data.total} registered agent${data.total !== 1 ? 's' : ''} in the platform` : 'Loading agent registry…'
        }
        actions={
          <button
            id="btn-add-external-agent"
            onClick={() => setIsOnboardingOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px var(--accent-glow)',
            }}
          >
            <Plus size={16} /> Add External Agent
          </button>
        }
      />

      {error && (
        <div className="error-state" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>Failed to load agents. Ensure the backend is running on port 8000.</span>
        </div>
      )}

      {/* ── Filters Bar ── */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 16,
        padding: '12px 16px', background: 'var(--bg-card)',
        border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search agents by name, framework, or team..."
            value={params.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            style={{
              width: '100%', padding: '6px 12px 6px 30px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '0.8125rem', outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="var(--text-muted)" />
          <select
            value={params.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            style={{
              padding: '6px 12px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
              color: params.status ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Status: All</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
            <option value="QUARANTINED">QUARANTINED</option>
          </select>

          <select
            value={params.trust_level}
            onChange={(e) => updateFilter('trust_level', e.target.value)}
            style={{
              padding: '6px 12px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
              color: params.trust_level ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Trust: All</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            value={params.agent_type}
            onChange={(e) => updateFilter('agent_type', e.target.value)}
            style={{
              padding: '6px 12px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
              color: params.agent_type ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem', outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="">Type: All</option>
            {Object.entries(AGENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          
          {(params.search || params.status || params.trust_level || params.agent_type) && (
            <button
              onClick={() => setParams({ search: '', status: '', trust_level: '', agent_type: '' })}
              style={{
                background: 'transparent', border: 'none', color: 'var(--accent)',
                fontSize: '0.75rem', cursor: 'pointer', padding: '4px 8px',
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={44} />)}
          </div>
        ) : !data || data.agents.length === 0 ? (
          <EmptyState title="No agents found" subtitle="Try adjusting your filters or onboard a new agent." />
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent & Framework</th>
                  <th>Connectivity</th>
                  <th>Environment</th>
                  <th>Type</th>
                  <th>Admin Status</th>
                  <th>Credential Status</th>
                  <th>Trust Level</th>
                  <th>Owner Team</th>
                  <th>Capabilities</th>
                  <th>Telemetry Events</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent: AgentSummary) => (
                  <tr
                    key={agent.id}
                    id={`agent-inventory-row-${agent.id}`}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{
                          fontSize: '0.6875rem',
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {agent.framework || 'Custom'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {agent.id.slice(0, 8)}…
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ConnectionStatusPill status={agent.connection_status} />
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {formatLastSeen(agent.last_heartbeat_at || agent.last_seen_at, agent.connection_status === 'OFFLINE')}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color:
                            agent.environment === 'production'
                              ? 'var(--critical)'
                              : agent.environment === 'staging'
                              ? 'var(--medium)'
                              : 'var(--text-secondary)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {agent.environment || 'development'}
                      </span>
                    </td>
                    <td>
                      <span className="agent-type-label">
                        {AGENT_TYPE_LABELS[agent.agent_type] ?? agent.agent_type}
                      </span>
                    </td>
                    <td><StatusBadge status={agent.status} /></td>
                    <td>
                      <Badge
                        variant={
                          agent.api_key_status === 'ACTIVE'
                            ? 'low'
                            : agent.api_key_status === 'ROTATED'
                            ? 'medium'
                            : agent.api_key_status === 'REVOKED'
                            ? 'critical'
                            : 'neutral'
                        }
                      >
                        {agent.api_key_status || 'SEEDED'}
                      </Badge>
                    </td>
                    <td><TrustBadge level={agent.trust_level} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{agent.owner_team}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontFamily: 'var(--font-mono)', fontSize: '0.8125rem',
                          color: agent.capability_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {agent.capability_count > 0 && <Lock size={11} color="var(--medium)" />}
                        {agent.capability_count}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--accent)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Activity size={12} />
                        {agent.total_events_count ?? 0}
                      </span>
                    </td>
                    <td>
                      <ArrowRight size={14} color="var(--text-muted)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary footer */}
      {data && (
        <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>
            <span style={{ color: 'var(--low)', fontWeight: 600 }}>
              {data.agents.filter((a) => a.connection_status === 'ONLINE').length}
            </span>{' '}Online
          </span>
          <span>
            <span style={{ color: 'var(--medium)', fontWeight: 600 }}>
              {data.agents.filter((a) => a.connection_status === 'STALE').length}
            </span>{' '}Stale
          </span>
          <span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
              {data.agents.filter((a) => a.connection_status === 'OFFLINE' || a.connection_status === 'NEVER_CONNECTED').length}
            </span>{' '}Offline / Unconnected
          </span>
          <span style={{ marginLeft: 'auto' }}>
            Total Registered: <strong style={{ color: 'var(--text-primary)' }}>{data.total}</strong>
          </span>
        </div>
      )}

      {/* Onboard Wizard Modal */}
      <OnboardWizardModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['agents', 'list'] })
          refetch()
        }}
      />
    </div>
  )
}

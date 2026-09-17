import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Lock, Search, Filter } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { TrustBadge, StatusBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
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
  
  const diff = Date.now() - new Date(dateStr + "Z").getTime() // dateStr from DB is UTC but might lack Z
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
}

export default function AgentsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useState<AgentListParams>({
    search: '',
    status: '',
    trust_level: '',
    agent_type: '',
  })

  // We debounce the actual API call for search by using a local state and a timeout
  // but for simplicity in this Phase 2 we can just let React Query handle it with refetch,
  // or pass the params directly.
  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', 'list', params],
    queryFn: () => api.agents.list(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== ''))
    ),
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
            placeholder="Search agents by name..."
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
          <EmptyState title="No agents found" subtitle="Try adjusting your filters or search terms." />
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Trust Level</th>
                  <th>Owner Team</th>
                  <th>Capabilities</th>
                  <th>Credentials</th>
                  <th>Relationships</th>
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
                      <div style={{ fontWeight: 600 }}>{agent.name}</div>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: 2,
                        }}
                      >
                        {agent.id}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          backgroundColor: agent.source === 'LIVE' ? 'var(--accent)' : 'var(--bg-elevated)',
                          color: agent.source === 'LIVE' ? '#fff' : 'var(--text-muted)',
                          width: 'fit-content'
                        }}>
                          {agent.source}
                        </span>
                        {agent.source === 'LIVE' && (
                          <span style={{ fontSize: '0.6875rem', color: agent.is_offline ? 'var(--text-muted)' : 'var(--low)' }}>
                            {formatLastSeen(agent.last_seen_at, agent.is_offline)}
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.625rem',
                          color: agent.confidence === 'SELF_REPORTED' ? 'var(--text-muted)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}>
                          {agent.confidence === 'SELF_REPORTED' ? 'Self-Reported' : agent.confidence === 'INFERRED' ? 'Inferred' : 'Verified'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="agent-type-label">
                        {AGENT_TYPE_LABELS[agent.agent_type] ?? agent.agent_type}
                      </span>
                    </td>
                    <td><StatusBadge status={agent.status} /></td>
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
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {agent.credential_count}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {agent.relationship_count}
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
              {data.agents.filter((a) => a.status === 'ACTIVE').length}
            </span>{' '}Active
          </span>
          <span>
            <span style={{ color: 'var(--critical)', fontWeight: 600 }}>
              {data.agents.filter((a) => a.trust_level === 'CRITICAL').length}
            </span>{' '}Critical Trust
          </span>
          <span>
            <span style={{ color: 'var(--high)', fontWeight: 600 }}>
              {data.agents.filter((a) => a.trust_level === 'HIGH').length}
            </span>{' '}High Trust
          </span>
        </div>
      )}
    </div>
  )
}

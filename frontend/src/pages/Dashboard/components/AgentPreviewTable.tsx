import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { AgentSummary } from '../../../types'
import { TrustBadge, StatusBadge } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/Skeleton'
import { EmptyState } from '../../../components/ui/EmptyState'

const AGENT_TYPE_LABELS: Record<string, string> = {
  customer_support: 'Customer Support',
  finance: 'Finance',
  research: 'Research',
  ops: 'Operations',
  custom: 'Custom',
}

interface AgentPreviewTableProps {
  agents: AgentSummary[]
  isLoading: boolean
  limit?: number
}

export function AgentPreviewTable({ agents, isLoading, limit = 8 }: AgentPreviewTableProps) {
  const navigate = useNavigate()
  const visible = agents.slice(0, limit)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Agent Inventory
        </span>
        <button
          className="link-btn"
          onClick={() => navigate('/agents')}
          id="view-all-agents-btn"
        >
          View All <ArrowRight size={12} />
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} height={36} />)}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState title="No agents registered" subtitle="Agents will appear here once added to the platform." />
      ) : (
        <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Type</th>
                <th>Status</th>
                <th>Trust Level</th>
                <th>Owner Team</th>
                <th style={{ textAlign: 'right' }}>Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((agent) => (
                <tr
                  key={agent.id}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  id={`agent-row-${agent.id}`}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {agent.name}
                    </div>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: 2,
                      }}
                    >
                      {agent.id.slice(0, 8)}…
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
                  <td style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8125rem',
                        color: agent.capability_count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {agent.capability_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { ImpactBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import type { AgentFindingSummary } from '../../types'

function EvaluationBadge({ level }: { level: string }) {
  if (level === 'per-tool-call') {
    return (
      <span style={{
        padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
        background: 'var(--critical-dim)', color: 'var(--critical)'
      }}>
        Tool-Call Level
      </span>
    )
  }
  return (
    <span style={{
      padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
      background: 'var(--bg-elevated)', color: 'var(--text-muted)'
    }}>
      Task Level
    </span>
  )
}

export default function FindingsPage() {
  const navigate = useNavigate()

  const { data: findings, isLoading, error } = useQuery({
    queryKey: ['findings', 'list'],
    queryFn: () => api.findings.list()
  })

  return (
    <div>
      <PageHeader
        title="Security Findings"
        subtitle="Auto-generated vulnerabilities and risk exposures identified during attack simulations."
      />

      {error && (
        <div className="error-state" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>Failed to load security findings.</span>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} height={44} />)}
          </div>
        ) : !findings || findings.length === 0 ? (
          <EmptyState 
            title="No findings identified" 
            subtitle="Run attack simulations against your agents to discover vulnerabilities." 
          />
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Finding Title</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Target Agent</th>
                  <th>Type</th>
                  <th>Evaluation Scope</th>
                  <th>Identified On</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding: AgentFindingSummary) => (
                  <tr
                    key={finding.id}
                    onClick={() => navigate(`/findings/${finding.id}`)}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {finding.severity === 'CRITICAL' && <ShieldAlert size={14} color="var(--critical)" />}
                        <span style={{ fontWeight: 500 }}>{finding.title}</span>
                      </div>
                    </td>
                    <td><ImpactBadge level={finding.severity} /></td>
                    <td>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
                        background: finding.status === 'OPEN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                        color: finding.status === 'OPEN' ? 'var(--critical)' : 'var(--low)',
                      }}>
                        {finding.status}
                      </span>
                    </td>
                    <td>{finding.agent.name}</td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                        {finding.finding_type}
                      </span>
                    </td>
                    <td>
                      <EvaluationBadge level={finding.evaluation_level || 'per-full-task'} />
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {new Date(finding.created_at).toLocaleDateString()}
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
    </div>
  )
}

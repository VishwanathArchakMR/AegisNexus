import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'

export default function AssessmentDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: assessment, isLoading } = useQuery({
    queryKey: ['compliance', 'assessments', id],
    queryFn: () => api.compliance.assessment(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...Array(3)].map((_, i) => <Skeleton key={i} height={60} />)}
      </div>
    )
  }

  if (!assessment) {
    return <div className="error-state">Failed to load assessment.</div>
  }

  const StatusIcon = {
    PASS: CheckCircle2,
    PARTIAL: AlertCircle,
    FAIL: XCircle,
    NOT_ASSESSED: AlertCircle,
  }

  const StatusColor = {
    PASS: 'var(--success)',
    PARTIAL: 'var(--warning)',
    FAIL: 'var(--critical)',
    NOT_ASSESSED: 'var(--text-muted)',
  }

  const overallStatusColor = assessment.status === 'COMPLIANT' ? 'var(--success)' :
                             assessment.status === 'PARTIALLY_COMPLIANT' ? 'var(--warning)' : 'var(--critical)'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Link to={`/compliance/agents/${assessment.agent_id}`} style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <PageHeader
            title={`${assessment.framework.short_name} Assessment`}
            subtitle={`Detailed control evaluation for ${assessment.agent.name}`}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 12, fontWeight: 600,
              border: `1px solid ${overallStatusColor}`, color: overallStatusColor, background: `${overallStatusColor}15`
            }}>
              {assessment.status.replace('_', ' ')}
            </span>
            <span style={{
              fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)'
            }}>
              {assessment.score.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Controls Evaluated</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{assessment.assessed_controls}</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Passed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success)' }}>{assessment.passing_controls}</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Partial</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--warning)' }}>{assessment.partial_controls}</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '16px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>Failed</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--critical)' }}>{assessment.failing_controls}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border-default)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Control Results</h3>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {assessment.results.map((result) => {
            const Icon = StatusIcon[result.status]
            const color = StatusColor[result.status]
            return (
              <div key={result.id} style={{ padding: 16, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Icon size={20} color={color} style={{ marginTop: 2 }} />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 500 }}>{result.control.control_id}</span>
                        <span style={{ fontWeight: 600 }}>{result.control.title}</span>
                        <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}>
                          {result.control.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{result.control.description}</div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                    border: `1px solid ${color}`, color: color, background: `${color}15`
                  }}>
                    {result.status}
                  </div>
                </div>
                
                <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-card)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>Explanation: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{result.explanation}</span>
                  </div>
                  {result.recommendation && (
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--warning)' }}>Recommendation: </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{result.recommendation}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

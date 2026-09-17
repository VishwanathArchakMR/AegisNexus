import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'

export default function AgentComplianceDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: posture, isLoading: isLoadingPosture } = useQuery({
    queryKey: ['compliance', 'agents', id],
    queryFn: () => api.compliance.agentPosture(id!),
    enabled: !!id,
  })

  // We need to fetch each assessment detail if it exists
  const { data: agent, isLoading: isLoadingAgent } = useQuery({
    queryKey: ['agents', id],
    queryFn: () => api.agents.get(id!),
    enabled: !!id,
  })

  // To make this simple, we will fetch assessments for this agent
  const { data: assessments, isLoading: isLoadingAssessments } = useQuery({
    queryKey: ['compliance', 'assessments', { agent_id: id }],
    queryFn: () => api.compliance.assessments({ agent_id: id }),
    enabled: !!id,
  })

  if (isLoadingPosture || isLoadingAgent || isLoadingAssessments) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...Array(3)].map((_, i) => <Skeleton key={i} height={80} />)}
      </div>
    )
  }

  if (!posture || !agent || !assessments) {
    return <div className="error-state">Failed to load agent compliance details.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Link to="/compliance" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <ArrowLeft size={16} />
        </Link>
        <PageHeader
          title={`Compliance Report: ${agent.name}`}
          subtitle={`Comprehensive governance assessment for ${agent.agent_type} agent`}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 16,
      }}>
        {posture.frameworks.map((fwPosture) => {
          const statusColor = fwPosture.status === 'COMPLIANT' ? 'var(--success)' :
                              fwPosture.status === 'PARTIALLY_COMPLIANT' ? 'var(--warning)' : 'var(--critical)'

          return (
            <div key={fwPosture.framework_id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600 }}>{fwPosture.framework_name}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Score: {fwPosture.score.toFixed(1)}%</div>
                </div>
                <div style={{
                  fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 12, fontWeight: 600,
                  border: `1px solid ${statusColor}`, color: statusColor, background: `${statusColor}15`
                }}>
                  {fwPosture.status.replace('_', ' ')}
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '0.8125rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Failed Controls</div>
                  <div style={{ fontWeight: 600, color: 'var(--critical)', fontSize: '1.25rem' }}>{fwPosture.failed_controls}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Partial Controls</div>
                  <div style={{ fontWeight: 600, color: 'var(--warning)', fontSize: '1.25rem' }}>{fwPosture.partial_controls}</div>
                </div>
              </div>
              
              <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                <Link
                  to={`/compliance/assessments/${fwPosture.assessment_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', textDecoration: 'none',
                    fontSize: '0.8125rem', fontWeight: 500, width: '100%'
                  }}
                >
                  View Detailed Assessment
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

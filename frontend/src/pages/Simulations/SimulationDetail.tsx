import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Activity, ShieldAlert, CheckCircle, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { ImpactBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'

export default function SimulationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['simulations', 'detail', id],
    queryFn: () => api.simulations.get(id as string),
    enabled: !!id
  })

  if (isLoading) {
    return <div style={{ padding: 24 }}><Skeleton height={200} /></div>
  }

  if (error || !data) {
    return <div style={{ padding: 24, color: 'var(--critical)' }}>Failed to load simulation execution.</div>
  }

  const asrPercent = (data.attack_success_rate * 100).toFixed(0)
  const isVulnerable = data.attack_success_rate > 0

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => navigate('/attack-simulation')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.875rem'
          }}
        >
          <ArrowLeft size={14} /> Back to Simulations
        </button>
      </div>

      <PageHeader
        title={`Execution: ${data.scenario.name}`}
        subtitle={`Targeting ${data.target_agent.name} • Started ${new Date(data.started_at).toLocaleString()}`}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Attack Success Rate (ASR)
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: isVulnerable ? 'var(--critical)' : 'var(--low)' }}>
            {asrPercent}%
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {data.successful_attempts} successful out of {data.total_attempts} attempts
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Vulnerability Severity
          </div>
          <div style={{ marginTop: 4 }}>
            {data.severity !== 'NONE' ? <ImpactBadge level={data.severity} /> : <span style={{ color: 'var(--text-muted)' }}>None (Secure)</span>}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'auto' }}>
            {data.scenario.attack_type}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Scenario Context
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {data.scenario.description}
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 12, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Activity size={18} color="var(--accent)" /> Attempt Details
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.attempts.map((attempt) => (
          <div key={attempt.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {attempt.success ? (
                  <ShieldAlert size={18} color="var(--critical)" />
                ) : (
                  <CheckCircle size={18} color="var(--low)" />
                )}
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>Attempt {attempt.attempt_number}</span>
                <span style={{ 
                  fontSize: '0.75rem', padding: '2px 6px', borderRadius: 4, 
                  background: attempt.success ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: attempt.success ? 'var(--critical)' : 'var(--low)'
                }}>
                  {attempt.success ? 'Vulnerable' : 'Blocked'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                <Clock size={12} /> {attempt.execution_time_ms}ms
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Payload Input</div>
                <div style={{ 
                  background: 'var(--bg-elevated)', padding: 12, borderRadius: 6, 
                  fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)',
                  wordBreak: 'break-word', border: '1px solid var(--border-default)'
                }}>
                  {attempt.input_payload}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Observed Behavior</div>
                <div style={{ 
                  background: attempt.success ? 'rgba(239, 68, 68, 0.05)' : 'rgba(34, 197, 94, 0.05)', 
                  padding: 12, borderRadius: 6, 
                  fontSize: '0.875rem', color: attempt.success ? 'var(--critical)' : 'var(--low)',
                  border: `1px solid ${attempt.success ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'}`,
                  height: '100%'
                }}>
                  {attempt.behavior_observed}
                  {attempt.success_reason && (
                    <div style={{ marginTop: 8, fontSize: '0.8125rem', opacity: 0.8 }}>
                      <strong>Reason:</strong> {attempt.success_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, ShieldAlert, FileText, CheckSquare, Activity, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { ImpactBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'

function EvaluationBadge({ level }: { level: string }) {
  if (level === 'per-tool-call') {
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
        background: 'var(--critical-dim)', color: 'var(--critical)', border: '1px solid var(--critical-dim)'
      }}>
        Tool-Call Level
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
      background: 'var(--bg-elevated)', color: 'var(--text-muted)'
    }}>
      Task Level
    </span>
  )
}

export default function FindingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading, error } = useQuery({
    queryKey: ['findings', 'detail', id],
    queryFn: () => api.findings.get(id as string),
    enabled: !!id
  })

  const createRecovery = useMutation({
    mutationFn: () => api.recovery.create({ finding_id: data!.id, agent_id: data!.agent.id }),
    onSuccess: (recoveryRecord) => {
      navigate(`/recovery/${recoveryRecord.id}`)
    }
  })

  if (isLoading) {
    return <div style={{ padding: 24 }}><Skeleton height={200} /></div>
  }

  if (error || !data) {
    return <div style={{ padding: 24, color: 'var(--critical)' }}>Failed to load finding details.</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => navigate('/findings')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '0.875rem'
          }}
        >
          <ArrowLeft size={14} /> Back to Findings
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          title={data.title}
          subtitle={`Identified on ${new Date(data.created_at).toLocaleString()} • Target: ${data.agent.name}`}
        />
        {data.status === 'OPEN' && (
          <button
            onClick={() => createRecovery.mutate()}
            disabled={createRecovery.isPending}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', background: 'var(--accent)',
              border: 'none', borderRadius: 'var(--radius-md)',
              color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600
            }}
          >
            <RefreshCw size={16} />
            {createRecovery.isPending ? 'Starting...' : 'Remediate (Sandbox)'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24, alignItems: 'flex-start' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} color="var(--accent)" /> Description
            </h3>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {data.description}
            </p>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="var(--accent)" /> Simulation Evidence
            </h3>
            <pre style={{ 
              background: 'var(--bg-elevated)', padding: 16, borderRadius: 6, 
              fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', border: '1px solid var(--border-default)'
            }}>
              {data.evidence}
            </pre>
            {data.execution && (
              <button
                onClick={() => navigate(`/attack-simulation/${data.execution_id}`)}
                style={{
                  marginTop: 12, display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.8125rem'
                }}
              >
                <Activity size={14} /> View Full Execution Report
              </button>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={16} color="var(--medium)" /> Remediation Guidance
            </h3>
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {data.recommendation}
            </p>
          </div>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <h4 style={{ fontSize: '0.875rem', marginBottom: 12, color: 'var(--text-muted)' }}>Metadata</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Severity</div>
                <ImpactBadge level={data.severity} />
              </div>
              
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
                  background: data.status === 'OPEN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  color: data.status === 'OPEN' ? 'var(--critical)' : 'var(--low)',
                }}>
                  {data.status}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Finding Type</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  {data.finding_type}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Evaluation Scope</div>
                <EvaluationBadge level={data.evaluation_level || 'per-full-task'} />
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Target Agent</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {data.agent.name}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

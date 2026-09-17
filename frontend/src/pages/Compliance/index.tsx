import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, Activity, AlertTriangle, ExternalLink } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'

export default function CompliancePage() {
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ['compliance', 'summary'],
    queryFn: () => api.compliance.summary(),
  })

  const { data: frameworks, isLoading: isLoadingFrameworks } = useQuery({
    queryKey: ['compliance', 'frameworks'],
    queryFn: () => api.compliance.frameworks(),
  })

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.agents.list(),
  })

  if (isLoadingSummary || isLoadingFrameworks || isLoadingAgents) {
    return (
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[...Array(4)].map((_, i) => <Skeleton key={i} height={60} />)}
      </div>
    )
  }

  if (!summary || !frameworks || !agents) {
    return <div className="error-state">Failed to load compliance data.</div>
  }

  return (
    <div>
      <PageHeader
        title="Governance & Compliance"
        subtitle="Continuous assessment of AI agents against security standards"
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Frameworks Tracked</span>
            <ShieldCheck size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{summary.total_frameworks}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OWASP, NIST, SOC 2</div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Assessments Performed</span>
            <Activity size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{summary.total_assessments}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total evaluations</div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Controls Failing</span>
            <ShieldAlert size={16} color="var(--critical)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--critical)' }}>{summary.controls_failing}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Across all frameworks</div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Agents Non-Compliant</span>
            <AlertTriangle size={16} color="var(--warning)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--warning)' }}>{summary.non_compliant_agents}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requires review</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--border-default)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Agent Compliance Posture</h3>
          </div>
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Type</th>
                  <th>Trust</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {agents.agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {agent.name}
                      </div>
                    </td>
                    <td>
                      <span className="agent-type-label">{agent.agent_type}</span>
                    </td>
                    <td>{agent.trust_level}</td>
                    <td>
                      <Link
                        to={`/compliance/agents/${agent.id}`}
                        style={{
                          color: 'var(--accent)', textDecoration: 'none',
                          fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        View Report <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600 }}>Supported Frameworks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {frameworks.map((fw) => (
              <div key={fw.id} style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{fw.short_name}</span>
                  <span style={{
                    fontSize: '0.6875rem', padding: '2px 6px',
                    borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)'
                  }}>
                    {fw.version}
                  </span>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {fw.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {fw.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

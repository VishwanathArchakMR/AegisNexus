import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Play, Activity } from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { ImpactBadge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import type { AttackExecutionSummary, AttackScenario } from '../../types'

export default function SimulationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [selectedAgentId, setSelectedAgentId] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [attempts, setAttempts] = useState(5)
  const [isSimulating, setIsSimulating] = useState(false)

  // Fetch all scenarios
  const { data: scenarios = [] } = useQuery({
    queryKey: ['simulations', 'scenarios'],
    queryFn: () => api.simulations.scenarios()
  })

  // Fetch all agents (for dropdown)
  const { data: agentsData } = useQuery({
    queryKey: ['agents', 'list', {}],
    queryFn: () => api.agents.list({})
  })

  // Fetch previous executions
  const { data: executions, isLoading, error } = useQuery({
    queryKey: ['simulations', 'executions'],
    queryFn: () => api.simulations.list()
  })

  // Mutation to start simulation
  const startSimulation = useMutation({
    mutationFn: async () => {
      return api.simulations.create({
        target_agent_id: selectedAgentId,
        scenario_id: selectedScenarioId,
        attempts
      })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['simulations', 'executions'] })
      navigate(`/attack-simulation/${data.id}`)
    },
    onSettled: () => setIsSimulating(false)
  })

  const handleStart = () => {
    if (!selectedAgentId || !selectedScenarioId) return
    setIsSimulating(true)
    startSimulation.mutate()
  }

  return (
    <div>
      <PageHeader
        title="Attack Simulations"
        subtitle="Run deterministic adversarial scenarios against your agents to measure Attack Success Rate (ASR)."
      />

      {error && (
        <div className="error-state" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>Failed to load simulation history.</span>
        </div>
      )}

      {/* ── New Simulation Panel ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
          <Activity size={18} color="var(--accent)" /> Launch New Simulation
        </h3>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Target Agent</label>
            <select 
              value={selectedAgentId} 
              onChange={(e) => setSelectedAgentId(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                color: selectedAgentId ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none'
              }}
            >
              <option value="">-- Select Agent --</option>
              {agentsData?.agents.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.agent_type})</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Attack Scenario</label>
            <select 
              value={selectedScenarioId} 
              onChange={(e) => setSelectedScenarioId(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                color: selectedScenarioId ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none'
              }}
            >
              <option value="">-- Select Scenario --</option>
              {scenarios.map((s: AttackScenario) => (
                <option key={s.id} value={s.id}>{s.name} ({s.attack_type})</option>
              ))}
            </select>
          </div>

          <div style={{ width: 100 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>Attempts</label>
            <input 
              type="number" 
              min={1} max={20}
              value={attempts}
              onChange={(e) => setAttempts(parseInt(e.target.value) || 5)}
              style={{
                width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', outline: 'none'
              }}
            />
          </div>

          <button
            onClick={handleStart}
            disabled={!selectedAgentId || !selectedScenarioId || isSimulating}
            style={{
              padding: '8px 16px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, height: 35
            }}
          >
            {isSimulating ? 'Running...' : <><Play size={14} /> Start Simulation</>}
          </button>
        </div>
      </div>

      <h3 style={{ marginBottom: 12, fontSize: '1.125rem' }}>Simulation History</h3>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(3)].map((_, i) => <Skeleton key={i} height={44} />)}
          </div>
        ) : !executions || executions.length === 0 ? (
          <EmptyState title="No simulations run yet" subtitle="Select an agent and scenario above to start." />
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Started At</th>
                  <th>Scenario</th>
                  <th>Target Agent</th>
                  <th>Status</th>
                  <th>ASR (Vulnerability)</th>
                  <th>Severity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {executions.map((exec: AttackExecutionSummary) => (
                  <tr
                    key={exec.id}
                    onClick={() => navigate(`/attack-simulation/${exec.id}`)}
                  >
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {new Date(exec.started_at).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 500 }}>{exec.scenario.name}</td>
                    <td>{exec.target_agent.name}</td>
                    <td>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
                        background: exec.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: exec.status === 'COMPLETED' ? 'var(--low)' : 'var(--medium)',
                      }}>
                        {exec.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                          color: exec.attack_success_rate > 0 ? 'var(--critical)' : 'var(--low)'
                        }}>
                          {(exec.attack_success_rate * 100).toFixed(0)}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ({exec.successful_attempts}/{exec.total_attempts} successful)
                        </span>
                      </div>
                    </td>
                    <td>
                      {exec.severity !== 'NONE' ? <ImpactBadge level={exec.severity} /> : <span style={{color: 'var(--text-muted)'}}>None</span>}
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

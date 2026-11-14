import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Search,
  Filter,
  X,
  Shield,
  Radio,
} from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { ImpactBadge } from '../../components/ui/Badge'
import { MetricCard } from '../../components/ui/MetricCard'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import type { AgentFindingSummary } from '../../types'

function EvaluationBadge({ level }: { level: string }) {
  if (level === 'per-tool-call') {
    return (
      <span
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: '0.6875rem',
          fontWeight: 600,
          background: 'var(--critical-dim)',
          color: 'var(--critical)',
        }}
      >
        Tool-Call Level
      </span>
    )
  }
  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: '0.6875rem',
        fontWeight: 600,
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
      }}
    >
      Task Level
    </span>
  )
}

export default function FindingsPage() {
  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')

  const { data: findings, isLoading, error } = useQuery({
    queryKey: ['findings', 'list'],
    queryFn: () => api.findings.list(),
  })

  // Extract distinct agents for filter dropdown
  const distinctAgents = useMemo(() => {
    if (!findings) return []
    const map = new Map<string, string>()
    findings.forEach((f: AgentFindingSummary) => {
      if (f.agent) {
        map.set(f.agent.id, f.agent.name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [findings])

  // Summary counts
  const summaryMetrics = useMemo(() => {
    if (!findings) {
      return { critical: 0, high: 0, open: 0, resolved: 0, runtime: 0, simulation: 0 }
    }
    return {
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      open: findings.filter((f) => f.status === 'OPEN').length,
      resolved: findings.filter((f) => f.status === 'RESOLVED').length,
      runtime: findings.filter((f) => f.source_type === 'RUNTIME_DETECTION').length,
      simulation: findings.filter((f) => f.source_type !== 'RUNTIME_DETECTION').length,
    }
  }, [findings])

  // Filtered findings list
  const filteredFindings = useMemo(() => {
    if (!findings) return []
    return findings.filter((f: AgentFindingSummary) => {
      if (severityFilter && f.severity !== severityFilter) return false
      if (statusFilter && f.status !== statusFilter) return false
      if (sourceFilter) {
        if (sourceFilter === 'RUNTIME_DETECTION' && f.source_type !== 'RUNTIME_DETECTION') return false
        if (sourceFilter === 'SIMULATION' && f.source_type === 'RUNTIME_DETECTION') return false
      }
      if (agentFilter && f.agent?.id !== agentFilter) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesTitle = f.title.toLowerCase().includes(term)
        const matchesAgent = f.agent?.name?.toLowerCase().includes(term)
        const matchesRule = f.detection_rule?.toLowerCase().includes(term)
        const matchesType = f.finding_type?.toLowerCase().includes(term)
        if (!matchesTitle && !matchesAgent && !matchesRule && !matchesType) return false
      }
      return true
    })
  }, [findings, severityFilter, statusFilter, sourceFilter, agentFilter, searchTerm])

  const hasActiveFilters = Boolean(searchTerm || severityFilter || statusFilter || sourceFilter || agentFilter)

  const clearFilters = () => {
    setSearchTerm('')
    setSeverityFilter('')
    setStatusFilter('')
    setSourceFilter('')
    setAgentFilter('')
  }

  return (
    <div>
      <PageHeader
        title="Security Findings & Vulnerabilities"
        subtitle="Vulnerabilities, policy violations, and runtime anomalies identified from attack simulations and continuous telemetry monitoring."
      />

      {error && (
        <div className="error-state" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>Failed to load security findings. Ensure the backend API is reachable.</span>
        </div>
      )}

      {/* ── Summary Metric Cards ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <MetricCard
          icon={<ShieldAlert size={18} color="var(--critical)" />}
          iconBg="var(--critical-dim)"
          value={isLoading ? '—' : summaryMetrics.critical}
          label="Critical Severity"
          sub="Requires immediate remediation"
          accent="var(--critical)"
        />

        <MetricCard
          icon={<AlertTriangle size={18} color="var(--high)" />}
          iconBg="var(--high-dim)"
          value={isLoading ? '—' : summaryMetrics.high}
          label="High Severity"
          sub="Significant privilege or data exposure"
          accent="var(--high)"
        />

        <MetricCard
          icon={<Shield size={18} color="var(--accent-light)" />}
          iconBg="var(--accent-dim)"
          value={isLoading ? '—' : `${summaryMetrics.open} Open`}
          label="Status Breakdown"
          sub={`${summaryMetrics.resolved} resolved · ${summaryMetrics.open} open`}
          accent="var(--accent)"
        />

        <MetricCard
          icon={<Radio size={18} color="var(--low)" />}
          iconBg="var(--low-dim)"
          value={isLoading ? '—' : `${summaryMetrics.runtime} Runtime`}
          label="Telemetry Provenance"
          sub={`${summaryMetrics.simulation} simulation · ${summaryMetrics.runtime} runtime`}
          accent="var(--low)"
        />
      </div>

      {/* ── Filter Controls Bar ── */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          padding: '12px 16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            placeholder="Search findings by title, rule, agent, or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 30px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Filter size={14} color="var(--text-muted)" />

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: severityFilter ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Severity: All</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: statusFilter ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Status: All</option>
            <option value="OPEN">OPEN</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="IGNORED">IGNORED</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: sourceFilter ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Source: All</option>
            <option value="RUNTIME_DETECTION">RUNTIME TELEMETRY</option>
            <option value="SIMULATION">SIMULATED ATTACK</option>
          </select>

          {distinctAgents.length > 0 && (
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: agentFilter ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: 160,
              }}
            >
              <option value="">Agent: All</option>
              {distinctAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="btn btn-outline btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <X size={12} /> Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Filter metrics counter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>
          Showing {filteredFindings.length} of {findings?.length ?? 0} total findings
        </span>
      </div>

      {/* ── Findings Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        ) : filteredFindings.length === 0 ? (
          <EmptyState
            title="No findings match your criteria"
            subtitle={
              hasActiveFilters
                ? 'Try adjusting or clearing your search filters above.'
                : 'Run attack simulations or observe live agents to discover vulnerabilities.'
            }
          />
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Finding Title</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Target Agent</th>
                  <th>Type / Detection Rule</th>
                  <th>Evaluation Scope</th>
                  <th>Identified On</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((finding: AgentFindingSummary) => {
                  const isRuntime = finding.source_type === 'RUNTIME_DETECTION'

                  return (
                    <tr
                      key={finding.id}
                      onClick={() => navigate(`/findings/${finding.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {finding.severity === 'CRITICAL' && (
                            <ShieldAlert size={14} color="var(--critical)" />
                          )}
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {finding.title}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            background: isRuntime ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                            color: isRuntime ? 'var(--accent-light)' : 'var(--text-muted)',
                            border: `1px solid ${isRuntime ? 'var(--border-accent)' : 'var(--border-default)'}`,
                          }}
                        >
                          {isRuntime ? 'RUNTIME' : 'SIMULATION'}
                        </span>
                      </td>
                      <td>
                        <ImpactBadge level={finding.severity} riskFamilies={finding.risk_families} />
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            background:
                              finding.status === 'OPEN'
                                ? 'var(--critical-dim)'
                                : 'var(--low-dim)',
                            color:
                              finding.status === 'OPEN'
                                ? 'var(--critical)'
                                : 'var(--low)',
                            border: `1px solid ${
                              finding.status === 'OPEN'
                                ? 'rgba(239, 68, 68, 0.2)'
                                : 'rgba(16, 185, 129, 0.2)'
                            }`,
                          }}
                        >
                          {finding.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {finding.agent?.name ?? 'Unknown Agent'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {finding.finding_type}
                          </span>
                          {finding.detection_rule && (
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                color: 'var(--accent-light)',
                                fontFamily: 'var(--font-mono)',
                                marginTop: 2,
                              }}
                            >
                              Rule: {finding.detection_rule}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <EvaluationBadge level={finding.evaluation_level || 'per-full-task'} />
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(finding.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="link-btn" style={{ justifyContent: 'flex-end' }}>
                          View <ArrowRight size={12} />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

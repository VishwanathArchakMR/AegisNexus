import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert,
  Bot,
  Activity,
  AlertTriangle,
  Lock,
} from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { MetricCard } from './components/MetricCard'
import { AgentPreviewTable } from './components/AgentPreviewTable'
import { PipelineBar } from './components/PipelineBar'
import { Skeleton } from '../../components/ui/Skeleton'

export default function DashboardPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: api.dashboard.summary,
    refetchInterval: 60_000,
  })

  const {
    data: agentList,
    isLoading: agentsLoading,
  } = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: () => api.agents.list(),
  })

  const { data: recoverySummary } = useQuery({
    queryKey: ['recovery', 'summary'],
    queryFn: () => api.recovery.summary(),
  })

  const { data: complianceSummary } = useQuery({
    queryKey: ['compliance', 'summary'],
    queryFn: () => api.compliance.summary(),
  })

  // Derive posture color
  const postureColor =
    !summary ? 'var(--text-muted)'
    : summary.posture_score >= 80 ? 'var(--low)'
    : summary.posture_score >= 60 ? 'var(--medium)'
    : summary.posture_score >= 40 ? 'var(--high)'
    : 'var(--critical)'

  return (
    <div>
      <PageHeader
        title="Security Dashboard"
        subtitle="AI agent posture overview & continuous runtime intelligence"
      />

      {/* API error */}
      {summaryError && (
        <div className="error-state" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>
            Cannot reach backend API at{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>localhost:8000</code>.
            Ensure the FastAPI server is running.
          </span>
        </div>
      )}

      {/* ── Metric cards ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {/* Posture Score */}
        <div className="metric-card" style={{ borderColor: `${postureColor}25`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: postureColor, borderRadius: '8px 8px 0 0' }} />
          <div className="metric-card-icon" style={{ background: `${postureColor}15` }}>
            <ShieldAlert size={18} color={postureColor} />
          </div>
          {summaryLoading
            ? <div style={{ marginBottom: 8 }}><Skeleton height={40} width={80} /></div>
            : <div className="metric-card-value" style={{ color: postureColor }}>
                {summary?.posture_score ?? '—'}
              </div>
          }
          <div className="metric-card-label">Security Posture</div>
          <div className="metric-card-sub">
            {summaryLoading
              ? <Skeleton height={10} width="80%" />
              : <><span style={{ color: 'var(--medium)', fontWeight: 600 }}>{summary?.posture_label}</span> — {summary?.posture_status}</>
            }
          </div>
        </div>

        {/* Total Agents & Connectivity */}
        <MetricCard
          icon={<Bot size={18} color="var(--accent-light)" />}
          iconBg="var(--accent-dim)"
          value={summaryLoading ? '—' : (summary?.total_agents ?? 0)}
          label="AI Agents"
          sub={
            summaryLoading
              ? undefined
              : `${summary?.active_agents} active · ${summary?.online_agents ?? 0} online · ${summary?.offline_agents ?? 0} offline`
          }
          accent="var(--accent)"
        />

        {/* Open Vulnerabilities & Detections */}
        <MetricCard
          icon={<Lock size={18} color="var(--high)" />}
          iconBg="var(--high-dim)"
          value={summaryLoading ? '—' : (summary?.open_findings ?? 0)}
          label="Open Findings"
          sub={
            summaryLoading
              ? undefined
              : `${summary?.critical_findings ?? 0} critical · ${summary?.high_findings ?? 0} high · ${summary?.runtime_findings ?? 0} runtime`
          }
          accent="var(--high)"
        />

        {/* Attention */}
        <MetricCard
          icon={<AlertTriangle size={18} color="var(--critical)" />}
          iconBg="var(--critical-dim)"
          value={summaryLoading ? '—' : (summary?.agents_requiring_attention ?? 0)}
          label="Require Attention"
          sub={summaryLoading ? undefined : `${summary?.critical_trust_agents} CRITICAL trust · ${summary?.quarantined_agents} quarantined`}
          accent="var(--critical)"
        />
      </div>

      {/* ── Pipeline bar ── */}
      <div style={{ marginBottom: 24 }}>
        <PipelineBar
          summary={summary}
          recoverySummary={recoverySummary}
          complianceSummary={complianceSummary}
        />
      </div>

      {/* ── Agent inventory preview ── */}
      <AgentPreviewTable
        agents={agentList?.agents ?? []}
        isLoading={agentsLoading}
      />

      {/* ── Stat row ── */}
      {!summaryLoading && summary && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            flexWrap: 'wrap',
          }}
        >
          <span><Activity size={11} style={{ marginRight: 4 }} color="var(--low)" />SYSTEM ONLINE</span>
          <span>AGENTS: {summary.total_agents} ({summary.online_agents ?? 0} ONLINE)</span>
          <span>CAPABILITIES: {summary.total_capabilities}</span>
          <span>RUNTIME EVENTS: {summary.total_runtime_events ?? 0}</span>
          <span>FINDINGS: {summary.open_findings} OPEN ({summary.runtime_findings ?? 0} RUNTIME)</span>
          <span style={{ marginLeft: 'auto' }}>
            POSTURE ENGINE: {summary.posture_label}
          </span>
        </div>
      )}
    </div>
  )
}

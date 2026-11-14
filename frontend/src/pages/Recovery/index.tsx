import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheck,
  TrendingDown,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Shield,
} from 'lucide-react'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/layout/PageHeader'
import { MetricCard } from '../../components/ui/MetricCard'
import { Skeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { RecoveryStatusBadge, SourceBadge, Badge } from '../../components/ui/Badge'
import type { RecoveryRecord, AgentSummary } from '../../types'

export default function Recovery() {
  const navigate = useNavigate()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['recovery', 'summary'],
    queryFn: () => api.recovery.summary(),
  })

  const {
    data: records,
    isLoading: isRecordsLoading,
    error: recordsError,
    refetch: refetchRecords,
  } = useQuery({
    queryKey: ['recovery', 'list'],
    queryFn: () => api.recovery.list(),
  })

  const { data: agentData } = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: () => api.agents.list(),
  })

  const agentMap = (agentData?.agents ?? []).reduce<Record<string, string>>((acc, a: AgentSummary) => {
    acc[a.id] = a.name
    return acc
  }, {})

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refetchSummary(), refetchRecords()])
    setIsRefreshing(false)
  }

  const pendingVerificationCount =
    (summary?.planned ?? 0) +
    (summary?.approval_required ?? 0) +
    (summary?.executing ?? 0) +
    (summary?.awaiting_revalidation ?? 0)

  return (
    <div>
      <PageHeader
        title="Recovery & Remediation Ledger"
        subtitle="Track deterministic security remediations, verify recovery outcomes and maintain tamper-evident evidence."
        actions={
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh Ledger
          </button>
        }
      />

      {/* Error state */}
      {(summaryError || recordsError) && (
        <div className="error-state" style={{ marginBottom: 24 }}>
          <AlertTriangle size={16} />
          <span>
            Failed to communicate with recovery ledger endpoints. Ensure the backend API is active on port 8000.
          </span>
        </div>
      )}

      {/* ── Summary Metric Cards ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <MetricCard
          icon={<ShieldCheck size={18} color="var(--accent-light)" />}
          iconBg="var(--accent-dim)"
          value={isSummaryLoading ? '—' : (summary?.total_recovery_records ?? 0)}
          label="Total Ledgers"
          sub="Tracked remediation plans"
          accent="var(--accent)"
        />

        <MetricCard
          icon={<TrendingDown size={18} color="var(--low)" />}
          iconBg="var(--low-dim)"
          value={
            isSummaryLoading
              ? '—'
              : `+${(summary?.average_asr_reduction ?? 0).toFixed(1)} pts`
          }
          label="Avg. ASR Reduction"
          sub="Percentage points reduction"
          accent="var(--low)"
        />

        <MetricCard
          icon={<CheckCircle2 size={18} color="var(--low)" />}
          iconBg="var(--low-dim)"
          value={isSummaryLoading ? '—' : (summary?.recovered ?? 0)}
          label="Successfully Recovered"
          sub="Hardened & empirically verified"
          accent="var(--low)"
        />

        <MetricCard
          icon={<Clock size={18} color="var(--high)" />}
          iconBg="var(--high-dim)"
          value={isSummaryLoading ? '—' : pendingVerificationCount}
          label="Pending Verification"
          sub="Awaiting operator or re-test"
          accent="var(--high)"
        />
      </div>

      {/* ── Recovery Records Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Remediation Ledgers & Attestation History
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 2,
              }}
            >
              Cryptographically chained recovery events with deterministic baseline verification
            </div>
          </div>
          <span className="badge badge-neutral">
            {records?.length ?? 0} {records?.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        {isRecordsLoading ? (
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={44} />
            ))}
          </div>
        ) : !records || records.length === 0 ? (
          <EmptyState
            title="No recovery records found"
            subtitle="Recovery plans are generated from detected security findings. Run simulations or inspect findings to initiate recovery."
          />
        ) : (
          <div className="data-table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record ID</th>
                  <th>Target Agent</th>
                  <th>Remediation Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Previous ASR</th>
                  <th>Current ASR</th>
                  <th>ASR Reduction</th>
                  <th>Residual Risk</th>
                  <th>Verification</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record: RecoveryRecord) => {
                  const isRuntime =
                    record.previous_asr == null && record.verification_execution_id == null
                  const shortId = record.id.split('-')[0]
                  const agentName = agentMap[record.agent_id] || record.agent_id.split('-')[0]

                  const asrReduction =
                    record.previous_asr != null && record.current_asr != null
                      ? (record.previous_asr - record.current_asr).toFixed(1)
                      : null

                  return (
                    <tr
                      key={record.id}
                      onClick={() => navigate(`/recovery/${record.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-light)' }}>
                        {shortId}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Shield size={14} color="var(--text-muted)" />
                          <span style={{ fontWeight: 500 }}>{agentName}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {record.remediation_type || 'Unplanned'}
                        </span>
                      </td>
                      <td>
                        <SourceBadge source={isRuntime ? 'RUNTIME_DETECTION' : 'SIMULATION'} />
                      </td>
                      <td>
                        <RecoveryStatusBadge status={record.status} />
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {record.previous_asr != null ? `${record.previous_asr.toFixed(1)}%` : '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {record.current_asr != null ? `${record.current_asr.toFixed(1)}%` : '—'}
                      </td>
                      <td>
                        {asrReduction != null ? (
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: Number(asrReduction) > 0 ? 'var(--low)' : 'var(--text-muted)',
                            }}
                          >
                            +{asrReduction} pts
                          </span>
                        ) : isRuntime && record.status === 'RECOVERED' ? (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--accent-light)', fontWeight: 600 }}>
                            Attested
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        {record.residual_risk ? (
                          <Badge
                            variant={
                              record.residual_risk === 'LOW'
                                ? 'low'
                                : record.residual_risk === 'MEDIUM'
                                ? 'medium'
                                : record.residual_risk === 'HIGH'
                                ? 'high'
                                : 'critical'
                            }
                          >
                            {record.residual_risk}
                          </Badge>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color:
                              record.verification_status === 'PASSED'
                                ? 'var(--low)'
                                : record.verification_status === 'FAILED'
                                ? 'var(--critical)'
                                : 'var(--text-muted)',
                          }}
                        >
                          {record.verification_status || 'PENDING'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/recovery/${record.id}`}
                          className="link-btn"
                          onClick={(e) => e.stopPropagation()}
                          style={{ justifyContent: 'flex-end' }}
                        >
                          View Ledger <ArrowRight size={12} />
                        </Link>
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

import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
} from 'lucide-react'
import { api } from '../../lib/api'
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'
import { PageHeader } from '../../components/layout/PageHeader'
import { Skeleton } from '../../components/ui/Skeleton'
import { RecoveryStatusBadge, SourceBadge, Badge } from '../../components/ui/Badge'
import type { RecoveryEvent } from '../../types'

export default function RecoveryDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [showRevalidateModal, setShowRevalidateModal] = useState(false)
  const [operatorDecision, setOperatorDecision] = useState<'RESOLVED' | 'PARTIAL' | 'REOPENED'>('RESOLVED')
  const [rationale, setRationale] = useState('')
  const [evidenceNotes, setEvidenceNotes] = useState('')

  const { data: record, isLoading: isRecordLoading } = useQuery({
    queryKey: ['recovery', id],
    queryFn: () => api.recovery.get(id!),
    enabled: !!id,
  })

  const { data: events, isLoading: isEventsLoading } = useQuery({
    queryKey: ['recovery', id, 'events'],
    queryFn: () => api.recovery.events(id!),
    enabled: !!id,
  })

  const { data: ledgerVerification, refetch: verifyLedger, isFetching: isVerifyingLedger } = useQuery({
    queryKey: ['recovery', id, 'verify-ledger'],
    queryFn: () => api.recovery.verifyChain(id!),
    enabled: !!id,
  })

  const planMutation = useMutation({
    mutationFn: () => api.recovery.plan(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery', id] })
      queryClient.invalidateQueries({ queryKey: ['recovery', id, 'events'] })
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => api.recovery.approve(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery', id] })
      queryClient.invalidateQueries({ queryKey: ['recovery', id, 'events'] })
    },
  })

  const executeMutation = useMutation({
    mutationFn: () => api.recovery.execute(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery', id] })
      queryClient.invalidateQueries({ queryKey: ['recovery', id, 'events'] })
    },
  })

  const verifyMutation = useMutation({
    mutationFn: () => api.recovery.verify(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery', id] })
      queryClient.invalidateQueries({ queryKey: ['recovery', id, 'events'] })
    },
  })

  const revalidateMutation = useMutation({
    mutationFn: (data: { operator_decision: string; rationale: string; evidence_notes?: string }) =>
      api.recovery.revalidate(id!, data),
    onSuccess: () => {
      setShowRevalidateModal(false)
      setRationale('')
      setEvidenceNotes('')
      queryClient.invalidateQueries({ queryKey: ['recovery', id] })
      queryClient.invalidateQueries({ queryKey: ['recovery', id, 'events'] })
      queryClient.invalidateQueries({ queryKey: ['recovery', id, 'verify-ledger'] })
    },
  })

  if (isRecordLoading || !record) {
    return (
      <div>
        <PageHeader title="Recovery Ledger Detail" subtitle="Loading recovery record..." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={120} />
          <Skeleton height={300} />
        </div>
      </div>
    )
  }

  const isRuntimeFinding = record.previous_asr == null && record.verification_execution_id == null
  const shortId = record.id.split('-')[0]

  // Flow Graph nodes adapting based on finding provenance
  const nodes: Node[] = [
    {
      id: 'finding',
      position: { x: 30, y: 40 },
      data: { label: isRuntimeFinding ? 'Runtime Finding' : 'Simulation Finding' },
      style: {
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '8px 12px',
      },
    },
    {
      id: 'plan',
      position: { x: 220, y: 40 },
      data: { label: 'Plan Created' },
      style: {
        background: record.status !== 'OPEN' ? 'var(--accent-dim)' : 'var(--bg-elevated)',
        color: record.status !== 'OPEN' ? 'var(--accent-light)' : 'var(--text-muted)',
        border: `1px solid ${record.status !== 'OPEN' ? 'var(--accent)' : 'var(--border-strong)'}`,
        borderRadius: 8,
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '8px 12px',
      },
    },
    {
      id: 'approve',
      position: { x: 410, y: 40 },
      data: { label: 'Approved' },
      style: {
        background:
          ['APPROVED', 'VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(
            record.status
          )
            ? 'var(--accent-dim)'
            : 'var(--bg-elevated)',
        color:
          ['APPROVED', 'VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(
            record.status
          )
            ? 'var(--accent-light)'
            : 'var(--text-muted)',
        border: `1px solid ${
          ['APPROVED', 'VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(
            record.status
          )
            ? 'var(--accent)'
            : 'var(--border-strong)'
        }`,
        borderRadius: 8,
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '8px 12px',
      },
    },
    {
      id: 'execute',
      position: { x: 220, y: 140 },
      data: { label: isRuntimeFinding ? 'Remediation Applied' : 'Simulated Hardening' },
      style: {
        background:
          ['VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(
            record.status
          )
            ? 'var(--accent-dim)'
            : 'var(--bg-elevated)',
        color:
          ['VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(
            record.status
          )
            ? 'var(--accent-light)'
            : 'var(--text-muted)',
        border: `1px solid ${
          ['VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(
            record.status
          )
            ? 'var(--accent)'
            : 'var(--border-strong)'
        }`,
        borderRadius: 8,
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '8px 12px',
      },
    },
    {
      id: 'verify',
      position: { x: 410, y: 140 },
      data: { label: isRuntimeFinding ? 'Runtime Revalidation' : 'Attack Re-test' },
      style: {
        background:
          ['RECOVERED', 'PARTIALLY_RECOVERED'].includes(record.status)
            ? 'var(--low-dim)'
            : record.status === 'AWAITING_RUNTIME_REVALIDATION'
            ? 'var(--high-dim)'
            : record.status === 'FAILED'
            ? 'var(--critical-dim)'
            : 'var(--bg-elevated)',
        color:
          ['RECOVERED', 'PARTIALLY_RECOVERED'].includes(record.status)
            ? 'var(--low)'
            : record.status === 'AWAITING_RUNTIME_REVALIDATION'
            ? 'var(--high)'
            : record.status === 'FAILED'
            ? 'var(--critical)'
            : 'var(--text-muted)',
        border: `1px solid ${
          ['RECOVERED', 'PARTIALLY_RECOVERED'].includes(record.status)
            ? 'var(--low)'
            : record.status === 'AWAITING_RUNTIME_REVALIDATION'
            ? 'var(--high)'
            : record.status === 'FAILED'
            ? 'var(--critical)'
            : 'var(--border-strong)'
        }`,
        borderRadius: 8,
        fontSize: '0.75rem',
        fontWeight: 600,
        padding: '8px 12px',
      },
    },
  ]

  const edges: Edge[] = [
    { id: 'e1', source: 'finding', target: 'plan', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' }, style: { stroke: 'var(--border-strong)' } },
    { id: 'e2', source: 'plan', target: 'approve', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' }, style: { stroke: 'var(--border-strong)' } },
    { id: 'e3', source: 'approve', target: 'execute', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' }, style: { stroke: 'var(--border-strong)' } },
    { id: 'e4', source: 'execute', target: 'verify', markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' }, style: { stroke: 'var(--border-strong)' } },
  ]

  const asrReductionPts =
    record.previous_asr != null && record.current_asr != null
      ? (record.previous_asr - record.current_asr).toFixed(1)
      : null

  return (
    <div>
      {/* ── Top Header ── */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Link to="/recovery" className="link-btn" style={{ gap: 4 }}>
              <ArrowLeft size={14} /> Back to Ledgers
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              Ledger <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-light)' }}>{shortId}</span>
            </h1>
            <RecoveryStatusBadge status={record.status} />
            <SourceBadge source={isRuntimeFinding ? 'RUNTIME_DETECTION' : 'SIMULATION'} />
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <span>
              Target Agent:{' '}
              <Link to={`/agents/${record.agent_id}`} style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                {record.agent_id.split('-')[0]}
              </Link>
            </span>
            <span>·</span>
            <span>
              Originating Finding:{' '}
              <Link to={`/findings/${record.finding_id}`} style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)' }}>
                {record.finding_id.split('-')[0]}
              </Link>
            </span>
          </div>
        </div>

        {/* ── Action Controls ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {record.status === 'OPEN' && (
            <button
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending}
              className="btn btn-primary"
            >
              {planMutation.isPending ? 'Generating Plan...' : 'Generate Plan'}
            </button>
          )}

          {record.status === 'PLANNED' && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="btn btn-success"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Plan'}
            </button>
          )}

          {record.status === 'APPROVED' && (
            <button
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending}
              className="btn btn-primary"
            >
              {executeMutation.isPending
                ? 'Applying...'
                : isRuntimeFinding
                ? 'Apply Remediation'
                : 'Execute Simulated Hardening'}
            </button>
          )}

          {record.status === 'AWAITING_RUNTIME_REVALIDATION' && (
            <button
              onClick={() => setShowRevalidateModal(true)}
              className="btn btn-warning"
              style={{ boxShadow: '0 2px 8px rgba(249, 115, 22, 0.25)' }}
            >
              <FileCheck size={14} /> Attest & Revalidate
            </button>
          )}

          {record.status === 'VERIFYING' && record.execution_status === 'SIMULATED' && (
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              className="btn btn-primary"
            >
              {verifyMutation.isPending ? 'Re-testing...' : 'Verify Residual Risk'}
            </button>
          )}
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Left Column: Details & Lifecycle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card: Remediation Details */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Remediation Strategy & Controls</span>
              <span className="badge badge-neutral">{record.remediation_type || 'Custom'}</span>
            </div>

            {record.status === 'OPEN' ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Ledger initialized. Click <strong>Generate Plan</strong> to map the security finding to a hardening profile.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Remediation Plan Title
                  </div>
                  <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {record.title || record.remediation_type}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Description
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {record.description || 'No description provided.'}
                  </p>
                </div>

                {record.recommended_action && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Recommended Action
                    </div>
                    <div className="code-block" style={{ whiteSpace: 'pre-wrap' }}>
                      {record.recommended_action}
                    </div>
                  </div>
                )}

                {record.before_state && record.after_state && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
                    <div style={{ background: 'var(--critical-dim)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--critical)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Baseline State (Vulnerable)
                      </div>
                      <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', overflowX: 'auto' }}>
                        {JSON.stringify(record.before_state, null, 2)}
                      </pre>
                    </div>

                    <div style={{ background: 'var(--low-dim)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--low)', textTransform: 'uppercase', marginBottom: 6 }}>
                        Hardened State (Applied)
                      </div>
                      <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', overflowX: 'auto' }}>
                        {JSON.stringify(record.after_state, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {record.runtime_revalidation_notes && (
                  <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-md)', padding: 16, marginTop: 8 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={14} color="var(--accent-light)" /> Operator Runtime Attestation & Evidence
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>
                      {record.runtime_revalidation_notes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card: Execution Lifecycle Graph */}
          <div className="card" style={{ height: 320, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <span className="card-title">Remediation Lifecycle Graph</span>
              <span className="badge badge-accent">Interactive Visualizer</span>
            </div>
            <div style={{ flex: 1, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
              <ReactFlow nodes={nodes} edges={edges} fitView>
                <Background color="rgba(255, 255, 255, 0.05)" gap={16} />
                <Controls />
              </ReactFlow>
            </div>
          </div>
        </div>

        {/* Right Column: Outcomes & Hash Chain Ledger */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card: Verification Outcomes */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Verification Metrics</span>
              <Badge variant={record.verification_status === 'PASSED' ? 'low' : record.verification_status === 'FAILED' ? 'critical' : 'neutral'}>
                {record.verification_status || 'PENDING'}
              </Badge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Baseline ASR</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600, color: record.previous_asr != null ? 'var(--critical)' : 'var(--text-muted)' }}>
                  {record.previous_asr != null ? `${record.previous_asr.toFixed(1)}%` : 'N/A (Runtime)'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Verified Post-ASR</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600, color: record.current_asr === 0 ? 'var(--low)' : 'var(--text-primary)' }}>
                  {record.current_asr != null
                    ? `${record.current_asr.toFixed(1)}%`
                    : isRuntimeFinding
                    ? record.status === 'RECOVERED'
                      ? 'Attested Clean'
                      : 'Pending Attestation'
                    : 'Pending Retest'}
                </span>
              </div>

              {asrReductionPts && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>ASR Reduction</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.125rem', fontWeight: 700, color: 'var(--low)' }}>
                    +{asrReductionPts} pts
                  </span>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', fontWeight: 600 }}>
                  Residual Risk Assessment
                </span>
                {record.residual_risk ? (
                  <div>
                    <Badge variant={record.residual_risk === 'LOW' ? 'low' : record.residual_risk === 'MEDIUM' ? 'medium' : 'critical'}>
                      {record.residual_risk} RISK
                    </Badge>
                    {record.residual_risk_explanation && (
                      <p style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {record.residual_risk_explanation}
                      </p>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Not yet assessed</span>
                )}
              </div>
            </div>
          </div>

          {/* Card: Ledger Integrity Status */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Cryptographic Integrity</span>
              <button
                onClick={() => verifyLedger()}
                disabled={isVerifyingLedger}
                className="btn btn-outline btn-sm"
              >
                {isVerifyingLedger ? 'Verifying...' : 'Verify Chain'}
              </button>
            </div>

            {ledgerVerification && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: ledgerVerification.is_valid ? 'var(--low)' : 'var(--critical)', fontWeight: 600 }}>
                  {ledgerVerification.is_valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{ledgerVerification.is_valid ? 'Ledger Hash Chain Valid' : 'Tamper Detected!'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {ledgerVerification.total_events} sequential events verified · No break in SHA-256 links
                </div>
              </div>
            )}
          </div>

          {/* Card: Cryptographic Audit Ledger */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">Audit Ledger Timeline</span>
              <span className="badge badge-neutral">{events?.length ?? 0} Events</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {isEventsLoading ? (
                <Skeleton height={80} />
              ) : !events?.length ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>No audit events recorded yet.</div>
              ) : (
                events.map((event: RecoveryEvent) => (
                  <div
                    key={event.id}
                    style={{
                      borderLeft: '2px solid var(--border-accent)',
                      paddingLeft: 12,
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: -5,
                        top: 2,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--accent)',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {event.event_type}
                      </span>
                      <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {new Date(event.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {event.message}
                    </div>

                    <div style={{ marginTop: 6, fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>Hash: {event.event_hash ? `${event.event_hash.slice(0, 16)}...` : 'None'}</span>
                      {event.previous_hash && (
                        <span>Prev: {event.previous_hash.slice(0, 16)}...</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Runtime Revalidation Modal ── */}
      {showRevalidateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Operator Runtime Revalidation
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Attest that the observed runtime vulnerability has been resolved in production or sandbox telemetry.
              This appends a cryptographically chained event to the audit ledger without fabricating synthetic attack executions.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Decision
                </label>
                <select
                  value={operatorDecision}
                  onChange={(e) => setOperatorDecision(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                  }}
                >
                  <option value="RESOLVED">RESOLVED — Vulnerability successfully remediated</option>
                  <option value="PARTIAL">PARTIAL — Partially mitigated with residual controls</option>
                  <option value="REOPENED">REOPENED — Issue persists / verification failed</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Rationale *
                </label>
                <textarea
                  rows={3}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="e.g. Scoped agent tool bindings in production; verified no undeclared capability invocations in past 24 hours."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Evidence Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. PR #42, runtime trace IDs, or security log hashes."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowRevalidateModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rationale.trim() || revalidateMutation.isPending}
                  onClick={() =>
                    revalidateMutation.mutate({
                      operator_decision: operatorDecision,
                      rationale: rationale.trim(),
                      evidence_notes: evidenceNotes.trim() || undefined,
                    })
                  }
                  className="btn btn-primary"
                >
                  {revalidateMutation.isPending ? 'Recording...' : 'Record Attestation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'

export default function RecoveryDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [showRevalidateModal, setShowRevalidateModal] = useState(false)
  const [operatorDecision, setOperatorDecision] = useState<'RESOLVED' | 'PARTIAL' | 'REOPENED'>('RESOLVED')
  const [rationale, setRationale] = useState('')
  const [evidenceNotes, setEvidenceNotes] = useState('')

  const { data: record, isLoading } = useQuery({
    queryKey: ['recovery', id],
    queryFn: () => api.recovery.get(id!),
    enabled: !!id,
  })

  const { data: events } = useQuery({
    queryKey: ['recovery', id, 'events'],
    queryFn: () => api.recovery.events(id!),
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
    },
  })

  if (isLoading || !record) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Loading ledger...</div>
    )
  }

  const isRuntimeFinding = record.previous_asr == null && record.verification_execution_id == null

  // Flow Graph nodes adapting based on finding provenance
  const nodes: Node[] = [
    {
      id: 'finding',
      position: { x: 50, y: 50 },
      data: { label: isRuntimeFinding ? 'Runtime Finding' : 'Simulation Finding' },
      style: { background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '8px' }
    },
    {
      id: 'plan',
      position: { x: 260, y: 50 },
      data: { label: 'Plan Created' },
      style: { background: record.status !== 'OPEN' ? '#0d9488' : '#1f2937', color: 'white', border: '1px solid #14b8a6', borderRadius: '8px' }
    },
    {
      id: 'approve',
      position: { x: 470, y: 50 },
      data: { label: 'Approved' },
      style: { background: ['APPROVED', 'VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(record.status) ? '#0d9488' : '#1f2937', color: 'white', border: '1px solid #14b8a6', borderRadius: '8px' }
    },
    {
      id: 'execute',
      position: { x: 260, y: 170 },
      data: { label: isRuntimeFinding ? 'Remediation Applied' : 'Simulated Hardening' },
      style: { background: ['VERIFYING', 'AWAITING_RUNTIME_REVALIDATION', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(record.status) ? '#0d9488' : '#1f2937', color: 'white', border: '1px solid #14b8a6', borderRadius: '8px' }
    },
    {
      id: 'verify',
      position: { x: 470, y: 170 },
      data: { label: isRuntimeFinding ? 'Runtime Revalidation' : 'Attack Re-test' },
      style: {
        background: ['RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(record.status)
          ? (record.verification_status === 'PASSED' ? '#059669' : '#b91c1c')
          : record.status === 'AWAITING_RUNTIME_REVALIDATION' ? '#d97706' : '#1f2937',
        color: 'white',
        border: '1px solid #34d399',
        borderRadius: '8px'
      }
    }
  ]

  const edges: Edge[] = [
    { id: 'e1', source: 'finding', target: 'plan', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } },
    { id: 'e2', source: 'plan', target: 'approve', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } },
    { id: 'e3', source: 'approve', target: 'execute', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } },
    { id: 'e4', source: 'execute', target: 'verify', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } }
  ]

  const asrReductionPts = (record.previous_asr != null && record.current_asr != null)
    ? (record.previous_asr - record.current_asr).toFixed(1)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/recovery" className="text-gray-400 hover:text-white">← Back</Link>
              <h1 className="text-2xl font-bold tracking-tight text-white">Recovery Ledger: {record.id.split('-')[0]}</h1>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                  record.status === 'RECOVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  record.status === 'FAILED' || record.status === 'REOPENED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  record.status === 'AWAITING_RUNTIME_REVALIDATION' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold' :
                  'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                }`}>
                {record.status}
              </span>
            </div>
            <p className="text-gray-400 mt-2">
              Agent ID: <Link to={`/agents/${record.agent_id}`} className="text-cyan-400 hover:underline">{record.agent_id}</Link>
            </p>
          </div>
          
          <div className="flex gap-3">
            {record.status === 'OPEN' && (
              <button
                onClick={() => planMutation.mutate()}
                disabled={planMutation.isPending}
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {planMutation.isPending ? 'Generating...' : 'Generate Plan'}
              </button>
            )}
            {record.status === 'PLANNED' && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve Plan'}
              </button>
            )}
            {record.status === 'APPROVED' && (
              <button
                onClick={() => executeMutation.mutate()}
                disabled={executeMutation.isPending}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {executeMutation.isPending ? 'Applying...' : isRuntimeFinding ? 'Apply Remediation' : 'Execute Simulation'}
              </button>
            )}
            {record.status === 'AWAITING_RUNTIME_REVALIDATION' && (
              <button
                onClick={() => setShowRevalidateModal(true)}
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              >
                Attest & Revalidate
              </button>
            )}
            {record.status === 'VERIFYING' && record.execution_status === 'SIMULATED' && (
              <button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {verifyMutation.isPending ? 'Verifying...' : 'Verify Residual Risk'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
              <h2 className="text-lg font-medium text-white mb-4">Remediation Details</h2>
              {record.status === 'OPEN' ? (
                <div className="text-gray-400 text-sm">
                  Ledger created. Generate a plan to map the finding to a remediation strategy.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Type</h3>
                    <p className="mt-1 text-white">{record.remediation_type}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Description</h3>
                    <p className="mt-1 text-white">{record.description}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400">Recommended Action</h3>
                    <pre className="mt-1 text-sm text-gray-300 bg-black/20 p-3 rounded-lg border border-white/5 whitespace-pre-wrap font-sans">
                      {record.recommended_action}
                    </pre>
                  </div>
                  {record.before_state && record.after_state && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10">
                        <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Before State (Baseline)</h4>
                        <pre className="text-xs text-gray-300 overflow-x-auto">{JSON.stringify(record.before_state, null, 2)}</pre>
                      </div>
                      <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/10">
                        <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">After State (Hardening Applied)</h4>
                        <pre className="text-xs text-gray-300 overflow-x-auto">{JSON.stringify(record.after_state, null, 2)}</pre>
                      </div>
                    </div>
                  )}

                  {record.runtime_revalidation_notes && (
                    <div className="mt-4 p-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
                      <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-2">Operator Runtime Attestation & Evidence</h4>
                      <pre className="text-xs text-gray-200 whitespace-pre-wrap font-mono">{record.runtime_revalidation_notes}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Lifecycle Flow */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md h-80">
              <h2 className="text-lg font-medium text-white mb-4">Execution Lifecycle</h2>
              <div className="h-64 w-full">
                <ReactFlow nodes={nodes} edges={edges} fitView>
                  <Background color="#374151" gap={16} />
                  <Controls />
                </ReactFlow>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
              <h2 className="text-lg font-medium text-white mb-4">Verification Results</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-sm text-gray-400">Baseline ASR</span>
                  <span className="text-lg font-medium text-red-400 font-mono">
                    {record.previous_asr != null ? `${record.previous_asr.toFixed(1)}%` : 'N/A (Runtime)'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-sm text-gray-400">Post-Remediation ASR</span>
                  <span className={`text-lg font-medium font-mono ${record.current_asr === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {record.current_asr != null ? `${record.current_asr.toFixed(1)}%` : (isRuntimeFinding ? (record.status === 'RECOVERED' ? 'Attested Clean' : 'Pending Attestation') : 'Pending Test')}
                  </span>
                </div>
                {asrReductionPts && (
                  <div className="flex justify-between items-center pb-4 border-b border-white/10">
                    <span className="text-sm text-gray-400">ASR Reduction</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      +{asrReductionPts} pts
                    </span>
                  </div>
                )}
                <div className="pt-2">
                  <span className="text-sm text-gray-400 block mb-1">Residual Risk</span>
                  {record.residual_risk ? (
                    <div>
                      <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-bold ${
                        record.residual_risk === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        record.residual_risk === 'HIGH' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        record.residual_risk === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {record.residual_risk}
                      </span>
                      <p className="mt-2 text-xs text-gray-400">{record.residual_risk_explanation}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Not assessed</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
              <h2 className="text-lg font-medium text-white mb-4">Cryptographic Audit Ledger</h2>
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {events?.map((event) => (
                  <div key={event.id} className="relative pl-4 border-l border-white/10 pb-4 last:pb-0">
                    <div className="absolute w-2 h-2 bg-cyan-500 rounded-full -left-[5px] top-1.5 ring-4 ring-black"></div>
                    <p className="text-xs text-cyan-400 font-mono mb-1">{new Date(event.created_at).toLocaleString()}</p>
                    <p className="text-sm font-medium text-white">{event.event_type}</p>
                    <p className="text-xs text-gray-400 mt-1">{event.message}</p>
                  </div>
                ))}
                {!events?.length && <p className="text-sm text-gray-500">No events recorded yet.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Runtime Revalidation Modal */}
        {showRevalidateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-white/10 bg-gray-900 p-6 space-y-4">
              <h3 className="text-lg font-bold text-white">Operator Runtime Revalidation</h3>
              <p className="text-xs text-gray-400">
                Attest that the observed runtime vulnerability has been resolved in production or sandbox telemetry.
                This appends a cryptographically chained event to the audit ledger without fabricating simulated attack executions.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Decision</label>
                <select
                  value={operatorDecision}
                  onChange={(e) => setOperatorDecision(e.target.value as any)}
                  className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="RESOLVED">RESOLVED — Vulnerability successfully remediated</option>
                  <option value="PARTIAL">PARTIAL — Partially mitigated with residual controls</option>
                  <option value="REOPENED">REOPENED — Issue persists / verification failed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Rationale</label>
                <textarea
                  rows={3}
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="e.g. Scoped agent tool bindings in production; verified no undeclared capability invocations in past 24 hours."
                  className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Evidence Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Trace IDs, PR reference, or runtime event hashes."
                  className="w-full rounded bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevalidateModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rationale.trim() || revalidateMutation.isPending}
                  onClick={() => revalidateMutation.mutate({
                    operator_decision: operatorDecision,
                    rationale: rationale.trim(),
                    evidence_notes: evidenceNotes.trim() || undefined
                  })}
                  className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {revalidateMutation.isPending ? 'Submitting...' : 'Record Attestation'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

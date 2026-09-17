import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import ReactFlow, { Background, Controls, Node, Edge, MarkerType } from 'reactflow'
import 'reactflow/dist/style.css'

export default function RecoveryDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

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

  if (isLoading || !record) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">Loading ledger...</div>
    )
  }

  // Basic Flow Graph for Visualizing State changes
  const nodes: Node[] = [
    {
      id: 'finding',
      position: { x: 50, y: 50 },
      data: { label: 'Finding Detected' },
      style: { background: '#1f2937', color: 'white', border: '1px solid #374151', borderRadius: '8px' }
    },
    {
      id: 'plan',
      position: { x: 300, y: 50 },
      data: { label: 'Plan Created' },
      style: { background: record.status !== 'OPEN' ? '#0d9488' : '#1f2937', color: 'white', border: '1px solid #14b8a6', borderRadius: '8px' }
    },
    {
      id: 'approve',
      position: { x: 550, y: 50 },
      data: { label: 'Approved' },
      style: { background: ['APPROVED', 'VERIFYING', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(record.status) ? '#0d9488' : '#1f2937', color: 'white', border: '1px solid #14b8a6', borderRadius: '8px' }
    },
    {
      id: 'execute',
      position: { x: 300, y: 200 },
      data: { label: 'Simulated Execution' },
      style: { background: ['VERIFYING', 'RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(record.status) ? '#0d9488' : '#1f2937', color: 'white', border: '1px solid #14b8a6', borderRadius: '8px' }
    },
    {
      id: 'verify',
      position: { x: 550, y: 200 },
      data: { label: 'Verification' },
      style: { background: ['RECOVERED', 'PARTIALLY_RECOVERED', 'FAILED'].includes(record.status) ? (record.verification_status === 'PASSED' ? '#059669' : '#b91c1c') : '#1f2937', color: 'white', border: '1px solid #34d399', borderRadius: '8px' }
    }
  ]

  const edges: Edge[] = [
    { id: 'e1', source: 'finding', target: 'plan', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } },
    { id: 'e2', source: 'plan', target: 'approve', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } },
    { id: 'e3', source: 'approve', target: 'execute', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } },
    { id: 'e4', source: 'execute', target: 'verify', markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' }, style: { stroke: '#9ca3af' } }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link to="/recovery" className="text-gray-400 hover:text-white">← Back</Link>
              <h1 className="text-2xl font-bold tracking-tight text-white">Recovery Ledger: {record.id.split('-')[0]}</h1>
              <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                  record.status === 'RECOVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  record.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-amber-500/10 text-amber-400 border border-amber-500/20'
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
                {executeMutation.isPending ? 'Simulating...' : 'Execute Simulation'}
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
                    <pre className="mt-1 text-sm text-gray-300 bg-black/20 p-3 rounded-lg border border-white/5 whitespace-pre-wrap">
                      {record.recommended_action}
                    </pre>
                  </div>
                  {record.before_state && record.after_state && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10">
                        <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Before State (Overrides disabled)</h4>
                        <pre className="text-xs text-gray-300">{JSON.stringify(record.before_state, null, 2)}</pre>
                      </div>
                      <div className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/10">
                        <h4 className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">After State (Simulated Hardening)</h4>
                        <pre className="text-xs text-gray-300">{JSON.stringify(record.after_state, null, 2)}</pre>
                      </div>
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
                  <span className="text-sm text-gray-400">Original ASR</span>
                  <span className="text-lg font-medium text-red-400">{record.previous_asr != null ? `${record.previous_asr}%` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-sm text-gray-400">Post-Remediation ASR</span>
                  <span className={`text-lg font-medium ${record.current_asr === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {record.current_asr != null ? `${record.current_asr}%` : 'Pending'}
                  </span>
                </div>
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
              <h2 className="text-lg font-medium text-white mb-4">Audit Trail</h2>
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
    </div>
  )
}

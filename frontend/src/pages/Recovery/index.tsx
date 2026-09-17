import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

export default function Recovery() {
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['recovery', 'summary'],
    queryFn: () => api.recovery.summary(),
  })

  const { data: records, isLoading: isRecordsLoading } = useQuery({
    queryKey: ['recovery', 'list'],
    queryFn: () => api.recovery.list(),
  })

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Recovery & Remediation Ledger</h1>
          <p className="text-gray-400">
            Track deterministic, sandbox-only security remediations and verify their impact on the attack success rate.
          </p>
        </div>

        {/* Dashboard Summary Panels */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <dt className="text-sm font-medium text-gray-400">Total Ledgers</dt>
            <dd className="mt-2 text-3xl font-bold text-white">
              {isSummaryLoading ? '...' : summary?.total_recovery_records ?? 0}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <dt className="text-sm font-medium text-gray-400">Avg. ASR Reduction</dt>
            <dd className="mt-2 text-3xl font-bold text-cyan-400">
              {isSummaryLoading ? '...' : `-${summary?.average_asr_reduction ?? 0}%`}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <dt className="text-sm font-medium text-gray-400">Recovered</dt>
            <dd className="mt-2 text-3xl font-bold text-emerald-400">
              {isSummaryLoading ? '...' : summary?.recovered ?? 0}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
            <dt className="text-sm font-medium text-gray-400">Pending Verification</dt>
            <dd className="mt-2 text-3xl font-bold text-amber-400">
              {isSummaryLoading ? '...' : (summary?.planned ?? 0) + (summary?.approval_required ?? 0) + (summary?.executing ?? 0)}
            </dd>
          </div>
        </div>

        {/* Records Table */}
        <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h2 className="text-lg font-medium text-white">Recovery Records</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/5 text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Record ID</th>
                  <th className="px-6 py-4 font-medium">Remediation Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">ASR Change</th>
                  <th className="px-6 py-4 font-medium">Residual Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {isRecordsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Loading recovery records...
                    </td>
                  </tr>
                ) : records?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No recovery records found. Create one from a security finding.
                    </td>
                  </tr>
                ) : (
                  records?.map((record) => (
                    <tr
                      key={record.id}
                      className="transition-colors hover:bg-white/5"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          to={`/recovery/${record.id}`}
                          className="font-mono text-cyan-400 hover:text-cyan-300"
                        >
                          {record.id.split('-')[0]}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                          {record.remediation_type || 'Unplanned'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                          record.status === 'RECOVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          record.status === 'FAILED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {record.previous_asr != null && record.current_asr != null ? (
                          <span className="flex items-center gap-2">
                            <span className="text-gray-400 line-through">{record.previous_asr}%</span>
                            <span className="text-gray-500">→</span>
                            <span className={record.current_asr < record.previous_asr ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                              {record.current_asr}%
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-500">Pending Execution</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {record.residual_risk ? (
                           <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                            record.residual_risk === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            record.residual_risk === 'HIGH' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                            record.residual_risk === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {record.residual_risk}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
  )
}

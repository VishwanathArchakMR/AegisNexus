import { ArrowRight } from 'lucide-react'
import type { DashboardSummary, RecoverySummary, ComplianceSummary } from '../../../types'

interface PipelineBarProps {
  summary?: DashboardSummary
  recoverySummary?: RecoverySummary
  complianceSummary?: ComplianceSummary
}

export function PipelineBar({ summary, recoverySummary, complianceSummary }: PipelineBarProps) {
  // Dynamically compute stages based on actual database records
  const totalAgents = summary?.total_agents ?? 0
  const totalRelationships = summary?.total_relationships ?? 0
  const completedSimulations = summary?.completed_simulations ?? 0
  const openFindings = summary?.open_findings ?? 0
  const totalAssessments = complianceSummary?.total_assessments ?? 0
  const recoveredCount = recoverySummary?.recovered ?? 0
  const totalRecoveryRecords = recoverySummary?.total_recovery_records ?? 0

  const stages = [
    {
      label: 'Discover',
      key: 'discover',
      active: totalAgents > 0,
      status: totalAgents > 0 ? `${totalAgents} Agents` : 'Pending',
      color: totalAgents > 0 ? 'var(--low)' : 'var(--text-muted)',
    },
    {
      label: 'Blast Radius',
      key: 'blast',
      active: totalRelationships > 0,
      status: totalRelationships > 0 ? `${totalRelationships} Links` : 'Pending',
      color: totalRelationships > 0 ? 'var(--accent)' : 'var(--text-muted)',
    },
    {
      label: 'Adversarial Test',
      key: 'attack',
      active: completedSimulations > 0,
      status: completedSimulations > 0 ? `${completedSimulations} Tested` : 'Pending',
      color: completedSimulations > 0 ? 'var(--high)' : 'var(--text-muted)',
    },
    {
      label: 'Risk & Findings',
      key: 'risk',
      active: openFindings > 0 || completedSimulations > 0,
      status: openFindings > 0 ? `${openFindings} Open` : '0 Open',
      color: openFindings > 0 ? 'var(--critical)' : 'var(--low)',
    },
    {
      label: 'Compliance',
      key: 'compliance',
      active: totalAssessments > 0,
      status: totalAssessments > 0 ? `${totalAssessments} Audited` : 'Active',
      color: 'var(--info)',
    },
    {
      label: 'Recovery',
      key: 'recovery',
      active: totalRecoveryRecords > 0,
      status:
        recoveredCount > 0
          ? `${recoveredCount} Recovered`
          : totalRecoveryRecords > 0
          ? `${totalRecoveryRecords} In Progress`
          : 'Pending',
      color: recoveredCount > 0 ? 'var(--low)' : totalRecoveryRecords > 0 ? 'var(--high)' : 'var(--text-muted)',
    },
  ]

  return (
    <div>
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Continuous Security & Recovery Pipeline
      </div>
      <div className="pipeline-bar">
        {stages.map((stage, i) => (
          <div key={stage.key} className="pipeline-stage">
            <div
              className={`pipeline-stage-content${stage.active ? ' active' : ''}`}
              title={stage.status}
            >
              <span
                className="pipeline-stage-label"
                style={{ color: stage.active ? stage.color : 'var(--text-muted)' }}
              >
                {stage.label}
              </span>
              <span
                className="pipeline-stage-status"
                style={{ color: stage.active ? stage.color : undefined }}
              >
                {stage.active ? '● ' : '○ '}
                {stage.status}
              </span>
            </div>
            {i < stages.length - 1 && (
              <span className="pipeline-arrow">
                <ArrowRight size={12} color="var(--text-muted)" />
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

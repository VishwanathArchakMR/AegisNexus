import { ArrowRight } from 'lucide-react'

interface PipelineStage {
  label: string
  key: string
  active: boolean
  status: string
  color: string
}

const STAGES: PipelineStage[] = [
  { label: 'Discover', key: 'discover', active: true,  status: 'Active', color: 'var(--low)' },
  { label: 'Blast Radius', key: 'blast',  active: true, status: 'Active', color: 'var(--accent)' },
  { label: 'Adversarial Test', key: 'attack', active: true, status: 'Active', color: 'var(--high)' },
  { label: 'Risk & Findings',  key: 'risk',  active: true, status: 'Active', color: 'var(--medium)' },
  { label: 'Compliance', key: 'compliance', active: true, status: 'Active', color: 'var(--info)' },
  { label: 'Recovery', key: 'recovery', active: false, status: 'Pending', color: 'var(--critical)' },
]

export function PipelineBar() {
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
        Security Pipeline
      </div>
      <div className="pipeline-bar">
        {STAGES.map((stage, i) => (
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
                {stage.active ? '● ' : '○ '}{stage.status}
              </span>
            </div>
            {i < STAGES.length - 1 && (
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

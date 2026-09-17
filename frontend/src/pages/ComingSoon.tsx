import { Clock } from 'lucide-react'

interface ComingSoonProps {
  moduleName: string
  description: string
  phase?: string
}

export default function ComingSoon({ moduleName, description, phase = 'Phase 2' }: ComingSoonProps) {
  return (
    <div className="coming-soon-page">
      <span className="coming-soon-badge">
        <Clock size={10} style={{ marginRight: 4 }} />
        {phase} · In Development
      </span>
      <h1 className="coming-soon-title">{moduleName}</h1>
      <p className="coming-soon-sub">{description}</p>
      <div
        style={{
          marginTop: 8,
          display: 'flex',
          gap: 8,
          fontSize: '0.6875rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ color: 'var(--low)' }}>● DISCOVER</span>
        <span>→</span>
        <span style={{ color: 'var(--text-muted)' }}>○ BLAST RADIUS</span>
        <span>→</span>
        <span style={{ color: 'var(--text-muted)' }}>○ ADVERSARIAL TEST</span>
        <span>→</span>
        <span style={{ color: 'var(--text-muted)' }}>○ RISK</span>
        <span>→</span>
        <span style={{ color: 'var(--text-muted)' }}>○ COMPLIANCE</span>
        <span>→</span>
        <span style={{ color: 'var(--text-muted)' }}>○ RECOVERY</span>
      </div>
    </div>
  )
}

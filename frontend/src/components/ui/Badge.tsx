import type { TrustLevel, AgentStatus, ImpactLevel } from '../../types'

interface TrustBadgeProps {
  level: TrustLevel
}

interface StatusBadgeProps {
  status: AgentStatus
}

interface ImpactBadgeProps {
  level: ImpactLevel
  riskFamilies?: string[]
}

interface BadgeProps {
  variant: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral' | 'accent'
  title?: string
  children: React.ReactNode
}

export function Badge({ variant, title, children }: BadgeProps) {
  return <span className={`badge badge-${variant}`} title={title}>{children}</span>
}

export function TrustBadge({ level }: TrustBadgeProps) {
  const map: Record<TrustLevel, BadgeProps['variant']> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  }
  return <Badge variant={map[level]}>{level}</Badge>
}

export function ImpactBadge({ level, riskFamilies }: ImpactBadgeProps) {
  const map: Record<ImpactLevel, BadgeProps['variant']> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  }
  const title = riskFamilies && riskFamilies.length > 0
    ? `${level} — ${riskFamilies.join(', ')}`
    : undefined
  return <Badge variant={map[level]} title={title}>{level}</Badge>
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const dotClass: Record<AgentStatus, string> = {
    ACTIVE: 'status-dot-active',
    INACTIVE: 'status-dot-inactive',
    QUARANTINED: 'status-dot-quarantined',
  }
  const variant: Record<AgentStatus, BadgeProps['variant']> = {
    ACTIVE: 'low',
    INACTIVE: 'neutral',
    QUARANTINED: 'critical',
  }
  return (
    <Badge variant={variant[status]}>
      <span className={`status-dot ${dotClass[status]}`} />
      {status}
    </Badge>
  )
}

export function RecoveryStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps['variant']; label: string; dot?: string }> = {
    RECOVERED: { variant: 'low', label: 'RECOVERED', dot: 'status-dot-active' },
    AWAITING_RUNTIME_REVALIDATION: { variant: 'high', label: 'AWAITING REVALIDATION', dot: 'status-dot-quarantined' },
    EXECUTING: { variant: 'accent', label: 'EXECUTING' },
    VERIFYING: { variant: 'accent', label: 'VERIFYING' },
    APPROVED: { variant: 'info', label: 'APPROVED' },
    PLANNED: { variant: 'info', label: 'PLANNED' },
    OPEN: { variant: 'neutral', label: 'OPEN' },
    PARTIALLY_RECOVERED: { variant: 'medium', label: 'PARTIAL RECOVERY' },
    FAILED: { variant: 'critical', label: 'FAILED' },
    REOPENED: { variant: 'critical', label: 'REOPENED' },
  }

  const conf = map[status] || { variant: 'neutral', label: status }
  return (
    <Badge variant={conf.variant}>
      {conf.dot && <span className={`status-dot ${conf.dot}`} style={conf.variant === 'high' ? { background: 'var(--high)', boxShadow: '0 0 6px var(--high)' } : undefined} />}
      {conf.label}
    </Badge>
  )
}

export function SourceBadge({ source }: { source?: string }) {
  if (source === 'RUNTIME_DETECTION' || source === 'RUNTIME') {
    return (
      <Badge variant="accent">
        <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>RUNTIME</span>
      </Badge>
    )
  }
  return (
    <Badge variant="neutral">
      <span style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)' }}>SIMULATION</span>
    </Badge>
  )
}

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

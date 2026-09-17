import type { TrustLevel, AgentStatus, ImpactLevel } from '../../types'

interface TrustBadgeProps {
  level: TrustLevel
}

interface StatusBadgeProps {
  status: AgentStatus
}

interface ImpactBadgeProps {
  level: ImpactLevel
}

interface BadgeProps {
  variant: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral' | 'accent'
  children: React.ReactNode
}

export function Badge({ variant, children }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>
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

export function ImpactBadge({ level }: ImpactBadgeProps) {
  const map: Record<ImpactLevel, BadgeProps['variant']> = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
  }
  return <Badge variant={map[level]}>{level}</Badge>
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

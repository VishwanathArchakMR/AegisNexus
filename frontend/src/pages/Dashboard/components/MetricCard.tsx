import type { ReactNode } from 'react'

interface MetricCardProps {
  icon: ReactNode
  iconBg: string
  value: string | number
  label: string
  sub?: string
  accent?: string
}

export function MetricCard({ icon, iconBg, value, label, sub, accent }: MetricCardProps) {
  return (
    <div
      className="metric-card"
      style={accent ? { borderColor: `${accent}30` } : undefined}
    >
      {/* Subtle accent top edge */}
      {accent && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 2,
            background: accent,
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          }}
        />
      )}

      <div
        className="metric-card-icon"
        style={{ background: iconBg }}
      >
        {icon}
      </div>

      <div className="metric-card-value">{value}</div>
      <div className="metric-card-label">{label}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
    </div>
  )
}

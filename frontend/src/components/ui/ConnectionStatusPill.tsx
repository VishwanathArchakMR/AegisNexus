import type { ConnectionStatus } from '../../types'

export function ConnectionStatusPill({ status }: { status?: ConnectionStatus }) {
  if (!status) return null

  const config = {
    ONLINE: { color: 'var(--low)', bg: 'var(--low-dim)', label: 'ONLINE', dot: true },
    STALE: { color: 'var(--medium)', bg: 'var(--medium-dim)', label: 'STALE', dot: true },
    OFFLINE: { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', label: 'OFFLINE', dot: false },
    NEVER_CONNECTED: { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', label: 'NOT CONNECTED', dot: false },
  }[status] || { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', label: status, dot: false }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: '0.6875rem',
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.color,
        border: `1px solid ${config.color}33`,
        fontFamily: 'var(--font-mono)',
      }}
    >
      {config.dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: config.color,
            display: 'inline-block',
          }}
        />
      )}
      {config.label}
    </span>
  )
}


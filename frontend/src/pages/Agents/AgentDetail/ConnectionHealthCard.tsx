import { useState } from 'react'
import {
  Radio,
  Key,
  RefreshCw,
  AlertTriangle,
  Check,
  Copy,
  Activity,
  AlertOctagon,
} from 'lucide-react'
import { api } from '../../../lib/api'
import type { AgentDetail, ConnectionStatus } from '../../../types'

interface ConnectionHealthCardProps {
  agent: AgentDetail
  onAgentUpdated: () => void
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 5) return 'Just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function ConnectionHealthCard({ agent, onAgentUpdated }: ConnectionHealthCardProps) {
  const [rotating, setRotating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [newKeyBanner, setNewKeyBanner] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const connStatus = agent.connection_status || (agent.is_offline ? 'OFFLINE' : 'ONLINE')

  const statusConfig = {
    ONLINE: { color: 'var(--low)', bg: 'var(--low-dim)', label: 'ONLINE', pulse: true },
    STALE: { color: 'var(--medium)', bg: 'var(--medium-dim)', label: 'STALE', pulse: false },
    OFFLINE: { color: 'var(--critical)', bg: 'var(--critical-dim)', label: 'OFFLINE', pulse: false },
    NEVER_CONNECTED: { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', label: 'NEVER CONNECTED', pulse: false },
  }[connStatus as ConnectionStatus] || { color: 'var(--text-muted)', bg: 'var(--bg-elevated)', label: connStatus, pulse: false }

  const handleRotateKey = async () => {
    if (!window.confirm('Are you sure you want to rotate the API key for this agent? The existing key will be immediately invalidated.')) {
      return
    }
    setRotating(true)
    setActionError(null)
    try {
      const res = await api.agents.rotateKey(agent.id)
      setNewKeyBanner(res.new_api_key)
      onAgentUpdated()
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err.message || 'Failed to rotate key.')
    } finally {
      setRotating(false)
    }
  }

  const handleRevokeKey = async () => {
    if (!window.confirm('WARNING: Revoking this API key will permanently block authentication for this agent until a new key is generated. Proceed?')) {
      return
    }
    setRevoking(true)
    setActionError(null)
    try {
      await api.agents.revokeKey(agent.id)
      onAgentUpdated()
    } catch (err: any) {
      setActionError(err?.response?.data?.message || err.message || 'Failed to revoke key.')
    } finally {
      setRevoking(false)
    }
  }

  const handleCopyNewKey = () => {
    if (!newKeyBanner) return
    navigator.clipboard.writeText(newKeyBanner)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Card Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(255,255,255,0.01)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Radio size={16} color={statusConfig.color} />
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Connection & Credentials Health
          </span>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: '0.6875rem',
            fontWeight: 700,
            backgroundColor: statusConfig.bg,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.color}33`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: statusConfig.color,
              display: 'inline-block',
            }}
          />
          {statusConfig.label}
        </span>
      </div>

      {actionError && (
        <div
          style={{
            margin: '12px 16px',
            padding: '8px 12px',
            background: 'var(--critical-dim)',
            border: '1px solid var(--critical)',
            borderRadius: 6,
            color: 'var(--critical)',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={14} />
          <span>{actionError}</span>
        </div>
      )}

      {/* New Key Banner on Rotation */}
      {newKeyBanner && (
        <div
          style={{
            margin: '12px 16px',
            padding: '12px 14px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Key size={14} color="var(--accent)" />
            <strong style={{ fontSize: '0.8125rem', color: 'var(--accent-light)' }}>
              New Agent API Key Generated
            </strong>
          </div>
          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Copy and store this new key in your agent's environment. It will not be shown again.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code
              style={{
                flex: 1,
                padding: '6px 10px',
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--accent-light)',
                wordBreak: 'break-all',
              }}
            >
              {newKeyBanner}
            </code>
            <button
              onClick={handleCopyNewKey}
              style={{
                background: 'var(--accent)',
                border: 'none',
                color: '#fff',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
              }}
            >
              {copiedKey ? <Check size={12} /> : <Copy size={12} />} {copiedKey ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 2 }}>Framework</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {agent.framework || 'Custom'}
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 2 }}>Environment</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
            {agent.environment || 'development'}
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 2 }}>Heartbeat Expected</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            Every {agent.heartbeat_interval_seconds ?? 30}s
          </div>
        </div>

        <div style={{ padding: '12px 16px' }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: 2 }}>Last Heartbeat</div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {formatRelativeTime(agent.last_heartbeat_at || agent.last_seen_at)}
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Key Controls */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={14} color="var(--accent)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Events: <strong style={{ color: 'var(--text-primary)' }}>{agent.total_events_count ?? 0}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertOctagon size={14} color={(agent.recent_errors_count ?? 0) > 0 ? 'var(--critical)' : 'var(--text-muted)'} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Recent Errors: <strong style={{ color: (agent.recent_errors_count ?? 0) > 0 ? 'var(--critical)' : 'var(--text-primary)' }}>{agent.recent_errors_count ?? 0}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Key Status:{' '}
              <span
                style={{
                  fontWeight: 600,
                  color:
                    agent.api_key_status === 'ACTIVE'
                      ? 'var(--low)'
                      : agent.api_key_status === 'ROTATED'
                      ? 'var(--medium)'
                      : 'var(--critical)',
                }}
              >
                {agent.api_key_status || 'ACTIVE'}
              </span>
            </span>
          </div>
        </div>

        {/* Key Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRotateKey}
            disabled={rotating || agent.api_key_status === 'REVOKED'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: rotating || agent.api_key_status === 'REVOKED' ? 'not-allowed' : 'pointer',
              opacity: agent.api_key_status === 'REVOKED' ? 0.5 : 1,
            }}
          >
            <RefreshCw size={12} className={rotating ? 'spin' : ''} /> Rotate Key
          </button>

          {agent.api_key_status !== 'REVOKED' && (
            <button
              onClick={handleRevokeKey}
              disabled={revoking}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--critical-dim)',
                border: '1px solid var(--critical)',
                borderRadius: 4,
                color: 'var(--critical)',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: revoking ? 'not-allowed' : 'pointer',
              }}
            >
              <AlertTriangle size={12} /> Revoke Key
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

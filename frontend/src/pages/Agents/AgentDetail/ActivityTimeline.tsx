import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  AlertOctagon,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Send,
  Zap,
} from 'lucide-react'
import { api } from '../../../lib/api'
import { Skeleton } from '../../../components/ui/Skeleton'
import type { TelemetryEvent } from '../../../types'

interface ActivityTimelineProps {
  agentId: string
}

export function ActivityTimeline({ agentId }: ActivityTimelineProps) {
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['agent-events', agentId, eventTypeFilter],
    queryFn: () =>
      api.agents.events(agentId, {
        limit: 50,
        event_type: eventTypeFilter || undefined,
      }),
    refetchInterval: 5_000, // Poll every 5 seconds for real-time telemetry
  })

  const events = data?.events ?? []

  const toggleExpand = (id: string) => {
    setExpandedEventId((prev) => (prev === id ? null : id))
  }

  const getEventIcon = (event: TelemetryEvent) => {
    if (event.status === 'BLOCKED' || event.event_type === 'POLICY_BLOCKED') {
      return <ShieldAlert size={14} color="var(--critical)" />
    }
    if (event.status === 'FAILED' || event.event_type === 'TOOL_CALL_FAILED') {
      return <AlertOctagon size={14} color="var(--high)" />
    }
    if (event.event_type.startsWith('AGENT_DELEGATION') || event.event_type.startsWith('AGENT_COMMUNICATION')) {
      return <Send size={14} color="var(--info)" />
    }
    if (event.event_type.startsWith('TOOL_CALL')) {
      return <Zap size={14} color="var(--accent)" />
    }
    return <CheckCircle2 size={14} color="var(--low)" />
  }

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
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
          <Activity size={16} color="var(--accent)" />
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Live Activity Timeline
          </span>
          <span
            style={{
              fontSize: '0.625rem',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '1px 5px',
              color: 'var(--text-secondary)',
            }}
          >
            {eventTypeFilter ? `${events.length} matching / ${data?.total ?? events.length} total` : `${data?.total ?? events.length} events`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {eventTypeFilter && (
            <button
              onClick={() => setEventTypeFilter('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '2px 4px',
              }}
            >
              Clear Filter
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={12} color="var(--text-muted)" />
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{
                padding: '3px 8px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <option value="">All Events</option>
              <option value="TOOL_CALL_COMPLETED">Tool Calls Completed</option>
              <option value="TOOL_CALL_FAILED">Tool Calls Failed</option>
              <option value="AGENT_DELEGATION">Agent Delegations</option>
              <option value="AGENT_HEARTBEAT">Heartbeats</option>
              <option value="POLICY_BLOCKED">Policy Blocked</option>
            </select>
          </div>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: isFetching ? 'not-allowed' : 'pointer',
              display: 'flex',
              padding: 2,
            }}
            title="Refresh events"
          >
            <RefreshCw size={13} className={isFetching ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height={40} />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            padding: 30,
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.8125rem',
          }}
        >
          {eventTypeFilter ? (
            <div>
              <span>No events match filter &quot;{eventTypeFilter}&quot;. </span>
              <button
                onClick={() => setEventTypeFilter('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.8125rem',
                }}
              >
                Clear filter
              </button>
            </div>
          ) : (
            'No runtime activity recorded yet. Run your agent or wait for the next heartbeat telemetry event.'
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((ev) => {
            const isExpanded = expandedEventId === ev.id
            return (
              <div
                key={ev.id}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  padding: '10px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'background 0.15s ease',
                  background: isExpanded ? 'var(--bg-elevated)' : 'transparent',
                }}
              >
                <div
                  onClick={() => toggleExpand(ev.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{ flexShrink: 0 }}>{getEventIcon(ev)}</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {ev.tool_name ? `${ev.tool_name}.${ev.action || 'call'}` : ev.event_type}
                        </span>
                        <span
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background:
                              ev.status === 'SUCCESS'
                                ? 'var(--low-dim)'
                                : ev.status === 'BLOCKED'
                                ? 'var(--critical-dim)'
                                : 'var(--bg-elevated)',
                            color:
                              ev.status === 'SUCCESS'
                                ? 'var(--low)'
                                : ev.status === 'BLOCKED'
                                ? 'var(--critical)'
                                : 'var(--high)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {ev.status}
                        </span>
                        {ev.resource_type && (
                          <span
                            style={{
                              fontSize: '0.625rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-muted)',
                              border: '1px solid var(--border-subtle)',
                              padding: '1px 4px',
                              borderRadius: 3,
                            }}
                          >
                            {ev.resource_type} · {ev.permission_level || 'READ'}
                          </span>
                        )}
                      </div>

                      {ev.target_agent_id && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--info)', marginTop: 2 }}>
                          → Delegated to agent: {ev.target_agent_id.slice(0, 8)}…
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {ev.duration_ms !== null && ev.duration_ms !== undefined && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {ev.duration_ms}ms
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {formatTimestamp(ev.created_at)}
                    </span>
                    <button
                      type="button"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        padding: 0,
                      }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details / Metadata */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: 10,
                      background: 'var(--bg-base)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 6,
                      fontSize: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Event ID: </span>
                        <code style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {ev.id}
                        </code>
                      </div>
                      {ev.trace_id && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Trace ID: </span>
                          <code style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {ev.trace_id}
                          </code>
                        </div>
                      )}
                      {ev.sdk_version && (
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>SDK Version: </span>
                          <code style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {ev.sdk_version}
                          </code>
                        </div>
                      )}
                    </div>

                    {ev.metadata_json && Object.keys(ev.metadata_json).length > 0 ? (
                      <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Sanitized Payload Metadata:</div>
                        <pre
                          style={{
                            margin: 0,
                            padding: 8,
                            background: 'var(--bg-card)',
                            borderRadius: 4,
                            color: 'var(--accent-light)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.6875rem',
                            overflowX: 'auto',
                          }}
                        >
                          {JSON.stringify(ev.metadata_json, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No payload metadata attached.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useState, useCallback, useEffect, type CSSProperties } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  GitFork,
  AlertTriangle,
  Lock,
  ChevronDown,
  Bot,
  ShieldAlert,
} from 'lucide-react'
import { api } from '../../lib/api'
import { TrustBadge, Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import type { BlastRadiusNode, BlastRadiusEdge, ImpactLevel, TrustLevel } from '../../types'

// ── Constants ──────────────────────────────────────────────────────────────

const TRUST_COLORS: Record<TrustLevel, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
}

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
}

const REL_COLORS: Record<string, string> = {
  CALLS: '#60a5fa',
  DELEGATES: '#f59e0b',
  SHARES_CREDENTIAL: '#f97316',
  MONITORS: '#6366f1',
}

// ── Custom node ────────────────────────────────────────────────────────────

type AgentNodeData = BlastRadiusNode & { onClick: (node: BlastRadiusNode) => void }

function AgentNode({ data }: NodeProps<AgentNodeData>) {
  const isRoot = data.is_root
  const isUpstream = data.depth === -1
  const trustColor = TRUST_COLORS[data.trust_level as TrustLevel] ?? '#6b7280'

  const nodeStyle: CSSProperties = {
    background: isRoot
      ? 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(13,18,38,0.98) 100%)'
      : isUpstream
      ? 'rgba(13,18,38,0.6)'
      : 'rgba(13,18,38,0.95)',
    border: `${isRoot ? 2 : 1.5}px solid ${isRoot ? '#3b82f6' : trustColor}`,
    borderRadius: 8,
    padding: '10px 14px',
    color: '#e8edf5',
    fontFamily: 'Inter, sans-serif',
    minWidth: 170,
    boxShadow: isRoot
      ? '0 0 28px rgba(59,130,246,0.30), 0 4px 12px rgba(0,0,0,0.6)'
      : `0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px ${trustColor}22`,
    opacity: isUpstream ? 0.7 : 1,
    cursor: 'pointer',
    transition: 'box-shadow 150ms ease, transform 150ms ease',
  }

  return (
    <div style={nodeStyle} onClick={() => data.onClick(data)}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: trustColor, border: '2px solid #07091a', width: 8, height: 8 }}
      />

      {/* Agent type label */}
      <div style={{
        fontSize: '0.5625rem', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        color: isUpstream ? '#4a5568' : '#6b7280',
        marginBottom: 3,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        {isUpstream ? '↑ UPSTREAM' : isRoot ? '◎ ROOT AGENT' : `DEPTH ${data.depth}`}
      </div>

      {/* Name */}
      <div style={{
        fontSize: '0.8125rem', fontWeight: isRoot ? 700 : 600,
        lineHeight: 1.3, marginBottom: 6,
        color: isRoot ? '#93c5fd' : '#e8edf5',
      }}>
        {data.label}
      </div>

      {/* Trust badge row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', padding: '1px 5px',
          borderRadius: 3,
          background: `${trustColor}18`,
          border: `1px solid ${trustColor}40`,
          color: trustColor,
        }}>
          {data.trust_level}
        </span>
        {data.sensitive_capability_count > 0 && (
          <span style={{
            fontSize: '0.5625rem', fontWeight: 600, padding: '1px 5px',
            borderRadius: 3, background: 'rgba(249,115,22,0.12)',
            border: '1px solid rgba(249,115,22,0.3)', color: '#f97316',
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            ⚠ {data.sensitive_capability_count}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: trustColor, border: '2px solid #07091a', width: 8, height: 8 }}
      />
    </div>
  )
}

const NODE_TYPES = { agentNode: AgentNode }

// ── Layout algorithm ───────────────────────────────────────────────────────

function computeLayout(
  apiNodes: BlastRadiusNode[],
  onClick: (node: BlastRadiusNode) => void
): Node<AgentNodeData>[] {
  // Group by depth
  const byDepth: Record<number, BlastRadiusNode[]> = {}
  for (const n of apiNodes) {
    const d = n.depth
    if (!byDepth[d]) byDepth[d] = []
    byDepth[d].push(n)
  }

  const depths = Object.keys(byDepth)
    .map(Number)
    .sort((a, b) => a - b)

  const H_GAP = 210
  const V_GAP = 170
  const CENTER_X = 400

  return apiNodes.map((node) => {
    const d = node.depth
    const siblings = byDepth[d]
    const idx = siblings.indexOf(node)
    const totalW = (siblings.length - 1) * H_GAP
    const x = CENTER_X - totalW / 2 + idx * H_GAP

    // Map depth to y-position: upstream (-1) → above, root (0) → center, downstream → below
    const depthIdx = depths.indexOf(d)
    const y = depthIdx * V_GAP + 40

    return {
      id: node.id,
      type: 'agentNode',
      position: { x, y },
      data: { ...node, onClick },
    }
  })
}

function computeEdges(apiEdges: BlastRadiusEdge[]): Edge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.relationship_type,
    labelStyle: {
      fontSize: 9,
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 700,
      fill: REL_COLORS[e.relationship_type] ?? '#6b7280',
    },
    labelBgStyle: { fill: '#0d1226', fillOpacity: 0.9 },
    labelBgPadding: [3, 5] as [number, number],
    labelBgBorderRadius: 3,
    animated: !e.id.startsWith('in-'),
    style: {
      stroke: REL_COLORS[e.relationship_type] ?? '#4a5568',
      strokeWidth: e.id.startsWith('in-') ? 1.5 : 2,
      strokeDasharray: e.id.startsWith('in-') ? '5 4' : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: REL_COLORS[e.relationship_type] ?? '#4a5568',
      width: 16,
      height: 16,
    },
    type: 'smoothstep',
  }))
}

// ── Detail panel ───────────────────────────────────────────────────────────

function NodeDetailPanel({
  node,
  onNavigate,
}: {
  node: BlastRadiusNode | null
  onNavigate: (id: string) => void
}) {
  if (!node) {
    return (
      <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', textAlign: 'center' }}>
        <Bot size={20} color="var(--text-muted)" style={{ display: 'block', margin: '0 auto 8px' }} />
        Click a node to inspect it
      </div>
    )
  }

  const trustColor = TRUST_COLORS[node.trust_level as TrustLevel] ?? '#6b7280'

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: trustColor, boxShadow: `0 0 8px ${trustColor}`,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{node.label}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <TrustBadge level={node.trust_level} />
        <Badge variant={node.status === 'ACTIVE' ? 'low' : node.status === 'QUARANTINED' ? 'critical' : 'neutral'}>
          {node.status}
        </Badge>
        {node.is_root && <Badge variant="accent">ROOT</Badge>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { k: 'Agent Type', v: node.agent_type },
          { k: 'Depth', v: node.depth === -1 ? 'Upstream' : node.depth === 0 ? 'Root' : `${node.depth} hop(s)` },
          { k: 'Sensitive Caps', v: String(node.sensitive_capability_count) },
        ].map((row) => (
          <div key={row.k} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.75rem', padding: '3px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>{row.k}</span>
            <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{row.v}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onNavigate(node.id)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '7px 12px',
          background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem', fontWeight: 500, color: 'var(--accent-light)',
          cursor: 'pointer',
        }}
      >
        Open Agent Detail →
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function BlastRadiusPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const initialAgent = searchParams.get('agent') ?? ''
  const [selectedAgent, setSelectedAgent] = useState(initialAgent)
  const [selectedNode, setSelectedNode] = useState<BlastRadiusNode | null>(null)

  const agentListQuery = useQuery({
    queryKey: ['agents', 'list'],
    queryFn: () => api.agents.list(),
  })

  const blastQuery = useQuery({
    queryKey: ['agents', selectedAgent, 'blast-radius'],
    queryFn: () => api.agents.blastRadius(selectedAgent),
    enabled: !!selectedAgent,
  })

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Rebuild graph when blast data changes
  useEffect(() => {
    if (!blastQuery.data) return

    const handleNodeClick = (node: BlastRadiusNode) => setSelectedNode(node)
    const rfNodes = computeLayout(blastQuery.data.nodes, handleNodeClick)
    const rfEdges = computeEdges(blastQuery.data.edges)
    setNodes(rfNodes)
    setEdges(rfEdges)
    setSelectedNode(null)
  }, [blastQuery.data, setNodes, setEdges])

  const handleAgentChange = useCallback((agentId: string) => {
    setSelectedAgent(agentId)
    setSelectedNode(null)
    setSearchParams(agentId ? { agent: agentId } : {})
  }, [setSearchParams])

  const blast = blastQuery.data
  const impact = blast?.summary.potential_impact ?? null
  const impactColor = impact ? IMPACT_COLORS[impact] : 'var(--text-muted)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: 'calc(100vh - 112px)' }}>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>
          Blast Radius Analysis
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Visualize how permissions, relationships, and delegated actions can propagate
          across your AI agent environment if an agent is compromised.
        </p>
      </div>

      {/* ── Agent selector ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        padding: '10px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <Bot size={15} color="var(--accent)" />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Analyze agent:
        </span>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <select
            id="blast-radius-agent-selector"
            value={selectedAgent}
            onChange={(e) => handleAgentChange(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              color: selectedAgent ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '0.8125rem', padding: '6px 28px 6px 10px',
              appearance: 'none', cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="">— Select an agent to analyze —</option>
            {(agentListQuery.data?.agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.trust_level})
              </option>
            ))}
          </select>
          <ChevronDown size={13} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
        </div>

        {/* Quick stats */}
        {blast && impact && (
          <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{blast.nodes.length}</span> nodes
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{blast.edges.length}</span> edges
            </span>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
              textTransform: 'uppercase', padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: `${impactColor}18`, border: `1px solid ${impactColor}35`,
              color: impactColor,
            }} title={blast.summary.risk_families?.join(', ')}>
              {impact} IMPACT
            </span>
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, minHeight: 0 }}>

        {/* Graph */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {!selectedAgent ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 12, color: 'var(--text-muted)',
            }}>
              <GitFork size={36} color="var(--text-muted)" />
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                Select an agent to visualize its blast radius
              </div>
              <div style={{ fontSize: '0.75rem', textAlign: 'center', maxWidth: 280 }}>
                The graph shows how a compromise propagates through agent relationships
              </div>
            </div>
          ) : blastQuery.isLoading ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 12,
            }}>
              <div className="skeleton" style={{ width: 200, height: 14, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 300, height: 14, borderRadius: 6 }} />
              <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 6 }} />
            </div>
          ) : blastQuery.error ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div className="error-state">
                <AlertTriangle size={16} />
                <span>Failed to load blast radius data.</span>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={NODE_TYPES}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              minZoom={0.3}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              style={{ background: 'transparent' }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
                color="rgba(255,255,255,0.04)"
              />
              <Controls
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              />
              <MiniMap
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                }}
                nodeColor={(node) => {
                  const n = node.data as BlastRadiusNode
                  if (n.is_root) return '#3b82f6'
                  return TRUST_COLORS[n.trust_level as TrustLevel] ?? '#6b7280'
                }}
                maskColor="rgba(7,9,26,0.7)"
              />
            </ReactFlow>
          )}
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>

          {/* Summary */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              Summary
            </div>
            {blast ? (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>
                    Root Agent
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{blast.root_agent_name}</div>
                </div>
                <div style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-md)',
                  background: `${impactColor}10`, border: `1px solid ${impactColor}25`,
                  marginBottom: 10,
                }} title={blast.summary.risk_families?.join(', ')}>
                  <div style={{ fontSize: '0.5625rem', color: impactColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Potential Impact
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: impactColor }}>{impact}</div>
                </div>
                {[
                  { label: 'Direct Connections', value: blast.summary.direct_connections },
                  { label: 'Downstream Agents', value: blast.summary.downstream_agents },
                  { label: 'Sensitive Capabilities', value: blast.summary.sensitive_capabilities, icon: <Lock size={10} /> },
                  { label: 'Propagation Depth', value: `${blast.summary.propagation_depth} hops` },
                ].map((m) => (
                  <div key={m.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '0.75rem', padding: '4px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {(m as { icon?: React.ReactNode }).icon}
                      {m.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 16 }}>
                {blastQuery.isLoading
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[...Array(4)].map((_, i) => <Skeleton key={i} height={12} />)}
                    </div>
                  : <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Select an agent above</span>
                }
              </div>
            )}
          </div>

          {/* Selected node detail */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: '0.6875rem', fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              Selected Node
            </div>
            <NodeDetailPanel node={selectedNode} onNavigate={(id) => navigate(`/agents/${id}`)} />
          </div>

          {/* Legend */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{
              fontSize: '0.625rem', fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase',
              color: 'var(--text-muted)', marginBottom: 8,
            }}>
              Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { color: '#3b82f6', label: 'Root agent (analyzed)' },
                { color: TRUST_COLORS.CRITICAL, label: 'CRITICAL trust agent' },
                { color: TRUST_COLORS.HIGH, label: 'HIGH trust agent' },
                { color: TRUST_COLORS.MEDIUM, label: 'MEDIUM trust agent' },
                { color: TRUST_COLORS.LOW, label: 'LOW trust agent' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, boxShadow: `0 0 5px ${item.color}`, flexShrink: 0 }} />
                  {item.label}
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { color: REL_COLORS.CALLS, label: 'CALLS relationship', dashed: false },
                  { color: REL_COLORS.DELEGATES, label: 'DELEGATES relationship', dashed: false },
                  { color: REL_COLORS.SHARES_CREDENTIAL, label: 'SHARES_CREDENTIAL', dashed: false },
                  { color: '#4a5568', label: 'Incoming (upstream)', dashed: true },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                    <svg width="18" height="8" style={{ flexShrink: 0 }}>
                      <line x1="0" y1="4" x2="18" y2="4"
                        stroke={item.color}
                        strokeWidth="1.5"
                        strokeDasharray={item.dashed ? '4 3' : undefined}
                      />
                    </svg>
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        marginTop: 10, padding: '6px 12px',
        fontSize: '0.625rem', color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <ShieldAlert size={10} />
        PRELIMINARY BLAST RADIUS ASSESSMENT · Impact classification will be calibrated against adversarial test results in Phase 3
      </div>
    </div>
  )
}

import { useState } from 'react'
import {
  X,
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Key,
  Code2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  Cpu,
} from 'lucide-react'
import { api } from '../../lib/api'
import type {
  AgentOnboardRequest,
  AgentOnboardResponse,
  CapabilityInput,
  ResourceType,
  PermissionLevel,
  TrustLevel,
} from '../../types'

interface OnboardWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const RESOURCE_TYPES: ResourceType[] = ['DATABASE', 'PAYMENT', 'EMAIL', 'FILE', 'API', 'AGENT_COMMS']
const PERMISSION_LEVELS: PermissionLevel[] = ['READ', 'WRITE', 'EXECUTE', 'ADMIN']

export function OnboardWizardModal({ isOpen, onClose, onSuccess }: OnboardWizardModalProps) {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stage 1 State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [agentType, setAgentType] = useState('custom')
  const [customType, setCustomType] = useState('')
  const [framework, setFramework] = useState('LangChain')
  const [ownerTeam, setOwnerTeam] = useState('Platform AI')
  const [environment, setEnvironment] = useState('production')
  const [deploymentLocation, setDeploymentLocation] = useState('aws:us-east-1')
  const [tagsInput, setTagsInput] = useState('external, production, v2')

  // Stage 2 State (Capabilities)
  const [capabilities, setCapabilities] = useState<CapabilityInput[]>([
    {
      name: 'query_customer_data',
      resource_type: 'DATABASE',
      permission_level: 'READ',
      is_sensitive: false,
      description: 'Queries customer records for billing and support validation',
    },
    {
      name: 'execute_refund',
      resource_type: 'PAYMENT',
      permission_level: 'WRITE',
      is_sensitive: true,
      description: 'Issues refund transactions to authorized payment gateways',
    },
  ])

  // Stage 3 & 4 State (Generated Credentials & Result)
  const [onboardResult, setOnboardResult] = useState<AgentOnboardResponse | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [testConnectionStatus, setTestConnectionStatus] = useState<string | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)

  if (!isOpen) return null

  const handleAddCapability = () => {
    setCapabilities((prev) => [
      ...prev,
      {
        name: '',
        resource_type: 'API',
        permission_level: 'READ',
        is_sensitive: false,
        description: '',
      },
    ])
  }

  const handleRemoveCapability = (index: number) => {
    setCapabilities((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateCapability = (index: number, field: keyof CapabilityInput, value: any) => {
    setCapabilities((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  const handleCopy = (text: string, type: 'id' | 'key') => {
    navigator.clipboard.writeText(text)
    if (type === 'key') {
      setCopiedKey(true)
      setTimeout(() => setCopiedKey(false), 2000)
    } else {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleSubmitOnboarding = async () => {
    setLoading(true)
    setError(null)
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)

      const payload: AgentOnboardRequest = {
        name,
        description,
        agent_type: agentType === 'custom' && customType ? customType : agentType,
        framework,
        owner_team: ownerTeam,
        environment,
        deployment_location: deploymentLocation,
        tags: parsedTags,
        initial_trust_level: 'LOW' as TrustLevel,
        capabilities: capabilities.filter((c) => c.name.trim() !== ''),
      }

      const res = await api.agents.onboard(payload)
      setOnboardResult(res)
      setStage(3)
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to onboard agent.')
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!onboardResult?.agent_id) return
    setTestingConnection(true)
    setTestConnectionStatus(null)
    try {
      const statusRes = await api.agents.connectionStatus(onboardResult.agent_id)
      setTestConnectionStatus(statusRes.connection_status)
    } catch (err: any) {
      setTestConnectionStatus('ERROR')
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 7, 18, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 780,
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-strong)',
          borderRadius: 14,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={20} color="var(--accent)" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Onboard External AI Agent
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Steps Stepper */}
        <div
          style={{
            padding: '12px 24px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {[
            { num: 1, label: 'Agent Info' },
            { num: 2, label: 'Security Profile' },
            { num: 3, label: 'Credentials' },
            { num: 4, label: 'Integration' },
          ].map((s) => (
            <div
              key={s.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: stage === s.num ? 1 : stage > s.num ? 0.8 : 0.4,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background:
                    stage === s.num
                      ? 'var(--accent)'
                      : stage > s.num
                      ? 'var(--low)'
                      : 'var(--bg-card)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {stage > s.num ? '✓' : s.num}
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Body content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                background: 'var(--critical-dim)',
                border: '1px solid var(--critical)',
                borderRadius: 8,
                color: 'var(--critical)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* ── STAGE 1: Agent Information ── */}
          {stage === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Agent Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Billing Copilot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Description *
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the agent's purpose, scope, and key capabilities..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Agent Type
                  </label>
                  <select
                    value={agentType}
                    onChange={(e) => setAgentType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="custom">Custom Agent</option>
                    <option value="customer_support">Customer Support</option>
                    <option value="finance">Finance / Billing</option>
                    <option value="research">Research & Analysis</option>
                    <option value="ops">DevOps / Operations</option>
                  </select>
                </div>

                {agentType === 'custom' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Custom Type Identifier
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. data_pipeline_agent"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 6,
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Category
                    </label>
                    <div style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      Standard Predefined Archetype
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Framework / Runtime
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LangChain, AutoGen, CrewAI, Custom"
                    value={framework}
                    onChange={(e) => setFramework(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Owner Team
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Finance AI Team"
                    value={ownerTeam}
                    onChange={(e) => setOwnerTeam(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Environment
                  </label>
                  <select
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <option value="development">Development</option>
                    <option value="testing">Testing</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Deployment Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. aws:us-east-1, k8s-cluster-prod"
                    value={deploymentLocation}
                    onChange={(e) => setDeploymentLocation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="billing, refund, external, pci-dss"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>
          )}

          {/* ── STAGE 2: Security Profile ── */}
          {stage === 2 && (
            <div>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'var(--accent-dim)',
                  border: '1px solid var(--accent-light)',
                  borderRadius: 8,
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <Shield size={18} color="var(--accent)" style={{ marginTop: 2 }} />
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <strong>Zero-Trust Initial Baseline:</strong> Newly onboarded external agents start with a conservative initial trust level (<code>LOW</code>). Reported capabilities are marked as <code>SELF_REPORTED</code> until verified by runtime observations or operator attestation.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Declared Capabilities ({capabilities.length})
                </h3>
                <button
                  type="button"
                  onClick={handleAddCapability}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    color: 'var(--accent)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={14} /> Add Capability
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {capabilities.map((cap, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr auto', gap: 8, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Capability Name (e.g. read_invoice)"
                        value={cap.name}
                        onChange={(e) => handleUpdateCapability(idx, 'name', e.target.value)}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                        }}
                      />
                      <select
                        value={cap.resource_type}
                        onChange={(e) => handleUpdateCapability(idx, 'resource_type', e.target.value as ResourceType)}
                        style={{
                          padding: '6px 8px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {RESOURCE_TYPES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <select
                        value={cap.permission_level}
                        onChange={(e) => handleUpdateCapability(idx, 'permission_level', e.target.value as PermissionLevel)}
                        style={{
                          padding: '6px 8px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          color: 'var(--text-primary)',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {PERMISSION_LEVELS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveCapability(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--critical)',
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        type="text"
                        placeholder="Description (optional)"
                        value={cap.description || ''}
                        onChange={(e) => handleUpdateCapability(idx, 'description', e.target.value)}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 4,
                          color: 'var(--text-secondary)',
                          fontSize: '0.75rem',
                        }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={cap.is_sensitive}
                          onChange={(e) => handleUpdateCapability(idx, 'is_sensitive', e.target.checked)}
                        />
                        Sensitive Resource
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STAGE 3: Generated Credentials ── */}
          {stage === 3 && onboardResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: '14px 16px',
                  background: 'var(--critical-dim)',
                  border: '1px solid var(--critical)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <Key size={20} color="var(--critical)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                  <strong style={{ color: 'var(--critical)' }}>Save your API Key now!</strong>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    For security reasons, AegisNexus hashes and salts keys before storing. This plaintext key is displayed only once and cannot be recovered later.
                  </p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Assigned Agent ID
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    justifyContent: 'space-between',
                  }}
                >
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {onboardResult.agent_id}
                  </code>
                  <button
                    onClick={() => handleCopy(onboardResult.agent_id, 'id')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedId ? 'var(--low)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                    }}
                  >
                    {copiedId ? <Check size={14} /> : <Copy size={14} />} {copiedId ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Agent API Key (One-Time Display)
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-accent)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    justifyContent: 'space-between',
                  }}
                >
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--accent-light)', wordBreak: 'break-all' }}>
                    {onboardResult.api_key}
                  </code>
                  <button
                    onClick={() => handleCopy(onboardResult.api_key, 'key')}
                    style={{
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: 4,
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '0.75rem',
                      padding: '6px 10px',
                      fontWeight: 600,
                      marginLeft: 12,
                      flexShrink: 0,
                    }}
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />} {copiedKey ? 'Copied!' : 'Copy Key'}
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Status</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--low)' }}>{onboardResult.api_key_status}</div>
                </div>
                <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Initial Trust Level</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--medium)' }}>{onboardResult.trust_level}</div>
                </div>
                <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Environment</div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{onboardResult.environment}</div>
                </div>
              </div>
            </div>
          )}

          {/* ── STAGE 4: Integration Instructions ── */}
          {stage === 4 && onboardResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* SDK Install */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  <Code2 size={16} color="var(--accent)" /> 1. Install AegisNexus Python SDK
                </label>
                <pre
                  style={{
                    margin: 0,
                    padding: '10px 14px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    color: 'var(--low)',
                  }}
                >
                  pip install aegisnexus-sdk
                </pre>
              </div>

              {/* Environment Setup */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  2. Configure Environment Variables (.env)
                </label>
                <pre
                  style={{
                    margin: 0,
                    padding: '10px 14px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    overflowX: 'auto',
                  }}
                >
{`AEGISNEXUS_ENDPOINT=http://localhost:8000/api/v1
AEGISNEXUS_AGENT_ID=${onboardResult.agent_id}
AEGISNEXUS_API_KEY=${onboardResult.api_key}
AEGISNEXUS_HEARTBEAT_INTERVAL=30`}
                </pre>
              </div>

              {/* Minimal Code */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  3. Initialize and Instrument Agent
                </label>
                <pre
                  style={{
                    margin: 0,
                    padding: '10px 14px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: '#e2e8f0',
                    overflowX: 'auto',
                  }}
                >
{`from aegisnexus_sdk import AegisNexusClient

# Connect from environment variables
client = AegisNexusClient.from_env()
client.start()  # Starts background heartbeats & telemetry

# Track tool execution safely
with client.track_tool_call(
    tool="customer_database",
    action="query_customer_data",
    resource_type="DATABASE",
    permission_level="READ",
):
    execute_query()

client.stop()  # Flushes telemetry on shutdown`}
                </pre>
              </div>

              {/* Live Test Connection Card */}
              <div
                style={{
                  padding: 14,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Check Real-Time Connectivity
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Verify that your external agent is transmitting heartbeats.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {testConnectionStatus && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: 4,
                        background:
                          testConnectionStatus === 'ONLINE'
                            ? 'var(--low-dim)'
                            : testConnectionStatus === 'STALE'
                            ? 'var(--medium-dim)'
                            : 'var(--bg-card)',
                        color:
                          testConnectionStatus === 'ONLINE'
                            ? 'var(--low)'
                            : testConnectionStatus === 'STALE'
                            ? 'var(--medium)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {testConnectionStatus}
                    </span>
                  )}
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConnection}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--accent)',
                      border: 'none',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '6px 12px',
                      cursor: testingConnection ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <RefreshCw size={12} className={testingConnection ? 'spin' : ''} />
                    {testingConnection ? 'Checking...' : 'Test Connection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {stage === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!name.trim() || !description.trim()}
                onClick={() => setStage(2)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '7px 16px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: !name.trim() || !description.trim() ? 'not-allowed' : 'pointer',
                  opacity: !name.trim() || !description.trim() ? 0.5 : 1,
                }}
              >
                Next: Security Profile <ArrowRight size={14} />
              </button>
            </>
          )}

          {stage === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStage(1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSubmitOnboarding}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '7px 16px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Creating Identity...' : 'Generate Identity & Credentials'} <ArrowRight size={14} />
              </button>
            </>
          )}

          {stage === 3 && (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Step 3 of 4: Credentials Stored Securely
              </div>
              <button
                type="button"
                onClick={() => setStage(4)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '7px 16px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Next: Integration Guide <ArrowRight size={14} />
              </button>
            </>
          )}

          {stage === 4 && (
            <>
              <button
                type="button"
                onClick={() => setStage(3)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                <ArrowLeft size={14} /> Back to Credentials
              </button>
              <button
                type="button"
                onClick={() => {
                  onSuccess()
                  onClose()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--low)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  padding: '7px 18px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <CheckCircle2 size={16} /> Finish & View Inventory
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Shared TypeScript types mirroring backend Pydantic schemas.

export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'QUARANTINED'
export type TrustLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type AgentType = 'customer_support' | 'finance' | 'research' | 'ops' | 'custom'
export type ResourceType = 'EMAIL' | 'DATABASE' | 'PAYMENT' | 'FILE' | 'API' | 'AGENT_COMMS'
export type PermissionLevel = 'READ' | 'WRITE' | 'EXECUTE' | 'ADMIN'
export type RelationshipType = 'CALLS' | 'DELEGATES' | 'SHARES_CREDENTIAL' | 'MONITORS'
export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface AgentCapability {
  id: string
  capability_name: string
  resource_type: ResourceType
  permission_level: PermissionLevel
  is_sensitive: boolean
  description: string | null
}

export interface AgentCredential {
  id: string
  credential_name: string
  credential_type: string
  scope: string
  is_rotated: boolean
  last_used_at: string | null
}

export interface AgentRelationship {
  id: string
  source_agent_id: string
  target_agent_id: string
  relationship_type: RelationshipType
  trust_direction: string
  description: string | null
}

export interface AgentBasic {
  id: string
  name: string
  agent_type: AgentType
  status: AgentStatus
  trust_level: TrustLevel
  owner_team: string
  source: string
  discovery_method: string
  confidence: string
  last_seen_at: string | null
  is_offline: boolean
}

export interface AgentSummary {
  id: string
  name: string
  description: string
  agent_type: AgentType
  status: AgentStatus
  trust_level: TrustLevel
  owner_team: string
  created_at: string
  updated_at: string
  capability_count: number
  credential_count: number
  relationship_count: number
  source: string
  discovery_method: string
  confidence: string
  last_seen_at: string | null
  is_offline: boolean
}

export interface AgentDetail
  extends Omit<AgentSummary, 'capability_count' | 'credential_count' | 'relationship_count'> {
  capabilities: AgentCapability[]
  credentials: AgentCredential[]
  outgoing_relationships: AgentRelationship[]
  incoming_relationships: AgentRelationship[]
  source: string
  discovery_method: string
  confidence: string
  last_seen_at: string | null
  is_offline: boolean
}

export interface AgentListResponse {
  agents: AgentSummary[]
  total: number
}

export interface DashboardSummary {
  total_agents: number
  active_agents: number
  inactive_agents: number
  quarantined_agents: number
  critical_trust_agents: number
  high_trust_agents: number
  total_capabilities: number
  sensitive_capabilities: number
  total_relationships: number
  agents_requiring_attention: number

  total_simulations: number
  completed_simulations: number
  average_asr: number
  open_findings: number
  critical_findings: number

  posture_score: number
  posture_label: string
  posture_status: string
}

export interface HealthResponse {
  status: string
  version: string
  service: string
}

// ── Blast Radius ──────────────────────────────────────────────────────────

export interface BlastRadiusNode {
  id: string
  label: string
  agent_type: string
  trust_level: TrustLevel
  status: AgentStatus
  is_root: boolean
  sensitive_capability_count: number
  /** -1 = upstream (feeds into root), 0 = root, 1+ = downstream */
  depth: number
}

export interface BlastRadiusEdge {
  id: string
  source: string
  target: string
  relationship_type: RelationshipType
  trust_direction: string
  description: string | null
}

export interface BlastRadiusSummary {
  direct_connections: number
  downstream_agents: number
  sensitive_capabilities: number
  total_capabilities: number
  propagation_depth: number
  potential_impact: ImpactLevel
  impact_factors: string[]
}

export interface BlastRadiusResponse {
  root_agent_id: string
  root_agent_name: string
  nodes: BlastRadiusNode[]
  edges: BlastRadiusEdge[]
  summary: BlastRadiusSummary
}

export interface AgentListParams {
  search?: string
  status?: string
  trust_level?: string
  agent_type?: string
}

// ── Phase 3: Attack Simulations ───────────────────────────────────────────

export interface AttackScenario {
  id: string
  name: string
  description: string
  attack_type: string
  category: string
  severity: ImpactLevel
  target_agent_type: string
  payload_template: string
  expected_behavior: string
  mitigation_guidance: string
  enabled: boolean
  created_at: string
}

export interface AttackAttempt {
  id: string
  execution_id: string
  attempt_number: number
  input_payload: string
  simulated_agent_response: string
  behavior_observed: string
  success: boolean
  success_reason: string | null
  severity: ImpactLevel
  execution_time_ms: number
  created_at: string
}

export interface AttackExecutionSummary {
  id: string
  scenario_id: string
  target_agent_id: string
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  total_attempts: number
  completed_attempts: number
  successful_attempts: number
  attack_success_rate: number
  severity: ImpactLevel | 'NONE'
  started_at: string
  completed_at: string | null
  error_message: string | null
  evaluation_level: string
  scenario: AttackScenario
  target_agent: AgentBasic
}

export interface AttackExecutionDetail extends AttackExecutionSummary {
  attempts: AttackAttempt[]
}

export interface AttackExecutionCreate {
  scenario_id: string
  target_agent_id: string
  attempts: number
}

// ── Phase 3: Findings ─────────────────────────────────────────────────────

export interface AgentFindingSummary {
  id: string
  agent_id: string
  execution_id: string | null
  scenario_id: string | null
  title: string
  description: string
  finding_type: string
  severity: ImpactLevel
  status: 'OPEN' | 'RESOLVED' | 'IGNORED'
  evidence: string
  affected_capability: string | null
  recommendation: string
  evaluation_level: string
  created_at: string
  updated_at: string
  agent: AgentBasic
}

export interface AgentFindingDetail extends AgentFindingSummary {
  execution: AttackExecutionSummary | null
}

// ── Phase 4: Compliance & Governance ────────────────────────────────────────

export interface ComplianceFramework {
  id: string
  name: string
  short_name: string
  description: string
  version: string
  enabled: boolean
  created_at: string
}

export interface ComplianceControl {
  id: string
  framework_id: string
  control_id: string
  title: string
  description: string
  category: string
  severity: string
  evidence_requirements: string
  remediation_guidance: string
  enabled: boolean
}

export interface ComplianceResult {
  id: string
  assessment_id: string
  control_id: string
  status: 'PASS' | 'PARTIAL' | 'FAIL' | 'NOT_ASSESSED'
  score: number | null
  evidence: string
  affected_agent: string
  related_finding_id: string | null
  related_simulation_id: string | null
  explanation: string
  recommendation: string
  control: ComplianceControl
}

export interface ComplianceAssessment {
  id: string
  framework_id: string
  agent_id: string
  status: 'COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NON_COMPLIANT' | 'PENDING'
  score: number
  assessed_controls: number
  passing_controls: number
  failing_controls: number
  partial_controls: number
  not_assessed_controls: number
  assessed_at: string
}

export interface ComplianceAssessmentDetail extends ComplianceAssessment {
  framework: ComplianceFramework
  agent: AgentBasic
  results: ComplianceResult[]
}

export interface AssessmentSummary {
  total_assessments: number;
  fully_compliant: number;
  partially_compliant: number;
  non_compliant: number;
  overall_compliance_score: number;
}

export interface RecoveryEvent {
  id: string;
  recovery_record_id: string;
  event_type: string;
  actor: string;
  message: string;
  metadata_json?: Record<string, any>;
  created_at: string;
}

export interface RecoveryRecord {
  id: string;
  finding_id: string;
  agent_id: string;
  status: string;
  remediation_type?: string;
  title?: string;
  description?: string;
  recommended_action?: string;
  affected_capability?: string;
  approval_status?: string;
  approved_by?: string;
  approved_at?: string;
  execution_status?: string;
  execution_started_at?: string;
  execution_completed_at?: string;
  verification_status?: string;
  previous_asr?: number;
  current_asr?: number;
  residual_risk?: string;
  residual_risk_explanation?: string;
  verification_execution_id?: string;
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RecoverySummary {
  total_recovery_records: number;
  open: number;
  planned: number;
  approval_required: number;
  executing: number;
  recovered: number;
  partially_recovered: number;
  failed: number;
  reopened: number;
  average_asr_reduction: number;
  high_residual_risk_count: number;
  critical_residual_risk_count: number;
}

export interface ComplianceSummary {
  total_frameworks: number
  total_assessments: number
  average_score: number
  compliant_agents: number
  partially_compliant_agents: number
  non_compliant_agents: number
  controls_passing: number
  controls_failing: number
  controls_partial: number
}

export interface AgentFrameworkPosture {
  framework_id: string
  framework_name: string
  score: number
  status: string
  failed_controls: number
  partial_controls: number
  assessment_id: string
}

export interface AgentCompliancePosture {
  agent_id: string
  frameworks: AgentFrameworkPosture[]
}

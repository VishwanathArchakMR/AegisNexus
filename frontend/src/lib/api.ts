import axios from 'axios'
import type {
  AgentListResponse,
  AgentListParams,
  AgentDetail,
  AgentCapability,
  AgentRelationship,
  BlastRadiusResponse,
  DashboardSummary,
  HealthResponse,
  AttackScenario,
  AttackExecutionSummary,
  AttackExecutionDetail,
  AttackExecutionCreate,
  AttackAttempt,
  AgentFindingSummary,
  AgentFindingDetail
} from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const httpClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      console.error('[API]', error.response?.status, error.response?.data ?? error.message)
    }
    return Promise.reject(error)
  },
)

export const api = {
  health: {
    get: (): Promise<HealthResponse> => httpClient.get('/health').then((r) => r.data),
  },
  dashboard: {
    summary: (): Promise<DashboardSummary> =>
      httpClient.get('/dashboard/summary').then((r) => r.data),
  },
  agents: {
    list: (params?: AgentListParams): Promise<AgentListResponse> =>
      httpClient.get('/agents', { params }).then((r) => r.data),
    get: (id: string): Promise<AgentDetail> =>
      httpClient.get(`/agents/${id}`).then((r) => r.data),
    capabilities: (id: string): Promise<AgentCapability[]> =>
      httpClient.get(`/agents/${id}/capabilities`).then((r) => r.data),
    relationships: (id: string): Promise<AgentRelationship[]> =>
      httpClient.get(`/agents/${id}/relationships`).then((r) => r.data),
    blastRadius: (id: string): Promise<BlastRadiusResponse> =>
      httpClient.get(`/agents/${id}/blast-radius`).then((r) => r.data),
  },
  simulations: {
    scenarios: (): Promise<AttackScenario[]> =>
      httpClient.get('/attack-scenarios').then((r) => r.data),
    create: (data: AttackExecutionCreate): Promise<AttackExecutionSummary> =>
      httpClient.post('/attack-simulations', data).then((r) => r.data),
    list: (params?: { target_agent_id?: string; scenario_id?: string; status?: string }): Promise<AttackExecutionSummary[]> =>
      httpClient.get('/attack-simulations', { params }).then((r) => r.data),
    get: (id: string): Promise<AttackExecutionDetail> =>
      httpClient.get(`/attack-simulations/${id}`).then((r) => r.data),
    attempts: (id: string): Promise<AttackAttempt[]> =>
      httpClient.get(`/attack-simulations/${id}/attempts`).then((r) => r.data),
  },
  findings: {
    list: (params?: { severity?: string; status?: string; agent_id?: string; finding_type?: string }): Promise<AgentFindingSummary[]> =>
      httpClient.get('/findings', { params }).then((r) => r.data),
    get: (id: string): Promise<AgentFindingDetail> =>
      httpClient.get(`/findings/${id}`).then((r) => r.data),
  },
  compliance: {
    frameworks: (): Promise<import('../types').ComplianceFramework[]> =>
      httpClient.get('/compliance/frameworks').then((r) => r.data),
    framework: (id: string): Promise<import('../types').ComplianceFramework> =>
      httpClient.get(`/compliance/frameworks/${id}`).then((r) => r.data),
    controls: (params?: { framework_id?: string }): Promise<import('../types').ComplianceControl[]> =>
      httpClient.get('/compliance/controls', { params }).then((r) => r.data),
    assessments: (params?: { framework_id?: string; agent_id?: string; status?: string }): Promise<import('../types').ComplianceAssessment[]> =>
      httpClient.get('/compliance/assessments', { params }).then((r) => r.data),
    assessment: (id: string): Promise<import('../types').ComplianceAssessmentDetail> =>
      httpClient.get(`/compliance/assessments/${id}`).then((r) => r.data),
    createAssessment: (data: { framework_id: string; agent_id: string }): Promise<import('../types').ComplianceAssessmentDetail> =>
      httpClient.post('/compliance/assessments', data).then((r) => r.data),
    agentPosture: (agentId: string): Promise<import('../types').AgentCompliancePosture> =>
      httpClient.get(`/compliance/agents/${agentId}`).then((r) => r.data),
    summary: (): Promise<import('../types').ComplianceSummary> =>
      httpClient.get('/compliance/summary').then((r) => r.data),
  },
  recovery: {
    list: (params?: { status?: string; agent_id?: string; finding_id?: string; residual_risk?: string }): Promise<import('../types').RecoveryRecord[]> =>
      httpClient.get('/recovery/', { params }).then((r) => r.data),
    summary: (): Promise<import('../types').RecoverySummary> =>
      httpClient.get('/recovery/summary').then((r) => r.data),
    get: (id: string): Promise<import('../types').RecoveryRecord> =>
      httpClient.get(`/recovery/${id}`).then((r) => r.data),
    create: (data: { finding_id: string; agent_id: string }): Promise<import('../types').RecoveryRecord> =>
      httpClient.post('/recovery/', data).then((r) => r.data),
    plan: (id: string): Promise<import('../types').RecoveryRecord> =>
      httpClient.post(`/recovery/${id}/plan`).then((r) => r.data),
    approve: (id: string): Promise<import('../types').RecoveryRecord> =>
      httpClient.post(`/recovery/${id}/approve`).then((r) => r.data),
    execute: (id: string): Promise<import('../types').RecoveryRecord> =>
      httpClient.post(`/recovery/${id}/execute`).then((r) => r.data),
    verify: (id: string): Promise<import('../types').RecoveryRecord> =>
      httpClient.post(`/recovery/${id}/verify`).then((r) => r.data),
    events: (id: string): Promise<import('../types').RecoveryEvent[]> =>
      httpClient.get(`/recovery/${id}/events`).then((r) => r.data),
  }
}

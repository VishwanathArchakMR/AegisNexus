import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import DashboardPage from './pages/Dashboard'
import AgentsPage from './pages/Agents'
import AgentDetailPage from './pages/Agents/AgentDetail'
import BlastRadiusPage from './pages/BlastRadius'
import SimulationsPage from './pages/Simulations'
import SimulationDetailPage from './pages/Simulations/SimulationDetail'
import FindingsPage from './pages/Findings'
import FindingDetailPage from './pages/Findings/FindingDetail'
import ComingSoon from './pages/ComingSoon'
import CompliancePage from './pages/Compliance'
import AgentComplianceDetail from './pages/Compliance/AgentComplianceDetail'
import AssessmentDetail from './pages/Compliance/AssessmentDetail'
import Recovery from './pages/Recovery'
import RecoveryDetail from './pages/RecoveryDetail'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'agents', element: <AgentsPage /> },
      {
        path: 'agents/:id',
        element: <AgentDetailPage />,
      },
      {
        path: 'blast-radius',
        element: <BlastRadiusPage />,
      },
      {
        path: 'attack-simulation',
        element: <SimulationsPage />,
      },
      {
        path: 'attack-simulation/:id',
        element: <SimulationDetailPage />,
      },
      {
        path: 'findings',
        element: <FindingsPage />,
      },
      {
        path: 'findings/:id',
        element: <FindingDetailPage />,
      },
      {
        path: 'compliance',
        children: [
          { index: true, element: <CompliancePage /> },
          { path: 'agents/:id', element: <AgentComplianceDetail /> },
          { path: 'assessments/:id', element: <AssessmentDetail /> },
        ]
      },
      {
        path: 'recovery',
        children: [
          { index: true, element: <Recovery /> },
          { path: ':id', element: <RecoveryDetail /> },
        ]
      },
      {
        path: 'settings',
        element: (
          <ComingSoon
            moduleName="Settings"
            description="Platform configuration, agent registration, API integrations, and notification settings."
            phase="Phase 5"
          />
        ),
      },
    ],
  },
])

import { useLocation } from 'react-router-dom'
import { Activity } from 'lucide-react'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agents': 'Agent Inventory',
  '/blast-radius': 'Blast Radius',
  '/attack-simulation': 'Attack Simulation',
  '/findings': 'Security Findings',
  '/compliance': 'Compliance',
  '/recovery': 'Recovery Ledger',
  '/settings': 'Settings',
}

function getLabel(pathname: string): string {
  // Exact match first
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname]
  // Prefix match for nested routes e.g. /agents/123
  const prefix = Object.keys(ROUTE_LABELS).find((k) => pathname.startsWith(k + '/'))
  return prefix ? ROUTE_LABELS[prefix] : pathname
}

export function Topbar() {
  const { pathname } = useLocation()
  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <header className="app-topbar">
      <div className="topbar-breadcrumb">
        <span style={{ color: 'var(--text-muted)' }}>AegisNexus</span>
        <span style={{ color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>{getLabel(pathname)}</span>
      </div>

      <div className="topbar-right">
        <div className="system-status">
          <Activity size={11} color="var(--status-active)" />
          <span>SYSTEM NOMINAL</span>
          <span style={{ color: 'var(--text-disabled)', margin: '0 4px' }}>·</span>
          <span>{now}</span>
        </div>
      </div>
    </header>
  )
}

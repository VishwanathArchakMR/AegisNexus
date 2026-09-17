import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  GitFork,
  Zap,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Settings,
  ShieldAlert,
} from 'lucide-react'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

interface NavSection {
  section: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    section: 'Agents',
    items: [
      { label: 'Inventory', to: '/agents', icon: <Bot size={15} /> },
      { label: 'Blast Radius', to: '/blast-radius', icon: <GitFork size={15} /> },
    ],
  },
  {
    section: 'Security',
    items: [
      { label: 'Attack Simulation', to: '/attack-simulation', icon: <Zap size={15} /> },
      { label: 'Findings', to: '/findings', icon: <AlertTriangle size={15} /> },
    ],
  },
  {
    section: 'Governance',
    items: [
      { label: 'Compliance', to: '/compliance', icon: <CheckCircle2 size={15} /> },
      { label: 'Recovery', to: '/recovery', icon: <RefreshCw size={15} /> },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <ShieldAlert size={17} color="#fff" />
        </div>
        <div>
          <div className="sidebar-logo-text">AegisNexus</div>
          <div className="sidebar-logo-version">v0.1.0 · MVP</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-label">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive || location.pathname.startsWith(item.to + '/') ? ' active' : ''}`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="sidebar-bottom">
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="nav-icon"><Settings size={15} /></span>
          Settings
        </NavLink>
      </div>
    </aside>
  )
}

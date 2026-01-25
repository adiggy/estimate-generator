import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  FolderKanban, Clock, FileText, Search, Menu, X,
  ChevronDown, Server, LayoutDashboard, ClipboardList, Receipt
} from 'lucide-react'
import ProjectsPage from './pages/ProjectsPage'
import HostingPage from './pages/HostingPage'
import ProjectDetailsPage from './pages/ProjectDetailsPage'
import TimePage from './pages/TimePage'
import InvoicesPage from './pages/InvoicesPage'
import SearchPage from './pages/SearchPage'
import ProposalsPage from './pages/ProposalsPage'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Sidebar Navigation
function Sidebar({ isOpen, onClose }) {
  const location = useLocation()

  const navItems = [
    { path: '/dashboard/os-beta', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/dashboard/os-beta/proposals', icon: ClipboardList, label: 'Proposals' },
    { path: '/dashboard/os-beta/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/dashboard/os-beta/hosting', icon: Server, label: 'Hosting' },
    { path: '/dashboard/os-beta/time', icon: Clock, label: 'Time' },
    { path: '/dashboard/os-beta/invoices', icon: Receipt, label: 'Invoices' },
  ]

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-brand-slate z-50
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
        `}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h1 className="text-white font-bold text-lg">Adrial OS</h1>
            <button
              onClick={onClose}
              className="lg:hidden text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-white/40 text-xs mt-1">Agency Operating System</p>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.exact}
              onClick={onClose}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                transition-colors duration-150
                ${isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'}
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Stats Summary (bottom of sidebar) */}
        <div className="p-4 border-t border-white/10">
          <StatsWidget />
        </div>
      </aside>
    </>
  )
}

// Mini stats widget for sidebar
function StatsWidget() {
  const [stats, setStats] = useState(null)
  const [calendarStatus, setCalendarStatus] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)

    // Check Google Calendar connection
    fetch(`${API_BASE}/auth/google/status`)
      .then(r => r.json())
      .then(setCalendarStatus)
      .catch(() => setCalendarStatus({ connected: false }))
  }, [])

  const formatMoney = (cents) => {
    if (!cents) return '$0'
    return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }

  return (
    <div className="space-y-3 text-xs">
      {stats && (
        <>
          <div className="flex justify-between text-white/40">
            <span>Unbilled</span>
            <span className="text-green-400">{formatMoney(stats.unbilled)}</span>
          </div>
          <div className="flex justify-between text-white/40">
            <span>Unpaid</span>
            <span className="text-yellow-400">{formatMoney(stats.unpaid)}</span>
          </div>
          <div className="flex justify-between text-white/40">
            <span>MRR</span>
            <span className="text-blue-400">{formatMoney(stats.mrr)}</span>
          </div>
        </>
      )}

      {/* Calendar connection status */}
      <div className="pt-2 border-t border-white/10">
        {calendarStatus?.connected ? (
          <div className="flex items-center gap-2 text-white/40">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span>Calendar connected</span>
          </div>
        ) : (
          <a
            href="/api/os-beta/auth/google"
            className="flex items-center gap-2 text-white/60 hover:text-white"
          >
            <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
            <span>Connect Calendar</span>
          </a>
        )}
      </div>
    </div>
  )
}

// Top header bar
function Header({ onMenuClick }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/dashboard/os-beta/search?q=${encodeURIComponent(searchQuery)}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, invoices..."
              className="w-64 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}

// Dashboard home view
function DashboardHome() {
  const [stats, setStats] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/stats`).then(r => r.json()),
      fetch(`${API_BASE}/projects?exclude_hosting=true`).then(r => r.json())
    ])
      .then(([statsData, projectsData]) => {
        setStats(statsData)
        setRecentProjects(projectsData.slice(0, 5))
      })
      .catch(console.error)
  }, [])

  const formatMoney = (cents) => {
    if (!cents) return '$0'
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Unbilled Work</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatMoney(stats.unbilled)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Unpaid Invoices</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{formatMoney(stats.unpaid)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Revenue MTD</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(stats.revenue_mtd)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">MRR (Hosting)</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatMoney(stats.mrr)}</p>
          </div>
        </div>
      )}

      {/* Recent Projects */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="font-semibold text-slate-900 mb-4">Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <p className="text-slate-400 text-sm">No projects yet.</p>
        ) : (
          <div className="space-y-2">
            {recentProjects.map(project => (
              <NavLink
                key={project.id}
                to={`/dashboard/os-beta/projects/${project.id}`}
                className="block p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{project.name}</p>
                    <p className="text-sm text-slate-500">{project.client_id}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    project.status === 'active' ? 'bg-green-100 text-green-700' :
                    project.status === 'waiting_on' ? 'bg-yellow-100 text-yellow-700' :
                    project.status === 'done' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Main OS App component
export default function OsApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="proposals" element={<ProposalsPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailsPage />} />
            <Route path="hosting" element={<HostingPage />} />
            <Route path="time" element={<TimePage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="search" element={<SearchPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

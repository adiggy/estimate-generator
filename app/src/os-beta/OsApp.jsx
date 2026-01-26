import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  FolderKanban, Clock, FileText, Search, Menu, X, Users,
  ChevronDown, Server, LayoutDashboard, ClipboardList, Receipt, CalendarDays, MessageSquare, GanttChart
} from 'lucide-react'
import ProjectsPage from './pages/ProjectsPage'
import HostingPage from './pages/HostingPage'
import ProjectDetailsPage from './pages/ProjectDetailsPage'
import TimePage from './pages/TimePage'
import InvoicesPage from './pages/InvoicesPage'
import SearchPage from './pages/SearchPage'
import ProposalsPage from './pages/ProposalsPage'
import SchedulePage from './pages/SchedulePage'
import ProposalEditPage from './pages/ProposalEditPage'
import FeedbackPage from './pages/FeedbackPage'
import MasterTimelinePage from './pages/MasterTimelinePage'

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
    { path: '/dashboard/os-beta/schedule', icon: CalendarDays, label: 'Schedule' },
    { path: '/dashboard/os-beta/timeline', icon: GanttChart, label: 'Timeline' },
    { path: '/dashboard/os-beta/feedback', icon: MessageSquare, label: 'Feedback' },
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
          fixed top-3 left-3 h-[calc(100%-1.5rem)] w-64 bg-brand-slate z-50 rounded-[6px]
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:sticky
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col overflow-hidden
        `}
      >
        {/* Close button for mobile */}
        <div className="lg:hidden flex justify-end p-2">
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-2 pt-0 lg:pt-4 space-y-1 overflow-y-auto">
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
            href={`${API_BASE}/auth/google`}
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

// Top header bar with live search
function Header({ onMenuClick }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()
  const searchRef = useRef(null)

  // Live search as user types
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch (err) {
        console.error('Search error:', err)
      }
      setSearching(false)
    }, 200) // Debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
        setSearchQuery('')
        setSearchResults(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (path) => {
    navigate(path)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults(null)
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-3 -ml-3 text-slate-600 hover:text-slate-900 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-2 relative" ref={searchRef}>
        {searchOpen ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects, invoices..."
                  className="w-80 pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-brand-slate"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false)
                  setSearchQuery('')
                  setSearchResults(null)
                }}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live search results dropdown */}
            {(searchResults || searching) && searchQuery.length >= 2 && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-lg max-h-96 overflow-auto">
                {searching && !searchResults && (
                  <div className="p-4 text-center text-slate-400 text-sm">Searching...</div>
                )}

                {searchResults && searchResults.counts.total === 0 && (
                  <div className="p-4 text-center text-slate-400 text-sm">No results found</div>
                )}

                {searchResults && searchResults.counts.total > 0 && (
                  <div className="divide-y divide-slate-100">
                    {/* Projects */}
                    {searchResults.results.projects.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <FolderKanban className="w-3 h-3" />
                          Projects
                        </p>
                        {searchResults.results.projects.slice(0, 5).map(project => (
                          <button
                            key={project.id}
                            onClick={() => handleResultClick(`/dashboard/os-beta/projects/${project.id}`)}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-blue-100 text-blue-700 rounded">
                              <FolderKanban className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{project.name}</p>
                              <p className="text-xs text-slate-400">{project.client_id}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Invoices */}
                    {searchResults.results.invoices.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Invoices
                        </p>
                        {searchResults.results.invoices.slice(0, 5).map(invoice => (
                          <button
                            key={invoice.id}
                            onClick={() => handleResultClick('/dashboard/os-beta/invoices')}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-green-100 text-green-700 rounded">
                              <FileText className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">Invoice {invoice.id}</p>
                              <p className="text-xs text-slate-400">{invoice.client_id} • ${((invoice.total || 0) / 100).toFixed(0)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Clients */}
                    {searchResults.results.clients.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Clients
                        </p>
                        {searchResults.results.clients.slice(0, 5).map(client => (
                          <div
                            key={client.id}
                            className="px-2 py-2 rounded-lg flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-purple-100 text-purple-700 rounded">
                              <Users className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{client.name}</p>
                              {client.company && <p className="text-xs text-slate-400">{client.company}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
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
  const [searchParams] = useSearchParams()
  const location = useLocation()

  // Check if in read-only view mode (for sharing with clients)
  const isViewMode = searchParams.get('view') === '1'

  // In view mode, only allow access to project details pages
  // Redirect any other access attempts or show a restricted view
  if (isViewMode) {
    // Only allow project detail routes in view mode
    const isProjectRoute = location.pathname.match(/\/dashboard\/os-beta\/projects\/[^/]+$/)

    if (!isProjectRoute) {
      // If trying to access other routes in view mode, show access denied
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
            <p className="text-slate-500">This link only provides access to view a specific project timeline.</p>
          </div>
        </div>
      )
    }

    // Render project details page without sidebar/header in view mode
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="overflow-auto">
          <Routes>
            <Route path="projects/:id" element={<ProjectDetailsPage />} />
            {/* Catch all other routes and show restricted message */}
            <Route path="*" element={
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center p-8">
                  <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
                  <p className="text-slate-500">This link only provides access to view a specific project timeline.</p>
                </div>
              </div>
            } />
          </Routes>
        </main>
      </div>
    )
  }

  // Normal authenticated view with sidebar and header
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-3">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route index element={<DashboardHome />} />
            <Route path="proposals" element={<ProposalsPage />} />
            <Route path="proposals/:id/edit" element={<ProposalEditPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailsPage />} />
            <Route path="hosting" element={<HostingPage />} />
            <Route path="time" element={<TimePage />} />
            <Route path="invoices" element={<InvoicesPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="timeline" element={<MasterTimelinePage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="search" element={<SearchPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

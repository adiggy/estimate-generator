import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FolderKanban, Clock, X, Server, LayoutDashboard, ClipboardList, Receipt, CalendarDays, MessageSquare, GanttChart
} from 'lucide-react'
import { authFetch } from '../lib/auth'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Mini stats widget for sidebar
function StatsWidget() {
  const [stats, setStats] = useState(null)
  const [calendarStatus, setCalendarStatus] = useState(null)

  useEffect(() => {
    authFetch(`${API_BASE}/stats`)
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)

    // Check Google Calendar connection
    authFetch(`${API_BASE}/auth/google/status`)
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

// Sidebar Navigation
export default function Sidebar({ isOpen, onClose }) {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/proposals', icon: ClipboardList, label: 'Proposals' },
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/hosting', icon: Server, label: 'Hosting' },
    { path: '/time', icon: Clock, label: 'Time' },
    { path: '/invoices', icon: Receipt, label: 'Invoices' },
    { path: '/schedule', icon: CalendarDays, label: 'Schedule' },
    { path: '/timeline', icon: GanttChart, label: 'Timeline' },
    { path: '/feedback', icon: MessageSquare, label: 'Feedback' },
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

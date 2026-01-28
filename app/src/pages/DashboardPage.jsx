import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FolderKanban, Clock, Receipt, Server, CalendarDays, GanttChart, ClipboardList, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

function formatMoney(cents) {
  if (!cents) return '$0'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function StatCard({ icon: Icon, label, value, subvalue, color = 'text-slate-900', link }) {
  const content = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subvalue && <div className="text-xs text-slate-400 mt-1">{subvalue}</div>}
    </div>
  )

  if (link) {
    return <Link to={link}>{content}</Link>
  }
  return content
}

function QuickLink({ icon: Icon, label, to, count }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
    >
      <Icon className="w-5 h-5 text-slate-400" />
      <span className="flex-1 text-slate-700 font-medium">{label}</span>
      {count !== undefined && (
        <span className="text-sm text-slate-400">{count}</span>
      )}
      <ArrowRight className="w-4 h-4 text-slate-300" />
    </Link>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [statsRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE}/stats`),
        fetch(`${API_BASE}/projects?status=active&limit=5`)
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        // Get most recently touched projects
        setRecentProjects(
          projectsData
            .sort((a, b) => new Date(b.last_touched_at || b.created_at) - new Date(a.last_touched_at || a.created_at))
            .slice(0, 5)
        )
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Adrial Designs Operating System</p>
      </div>

      {/* CFO Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={TrendingUp}
          label="Unbilled Work"
          value={formatMoney(stats?.unbilled || 0)}
          color="text-green-600"
          link="/time"
        />
        <StatCard
          icon={Receipt}
          label="Unpaid Invoices"
          value={formatMoney(stats?.unpaid || 0)}
          color="text-yellow-600"
          link="/invoices"
        />
        <StatCard
          icon={Server}
          label="Monthly MRR"
          value={formatMoney(stats?.mrr || 0)}
          color="text-blue-600"
          link="/hosting"
        />
        <StatCard
          icon={FolderKanban}
          label="Active Projects"
          value={stats?.activeProjects || 0}
          link="/projects"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Links */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Access</h2>
          <div className="space-y-2">
            <QuickLink icon={ClipboardList} label="Proposals" to="/proposals" />
            <QuickLink icon={FolderKanban} label="Projects" to="/projects" />
            <QuickLink icon={Clock} label="Time Tracking" to="/time" />
            <QuickLink icon={Receipt} label="Invoices" to="/invoices" />
            <QuickLink icon={CalendarDays} label="Schedule" to="/schedule" />
            <QuickLink icon={GanttChart} label="Master Timeline" to="/timeline" />
            <QuickLink icon={Server} label="Hosting" to="/hosting" />
          </div>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Projects</h2>
            <Link to="/projects" className="text-sm text-brand-red hover:text-brand-red/80">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {recentProjects.length === 0 ? (
              <p className="text-slate-400 text-sm py-4">No active projects</p>
            ) : (
              recentProjects.map(project => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    project.priority === 1 ? 'bg-red-500' :
                    project.status === 'waiting_on' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{project.name}</p>
                    <p className="text-xs text-slate-400">{project.client_id}</p>
                  </div>
                  {project.last_touched_at && (
                    <span className="text-xs text-slate-400">
                      {new Date(project.last_touched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {stats?.needsAttention && stats.needsAttention.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Needs Attention
          </h2>
          <div className="space-y-2">
            {stats.needsAttention.map((item, i) => (
              <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

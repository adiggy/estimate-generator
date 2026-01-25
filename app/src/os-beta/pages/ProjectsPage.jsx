import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Plus, Filter, ChevronDown, Circle } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

const STATUS_COLORS = {
  active: 'bg-green-500',
  waiting_on: 'bg-yellow-500',
  paused: 'bg-slate-400',
  done: 'bg-blue-500',
  invoiced: 'bg-purple-500'
}

const STATUS_LABELS = {
  active: 'Active',
  waiting_on: 'Waiting On',
  paused: 'Paused',
  done: 'Done',
  invoiced: 'Invoiced'
}

const PRIORITY_INDICATORS = {
  1: { label: 'Priority', color: 'text-red-500', dot: 'bg-red-500' },
  0: { label: 'Normal', color: 'text-slate-600', dot: null },
  '-1': { label: 'Later', color: 'text-slate-400 italic', dot: null },
  '-2': { label: 'Maybe', color: 'text-slate-300', dot: null }
}

function ProjectCard({ project }) {
  const priority = PRIORITY_INDICATORS[project.priority] || PRIORITY_INDICATORS[0]
  const statusColor = STATUS_COLORS[project.status] || 'bg-slate-400'

  return (
    <NavLink
      to={`/dashboard/os-beta/projects/${project.id}`}
      className="block bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {priority.dot && (
              <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
            )}
            <h3 className={`font-medium truncate ${priority.color}`}>
              {project.name}
            </h3>
          </div>
          <p className="text-sm text-slate-500 mt-1">{project.client_id}</p>
          {project.description && (
            <p className="text-sm text-slate-400 mt-2 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-opacity-10 ${statusColor.replace('bg-', 'bg-opacity-10 text-').replace('500', '700')}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
            {STATUS_LABELS[project.status] || project.status}
          </span>
          {project.last_touched_at && (
            <span className="text-xs text-slate-400">
              {new Date(project.last_touched_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </NavLink>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [statusFilter])

  const loadProjects = async () => {
    setLoading(true)
    try {
      let url = `${API_BASE}/projects?exclude_hosting=true`
      if (statusFilter) {
        url += `&status=${statusFilter}`
      }
      const res = await fetch(url)
      const data = await res.json()
      setProjects(data)
    } catch (err) {
      console.error('Failed to load projects:', err)
    }
    setLoading(false)
  }

  // Group by status
  const groupedProjects = {
    active: projects.filter(p => p.status === 'active' && p.priority > 0),
    activeNormal: projects.filter(p => p.status === 'active' && p.priority === 0),
    waiting: projects.filter(p => p.status === 'waiting_on'),
    paused: projects.filter(p => p.status === 'paused'),
    done: projects.filter(p => p.status === 'done' || p.status === 'invoiced')
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
              showFilters || statusFilter
                ? 'bg-brand-red/10 border-brand-red text-brand-red'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {statusFilter && (
              <span className="bg-brand-red text-white text-xs px-1.5 rounded">1</span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                !statusFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  statusFilter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading projects...</p>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && !statusFilter && (
        <div className="space-y-8">
          {/* Priority */}
          {groupedProjects.active.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                Priority ({groupedProjects.active.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groupedProjects.active.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}

          {/* Active */}
          {groupedProjects.activeNormal.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-green-600 uppercase tracking-wide mb-3">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                Active ({groupedProjects.activeNormal.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groupedProjects.activeNormal.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}

          {/* Waiting On */}
          {groupedProjects.waiting.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-yellow-600 uppercase tracking-wide mb-3">
                <span className="w-2 h-2 bg-yellow-500 rounded-full" />
                Waiting On ({groupedProjects.waiting.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groupedProjects.waiting.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}

          {/* Paused */}
          {groupedProjects.paused.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                <span className="w-2 h-2 bg-slate-400 rounded-full" />
                Paused ({groupedProjects.paused.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groupedProjects.paused.map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
            </section>
          )}

          {/* Done */}
          {groupedProjects.done.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Completed ({groupedProjects.done.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {groupedProjects.done.slice(0, 10).map(p => <ProjectCard key={p.id} project={p} />)}
              </div>
              {groupedProjects.done.length > 10 && (
                <p className="text-sm text-slate-400 mt-3">
                  +{groupedProjects.done.length - 10} more completed projects
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {/* Filtered view */}
      {!loading && statusFilter && (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map(p => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400">No projects found.</p>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GanttChart, ChevronRight, Calendar, Clock, CheckCircle, List, LayoutGrid } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Project colors - distinct colors for each project
const PROJECT_COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-100', text: 'text-blue-700', hex: '#3b82f6' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', hex: '#10b981' },
  { bg: 'bg-violet-500', light: 'bg-violet-100', text: 'text-violet-700', hex: '#8b5cf6' },
  { bg: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', hex: '#f59e0b' },
  { bg: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', hex: '#f43f5e' },
  { bg: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-700', hex: '#06b6d4' },
  { bg: 'bg-orange-500', light: 'bg-orange-100', text: 'text-orange-700', hex: '#f97316' },
  { bg: 'bg-pink-500', light: 'bg-pink-100', text: 'text-pink-700', hex: '#ec4899' },
  { bg: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', hex: '#14b8a6' },
  { bg: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', hex: '#6366f1' }
]

// Group chunks by week for list view
function groupChunksByWeek(chunks, projectColorMap) {
  const weeks = new Map()

  for (const chunk of chunks) {
    const start = new Date(chunk.draft_scheduled_start || chunk.scheduled_start)
    // Get Monday of the week
    const monday = new Date(start)
    monday.setDate(monday.getDate() - monday.getDay() + 1)
    const weekKey = monday.toISOString().split('T')[0]

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, {
        weekStart: monday,
        weekLabel: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        chunks: [],
        totalHours: 0,
        projects: new Set()
      })
    }

    const week = weeks.get(weekKey)
    week.chunks.push({
      ...chunk,
      color: projectColorMap.get(chunk.project_id)
    })
    week.totalHours += chunk.hours
    week.projects.add(chunk.project_id)
  }

  // Sort chunks within each week by scheduled time
  for (const week of weeks.values()) {
    week.chunks.sort((a, b) =>
      new Date(a.draft_scheduled_start || a.scheduled_start) -
      new Date(b.draft_scheduled_start || b.scheduled_start)
    )
    week.projectCount = week.projects.size
  }

  return Array.from(weeks.values()).sort((a, b) => a.weekStart - b.weekStart)
}

// List view component
function ListView({ chunks, projectColorMap, onChunkClick }) {
  const weeks = groupChunksByWeek(chunks, projectColorMap)

  return (
    <div className="space-y-6">
      {weeks.map((week) => (
        <div key={week.weekLabel} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Week header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Week of {week.weekLabel}</h3>
              <p className="text-sm text-slate-500">
                {week.projectCount} projects · {week.chunks.length} chunks · {week.totalHours}h
              </p>
            </div>
          </div>

          {/* Chunks list */}
          <div className="divide-y divide-slate-100">
            {week.chunks.map((chunk, idx) => {
              const startDate = new Date(chunk.draft_scheduled_start || chunk.scheduled_start)
              const dayName = startDate.toLocaleDateString('en-US', { weekday: 'short' })
              const time = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

              return (
                <div
                  key={chunk.id}
                  onClick={() => onChunkClick(chunk.project_id, chunk.id)}
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  {/* Color indicator */}
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: chunk.color?.hex || '#6b7280' }}
                  />

                  {/* Time */}
                  <div className="w-20 flex-shrink-0 text-sm">
                    <div className="font-medium text-slate-700">{dayName}</div>
                    <div className="text-slate-400 text-xs">{time}</div>
                  </div>

                  {/* Hours badge */}
                  <div className="w-10 text-center flex-shrink-0">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium">
                      {chunk.hours}h
                    </span>
                  </div>

                  {/* Project & Chunk info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {chunk.project_name}
                    </div>
                    <div className="text-sm text-slate-500 truncate">
                      {chunk.phase_name ? `${chunk.phase_name}: ` : ''}{chunk.name}
                    </div>
                  </div>

                  {/* Status */}
                  {chunk.status === 'done' && (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Gantt view component (existing functionality)
function GanttView({ projectTimelines, weeks, weekWidth, rowHeight, todayPosition, getPosition, getWidth, scrollContainerRef }) {
  const totalWidth = weeks.length * weekWidth
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div style={{ minWidth: `${totalWidth}px` }}>
          {/* Timeline header */}
          <div className="border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
            <div className="flex h-10">
              {weeks.map((week, i) => {
                const isCurrentWeek = week <= today && new Date(week.getTime() + 7 * 24 * 60 * 60 * 1000) > today
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center text-xs border-r border-slate-200 last:border-r-0 ${
                      isCurrentWeek ? 'bg-red-50 text-brand-red font-medium' : 'text-slate-500'
                    }`}
                    style={{ width: `${weekWidth}px`, flexShrink: 0 }}
                  >
                    {week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Project rows */}
          <div className="relative" style={{ minHeight: `${projectTimelines.length * rowHeight + 32}px` }}>
            {/* Week grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {weeks.map((_, i) => (
                <div
                  key={i}
                  className="border-r border-slate-100 last:border-r-0"
                  style={{ width: `${weekWidth}px`, flexShrink: 0 }}
                />
              ))}
            </div>

            {/* Today line */}
            {todayPosition >= 0 && todayPosition <= 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand-red z-20"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-brand-red text-white text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                  Today
                </div>
              </div>
            )}

            {/* Project bars */}
            {projectTimelines.map((project, idx) => {
              const left = getPosition(project.projectStart)
              const width = getWidth(project.projectStart, project.projectEnd)
              const rowTop = idx * rowHeight + 16
              const isComplete = project.progress === 1

              return (
                <Link
                  key={project.id}
                  to={`/dashboard/os-beta/projects/${project.id}`}
                  className={`absolute h-10 rounded-lg flex items-center px-3 text-white font-medium shadow-md transition-all hover:shadow-lg hover:scale-[1.02] z-10 ${project.color.bg} ${
                    project.hasDraft ? 'border-2 border-dashed border-white/50' : ''
                  } ${isComplete ? 'ring-2 ring-green-400 ring-offset-2' : ''}`}
                  style={{
                    left: `${left}%`,
                    width: `${Math.max(width, 3)}%`,
                    minWidth: '120px',
                    top: `${rowTop}px`
                  }}
                  title={`${project.name}: ${project.doneHours}/${project.totalHours}h complete`}
                >
                  <span className="truncate text-sm flex-1">{project.name}</span>
                  <span className="text-xs opacity-75 ml-2">{project.totalHours}h</span>
                  {project.progress > 0 && project.progress < 1 && (
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-b-lg"
                      style={{ width: `${project.progress * 100}%` }}
                    />
                  )}
                  {isComplete && (
                    <CheckCircle className="w-4 h-4 ml-1 flex-shrink-0" />
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {projectTimelines.some(p => p.hasDraft) && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-3 h-3 rounded bg-slate-300 border border-dashed border-slate-400" />
                <span>Draft schedule</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400">
            Scroll to see full timeline
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MasterTimelinePage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('list') // 'gantt' or 'list'
  const scrollContainerRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectsRes, chunksRes] = await Promise.all([
        fetch(`${API_BASE}/projects?status=active`),
        fetch(`${API_BASE}/schedule/draft/chunks`)
      ])
      const projectsData = await projectsRes.json()
      const chunksData = await chunksRes.json()

      // Filter to only projects that have scheduled chunks
      const projectsWithChunks = projectsData.filter(p =>
        chunksData.some(c => c.project_id === p.id)
      )

      setProjects(projectsWithChunks)
      setChunks(chunksData)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  const handleChunkClick = (projectId, chunkId) => {
    navigate(`/dashboard/os-beta/projects/${projectId}#chunk-${chunkId}`)
  }

  // Calculate timeline range from chunks
  const scheduledChunks = chunks.filter(c => c.draft_scheduled_start || c.scheduled_start)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let startDate, endDate

  if (scheduledChunks.length > 0) {
    const dates = scheduledChunks.flatMap(c => {
      const start = c.draft_scheduled_start || c.scheduled_start
      const end = c.draft_scheduled_end || c.scheduled_end || start
      return [new Date(start), new Date(end)]
    })

    startDate = new Date(Math.min(...dates))
    endDate = new Date(Math.max(...dates))

    if (today < startDate) startDate = today
    if (today > endDate) endDate = today
  } else {
    startDate = today
    endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 28)
  }

  // Align to week boundaries
  startDate.setDate(startDate.getDate() - startDate.getDay())
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()) + 14)

  // Generate weeks array
  const weeks = []
  let currentWeek = new Date(startDate)
  while (currentWeek < endDate) {
    weeks.push(new Date(currentWeek))
    currentWeek.setDate(currentWeek.getDate() + 7)
  }

  const weekWidth = 120
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

  const getPosition = (date) => {
    const d = new Date(date)
    const dayOffset = Math.ceil((d - startDate) / (1000 * 60 * 60 * 24))
    return (dayOffset / totalDays) * 100
  }

  const getWidth = (start, end) => {
    const s = new Date(start)
    const e = new Date(end)
    const durationDays = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1)
    return (durationDays / totalDays) * 100
  }

  const todayPosition = getPosition(today)

  // Build project color map
  const projectColorMap = new Map()
  projects.forEach((project, idx) => {
    projectColorMap.set(project.id, PROJECT_COLORS[idx % PROJECT_COLORS.length])
  })

  // Calculate project timelines for Gantt view
  const projectTimelines = projects.map((project, idx) => {
    const projectChunks = scheduledChunks.filter(c => c.project_id === project.id)

    if (projectChunks.length === 0) return null

    const starts = projectChunks.map(c => new Date(c.draft_scheduled_start || c.scheduled_start))
    const ends = projectChunks.map(c => new Date(c.draft_scheduled_end || c.scheduled_end || c.draft_scheduled_start || c.scheduled_start))

    const projectStart = new Date(Math.min(...starts))
    const projectEnd = new Date(Math.max(...ends))

    const totalHours = projectChunks.reduce((sum, c) => sum + c.hours, 0)
    const doneHours = projectChunks.filter(c => c.status === 'done').reduce((sum, c) => sum + c.hours, 0)
    const progress = totalHours > 0 ? doneHours / totalHours : 0

    const hasDraft = projectChunks.some(c => c.draft_scheduled_start && !c.scheduled_start)

    return {
      ...project,
      projectStart,
      projectEnd,
      totalHours,
      doneHours,
      progress,
      hasDraft,
      chunkCount: projectChunks.length,
      color: PROJECT_COLORS[idx % PROJECT_COLORS.length]
    }
  }).filter(Boolean)

  // Scroll to today on mount (Gantt view)
  useEffect(() => {
    if (viewMode === 'gantt' && scrollContainerRef.current && scheduledChunks.length > 0) {
      const container = scrollContainerRef.current
      const todayPixelPosition = (todayPosition / 100) * container.scrollWidth
      container.scrollLeft = todayPixelPosition - (container.clientWidth / 2)
    }
  }, [viewMode, todayPosition, scheduledChunks.length])

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Loading timeline...</p>
      </div>
    )
  }

  if (projectTimelines.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Master Timeline</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <GanttChart className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 mb-2">No scheduled work yet</p>
          <p className="text-sm text-slate-400 mb-6">
            Generate a schedule to see all projects on the timeline
          </p>
          <Link
            to="/dashboard/os-beta"
            className="inline-flex items-center gap-2 bg-brand-slate text-white px-4 py-2 rounded-lg hover:bg-brand-slate/90"
          >
            Go to Dashboard
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  const rowHeight = 56

  return (
    <div className="p-6 max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Timeline</h1>
          <p className="text-slate-500">All active projects with scheduled work</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2.5 text-sm rounded-md transition-colors min-h-[44px] flex items-center gap-2 ${
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
          <button
            onClick={() => setViewMode('gantt')}
            className={`px-4 py-2.5 text-sm rounded-md transition-colors min-h-[44px] flex items-center gap-2 ${
              viewMode === 'gantt'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Gantt
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Projects</p>
          <p className="text-2xl font-bold text-slate-900">{projectTimelines.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Chunks</p>
          <p className="text-2xl font-bold text-slate-900">{scheduledChunks.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total Hours</p>
          <p className="text-2xl font-bold text-slate-900">
            {projectTimelines.reduce((sum, p) => sum + p.totalHours, 0)}h
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Date Range</p>
          <p className="text-lg font-bold text-slate-900">
            {projectTimelines.length > 0 && (
              <>
                {new Date(Math.min(...projectTimelines.map(p => p.projectStart))).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' - '}
                {new Date(Math.max(...projectTimelines.map(p => p.projectEnd))).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </>
            )}
          </p>
        </div>
      </div>

      {/* View content */}
      {viewMode === 'list' ? (
        <ListView
          chunks={scheduledChunks}
          projectColorMap={projectColorMap}
          onChunkClick={handleChunkClick}
        />
      ) : (
        <GanttView
          projectTimelines={projectTimelines}
          weeks={weeks}
          weekWidth={weekWidth}
          rowHeight={rowHeight}
          todayPosition={todayPosition}
          getPosition={getPosition}
          getWidth={getWidth}
          scrollContainerRef={scrollContainerRef}
        />
      )}

      {/* Project Legend */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-medium text-slate-900 mb-3">Projects</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projectTimelines.map((project) => (
            <Link
              key={project.id}
              to={`/dashboard/os-beta/projects/${project.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <span className={`w-4 h-4 rounded ${project.color.bg}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{project.name}</p>
                <p className="text-xs text-slate-500">
                  {project.chunkCount} chunks / {project.totalHours}h
                  {project.doneHours > 0 && ` (${project.doneHours}h done)`}
                </p>
              </div>
              <div className="text-right text-xs text-slate-400">
                <p>{project.projectStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                <p>to {project.projectEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

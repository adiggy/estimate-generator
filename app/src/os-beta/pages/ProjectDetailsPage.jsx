import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Save, X, Plus, Trash2, Clock,
  Calendar, CheckCircle, Circle, PlayCircle, Archive, MoreVertical, FileText,
  LayoutList, GanttChart, Share2, Copy, Check
} from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Helper to render text with clickable links
function LinkifiedText({ text }) {
  if (!text) return null

  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g
  const parts = text.split(urlPattern)

  return (
    <>
      {parts.map((part, i) => {
        if (part.match(urlPattern)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-red hover:underline break-all"
            >
              {part}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

const STATUS_COLORS = {
  pending: 'bg-slate-200 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700'
}

const STATUS_ICONS = {
  pending: Circle,
  scheduled: Calendar,
  in_progress: PlayCircle,
  done: CheckCircle
}

function ChunkCard({ chunk, onUpdate, onDelete, isHighlighted }) {
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState(chunk)
  const StatusIcon = STATUS_ICONS[chunk.status] || Circle

  const handleSave = async () => {
    try {
      await fetch(`${API_BASE}/chunks/${chunk.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      onUpdate({ ...chunk, ...editData })
      setEditing(false)
    } catch (err) {
      console.error('Failed to update chunk:', err)
    }
  }

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/chunks/${chunk.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const updated = await res.json()
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  if (editing) {
    return (
      <div className="bg-white border border-brand-red rounded-lg p-4">
        <input
          type="text"
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          className="w-full font-medium text-slate-900 border-b border-slate-200 focus:border-brand-red focus:outline-none pb-1 mb-2"
        />
        <textarea
          value={editData.description || ''}
          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
          placeholder="Description..."
          className="w-full text-sm text-slate-600 border border-slate-200 rounded p-2 focus:border-brand-red focus:outline-none resize-none"
          rows={2}
        />
        <div className="flex items-center gap-4 mt-3">
          <select
            value={editData.hours}
            onChange={(e) => setEditData({ ...editData, hours: parseInt(e.target.value) })}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            <option value={1}>1 hour</option>
            <option value={2}>2 hours</option>
            <option value={3}>3 hours</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-sm bg-brand-slate text-white px-3 py-1 rounded hover:bg-brand-slate/90"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      id={`chunk-${chunk.id}`}
      className={`bg-white border rounded-lg p-4 hover:border-slate-300 group transition-all ${
        isHighlighted ? 'border-brand-red ring-2 ring-brand-red/20' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${
              chunk.status === 'done' ? 'text-green-500' :
              chunk.status === 'in_progress' ? 'text-yellow-500' :
              chunk.status === 'scheduled' ? 'text-blue-500' :
              'text-slate-400'
            }`} />
            <h4 className="font-medium text-slate-900 truncate">{chunk.name}</h4>
          </div>
          {chunk.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{chunk.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {chunk.hours}h
            </span>
            {(chunk.scheduled_start || chunk.draft_scheduled_start) && (
              <span className={`flex items-center gap-1 ${chunk.draft_scheduled_start && !chunk.scheduled_start ? 'text-blue-500' : ''}`}>
                <Calendar className="w-3 h-3" />
                {chunk.draft_scheduled_start && !chunk.scheduled_start ? (
                  <span title="Draft schedule - not yet published">
                    {new Date(chunk.draft_scheduled_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(chunk.draft_scheduled_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    <span className="ml-1 text-blue-400">(draft)</span>
                  </span>
                ) : chunk.scheduled_start ? (
                  <span>
                    {new Date(chunk.scheduled_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' '}
                    {new Date(chunk.scheduled_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                ) : null}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <select
            value={chunk.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[chunk.status]}`}
          >
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <button
            onClick={() => setEditing(true)}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(chunk.id)}
            className="p-1 text-slate-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function AddChunkForm({ projectId, phaseName, onAdd, onCancel }) {
  const [data, setData] = useState({
    name: '',
    description: '',
    hours: 1,
    phase_name: phaseName
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!data.name.trim()) return

    try {
      const res = await fetch(`${API_BASE}/chunks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          project_id: projectId
        })
      })
      const newChunk = await res.json()
      onAdd(newChunk)
      setData({ name: '', description: '', hours: 1, phase_name: phaseName })
    } catch (err) {
      console.error('Failed to create chunk:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-4">
      <input
        type="text"
        value={data.name}
        onChange={(e) => setData({ ...data, name: e.target.value })}
        placeholder="Chunk name..."
        className="w-full font-medium bg-transparent focus:outline-none"
        autoFocus
      />
      <div className="flex items-center gap-4 mt-3">
        <select
          value={data.hours}
          onChange={(e) => setData({ ...data, hours: parseInt(e.target.value) })}
          className="text-sm border border-slate-200 rounded px-2 py-1 bg-white"
        >
          <option value={1}>1 hour</option>
          <option value={2}>2 hours</option>
          <option value={3}>3 hours</option>
        </select>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="text-sm bg-brand-slate text-white px-3 py-1 rounded hover:bg-brand-slate/90"
        >
          Add Chunk
        </button>
      </div>
    </form>
  )
}

// Gantt Timeline View Component - Shows phases as consolidated bars
function GanttTimeline({ phases, project }) {
  const scrollContainerRef = useRef(null)

  // Collect all scheduled dates to determine timeline range
  const allChunks = phases.flatMap(p => p.chunks)
  const scheduledChunks = allChunks.filter(c => c.scheduled_start || c.draft_scheduled_start)

  // Calculate date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let startDate, endDate

  if (scheduledChunks.length > 0) {
    const dates = scheduledChunks.flatMap(c => {
      const start = c.scheduled_start || c.draft_scheduled_start
      const end = c.scheduled_end || c.draft_scheduled_end || start
      return [new Date(start), new Date(end)]
    })

    startDate = new Date(Math.min(...dates))
    endDate = new Date(Math.max(...dates))

    // Expand to include today if not in range
    if (today < startDate) startDate = today
    if (today > endDate) endDate = today
  } else {
    // No scheduled chunks, show this week and next 3 weeks
    startDate = today
    endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 28)
  }

  // Align to week boundaries (Sunday)
  startDate.setDate(startDate.getDate() - startDate.getDay())
  // Add more buffer to allow scrolling into the future (4 weeks past end date)
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()) + 28)

  // Generate array of weeks
  const weeks = []
  let currentWeek = new Date(startDate)
  while (currentWeek < endDate) {
    weeks.push(new Date(currentWeek))
    currentWeek.setDate(currentWeek.getDate() + 7)
  }

  // Fixed width per week for scrollable timeline (in pixels)
  const weekWidth = 120

  // Calculate total days for positioning
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))

  // Helper to calculate position as percentage
  const getPosition = (date) => {
    const d = new Date(date)
    const dayOffset = Math.ceil((d - startDate) / (1000 * 60 * 60 * 24))
    return (dayOffset / totalDays) * 100
  }

  // Helper to calculate width as percentage
  const getWidth = (start, end) => {
    const s = new Date(start)
    const e = new Date(end)
    const durationDays = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1)
    return (durationDays / totalDays) * 100
  }

  const todayPosition = getPosition(today)

  // Scroll to center on today on mount
  useEffect(() => {
    if (scrollContainerRef.current && scheduledChunks.length > 0) {
      const container = scrollContainerRef.current
      const todayPixelPosition = (todayPosition / 100) * container.scrollWidth
      // Center the view on today
      container.scrollLeft = todayPixelPosition - (container.clientWidth / 2)
    }
  }, [todayPosition, scheduledChunks.length])

  // Calculate phase data: aggregate date range and progress for each phase
  const phaseData = phases.map(({ name, chunks }) => {
    const scheduledInPhase = chunks.filter(c => c.scheduled_start || c.draft_scheduled_start)
    const doneCount = chunks.filter(c => c.status === 'done').length
    const totalCount = chunks.length
    const progress = totalCount > 0 ? doneCount / totalCount : 0

    // Get phase date range from chunks
    let phaseStart = null
    let phaseEnd = null
    let hasDraft = false

    scheduledInPhase.forEach(c => {
      const start = new Date(c.scheduled_start || c.draft_scheduled_start)
      const end = new Date(c.scheduled_end || c.draft_scheduled_end || c.scheduled_start || c.draft_scheduled_start)

      if (!c.scheduled_start && c.draft_scheduled_start) hasDraft = true

      if (!phaseStart || start < phaseStart) phaseStart = start
      if (!phaseEnd || end > phaseEnd) phaseEnd = end
    })

    return {
      name,
      chunks,
      scheduledCount: scheduledInPhase.length,
      doneCount,
      totalCount,
      progress,
      phaseStart,
      phaseEnd,
      hasDraft,
      totalHours: chunks.reduce((sum, c) => sum + c.hours, 0)
    }
  })

  // Phase colors - cycle through a set of distinct colors
  const phaseColors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500'
  ]

  if (scheduledChunks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <GanttChart className="w-12 h-12 mx-auto text-slate-300 mb-4" />
        <p className="text-slate-500 mb-2">No scheduled work yet</p>
        <p className="text-sm text-slate-400">
          Schedule work to see the timeline view
        </p>
      </div>
    )
  }

  // Total width for the scrollable content
  const totalWidth = weeks.length * weekWidth

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div style={{ minWidth: `${totalWidth}px` }}>
          {/* Timeline header with weeks */}
          <div className="border-b border-slate-200 bg-slate-50 sticky top-0">
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

          {/* Timeline content - single row with phase bars */}
          <div className="relative px-4 py-6" style={{ minHeight: '120px' }}>
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

            {/* Phase bars - each phase gets its own row */}
            <div className="relative" style={{ minHeight: `${Math.max(phaseData.filter(p => p.phaseStart).length * 48 + 16, 64)}px` }}>
              {phaseData.map((phase, idx) => {
                if (!phase.phaseStart) return null

                const left = getPosition(phase.phaseStart)
                const width = getWidth(phase.phaseStart, phase.phaseEnd)
                const color = phaseColors[idx % phaseColors.length]

                // Determine bar styling based on progress
                const isComplete = phase.progress === 1
                const isInProgress = phase.progress > 0 && phase.progress < 1

                // Each phase gets its own row
                const rowTop = idx * 48 + 8

                return (
                  <div
                    key={phase.name}
                    className={`absolute h-10 rounded-lg flex items-center justify-center px-3 text-white font-medium shadow-md transition-all hover:shadow-lg z-10 ${color} ${
                      phase.hasDraft ? 'opacity-80 border-2 border-dashed border-white/50' : ''
                    } ${isComplete ? 'ring-2 ring-green-400 ring-offset-2' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 5)}%`,
                      minWidth: '80px',
                      top: `${rowTop}px`
                    }}
                    title={`${phase.name}: ${phase.doneCount}/${phase.totalCount} complete (${phase.totalHours}h total)`}
                  >
                    <span className="truncate text-sm">{phase.name}</span>
                    {/* Progress indicator inside bar */}
                    {isInProgress && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-white/40 rounded-b-lg"
                        style={{ width: `${phase.progress * 100}%` }}
                      />
                    )}
                    {isComplete && (
                      <CheckCircle className="w-4 h-4 ml-2 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

        {/* Footer with total progress */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="font-medium">Total Progress:</span>
              <span>
                {phaseData.reduce((sum, p) => sum + p.doneCount, 0)}/
                {phaseData.reduce((sum, p) => sum + p.totalCount, 0)} tasks complete
              </span>
            </div>
            <div className="flex items-center gap-4">
              {phaseData.some(p => p.hasDraft) && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 rounded bg-slate-300 border border-dashed border-slate-400" />
                  <span>Draft schedule</span>
                </div>
              )}
              <div className="text-xs text-slate-400">
                Scroll to see full timeline
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase legend - below the card */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {phaseData.map((phase, idx) => (
          <div key={phase.name} className="flex items-center gap-2 text-sm">
            <span className={`w-3 h-3 rounded ${phaseColors[idx % phaseColors.length]}`} />
            <span className="text-slate-700 font-medium">{phase.name}</span>
            <span className="text-slate-400">
              {phase.doneCount}/{phase.totalCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProjectDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [project, setProject] = useState(null)
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingChunk, setAddingChunk] = useState(null) // phase_name or null
  const [showMenu, setShowMenu] = useState(false)
  const [highlightedChunk, setHighlightedChunk] = useState(null)
  const [viewMode, setViewMode] = useState('cards') // 'cards' or 'timeline'
  const [copied, setCopied] = useState(false)

  // Check if in read-only view mode (for sharing with clients)
  const isViewMode = searchParams.get('view') === '1'

  // Copy share link to clipboard
  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/dashboard/os-beta/projects/${id}?view=1`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  // Handle hash navigation to scroll to and highlight specific chunk
  useEffect(() => {
    const hash = location.hash
    if (hash && hash.startsWith('#chunk-')) {
      const chunkId = hash.replace('#chunk-', '')
      setHighlightedChunk(chunkId)

      // Scroll to the chunk after a brief delay for render
      setTimeout(() => {
        const element = document.getElementById(hash.substring(1))
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)

      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightedChunk(null)
      }, 3000)
    }
  }, [location.hash, chunks])

  // In view mode, default to timeline if there are scheduled chunks
  useEffect(() => {
    if (isViewMode && chunks.some(c => c.scheduled_start || c.draft_scheduled_start)) {
      setViewMode('timeline')
    }
  }, [isViewMode, chunks])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectRes, chunksRes] = await Promise.all([
        fetch(`${API_BASE}/projects/${id}`),
        fetch(`${API_BASE}/chunks?project_id=${id}`)
      ])
      const projectData = await projectRes.json()
      const chunksData = await chunksRes.json()
      setProject(projectData)
      setChunks(chunksData)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  const handleChunkUpdate = (updatedChunk) => {
    setChunks(prev => prev.map(c => c.id === updatedChunk.id ? updatedChunk : c))
  }

  const handleChunkDelete = async (chunkId) => {
    if (!confirm('Delete this chunk?')) return
    try {
      await fetch(`${API_BASE}/chunks/${chunkId}`, { method: 'DELETE' })
      setChunks(prev => prev.filter(c => c.id !== chunkId))
    } catch (err) {
      console.error('Failed to delete chunk:', err)
    }
  }

  const handleChunkAdd = (newChunk) => {
    setChunks(prev => [...prev, newChunk])
    setAddingChunk(null)
  }

  const handleArchive = async () => {
    const isArchived = project.status === 'archived'
    const action = isArchived ? 'unarchive' : 'archive'
    const newStatus = isArchived ? 'active' : 'archived'

    if (!confirm(`${isArchived ? 'Unarchive' : 'Archive'} "${project.name}"?${!isArchived ? '\n\nThis will hide the project from the active projects list.' : ''}`)) {
      return
    }
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const updated = await res.json()
      setProject(updated)
      setShowMenu(false)
    } catch (err) {
      console.error(`Failed to ${action} project:`, err)
      alert(`Failed to ${action} project`)
    }
  }

  const handleDelete = async () => {
    if (project.status !== 'archived') {
      alert('Projects must be archived before they can be deleted.')
      return
    }
    if (!confirm(`Permanently delete "${project.name}"?\n\nThis action cannot be undone. All chunks and time logs will also be deleted.`)) {
      return
    }
    try {
      await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' })
      setShowMenu(false)
      navigate('/dashboard/os-beta/projects')
    } catch (err) {
      console.error('Failed to delete project:', err)
      alert('Failed to delete project')
    }
  }

  // Group chunks by phase, tracking the minimum phase_order for each phase
  const phaseData = chunks.reduce((acc, chunk) => {
    const phase = chunk.phase_name || 'General'
    if (!acc[phase]) {
      acc[phase] = { chunks: [], minOrder: chunk.phase_order ?? Infinity }
    }
    acc[phase].chunks.push(chunk)
    // Track the minimum phase_order to sort phases correctly
    if (chunk.phase_order !== null && chunk.phase_order !== undefined) {
      acc[phase].minOrder = Math.min(acc[phase].minOrder, chunk.phase_order)
    }
    return acc
  }, {})

  // Convert to array and sort by phase_order (lowest first)
  // Also sort chunks within each phase by draft_order
  const phases = Object.entries(phaseData)
    .sort((a, b) => a[1].minOrder - b[1].minOrder)
    .map(([name, data]) => ({
      name,
      chunks: data.chunks.sort((a, b) => {
        // Sort by draft_order first, then by created_at as fallback
        const orderA = a.draft_order ?? Infinity
        const orderB = b.draft_order ?? Infinity
        if (orderA !== orderB) return orderA - orderB
        return new Date(a.created_at) - new Date(b.created_at)
      })
    }))

  // Calculate totals
  const totalHours = chunks.reduce((sum, c) => sum + c.hours, 0)
  const completedHours = chunks.filter(c => c.status === 'done').reduce((sum, c) => sum + c.hours, 0)

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-slate-400">Project not found.</p>
      </div>
    )
  }

  return (
    <div className={`p-6 max-w-6xl mx-auto ${isViewMode ? 'pb-16' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          {!isViewMode && (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            {project.status === 'archived' && !isViewMode && (
              <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">Archived</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-slate-500">{project.client_id}</p>
            {project.proposal_id && !isViewMode && (
              <Link
                to={`/dashboard/os-beta/proposals/${project.proposal_id}/edit`}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                View Proposal
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-start gap-4">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              Cards
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <GanttChart className="w-4 h-4" />
              Timeline
            </button>
          </div>

          <div className="text-right">
            <p className="text-sm text-slate-500">Progress</p>
            <p className="text-2xl font-bold text-slate-900">{completedHours}/{totalHours}h</p>
            <div className="w-32 h-2 bg-slate-200 rounded-full mt-2">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${totalHours ? (completedHours / totalHours) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Share button (only in edit mode) */}
          {!isViewMode && (
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                copied
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share
                </>
              )}
            </button>
          )}

          {/* Project actions menu (only in edit mode) */}
          {!isViewMode && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  <button
                    onClick={handleArchive}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Archive className="w-4 h-4" />
                    {project.status === 'archived' ? 'Unarchive' : 'Archive Project'}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={project.status !== 'archived'}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={project.status !== 'archived' ? 'Archive first to enable delete' : ''}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Claude Code tip - only in edit mode */}
      {!isViewMode && totalHours > 0 && chunks.filter(c => c.status === 'pending').length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Claude Code tip:</span>{' '}
            Schedule these chunks on your calendar:
          </p>
          <code className="block mt-2 text-xs bg-slate-100 text-slate-700 p-2 rounded font-mono">
            "Schedule the pending chunks for {project.name} across next week based on my calendar availability"
          </code>
        </div>
      )}

      {/* Project Metadata - simplified in view mode */}
      {!isViewMode ? (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wide">Status</span>
              <span className={`font-medium ${
                project.status === 'active' ? 'text-green-600' :
                project.status === 'waiting_on' ? 'text-yellow-600' :
                project.status === 'paused' ? 'text-slate-500' :
                project.status === 'done' ? 'text-blue-600' :
                project.status === 'invoiced' ? 'text-purple-600' :
                'text-slate-600'
              }`}>
                {project.status || 'active'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wide">Priority</span>
              <span className={`font-medium ${
                project.priority === 1 ? 'text-red-600' :
                project.priority === -1 ? 'text-slate-400 italic' :
                project.priority === -2 ? 'text-slate-300 italic' :
                'text-slate-600'
              }`}>
                {project.priority === 1 ? 'Priority' :
                 project.priority === -1 ? 'Later' :
                 project.priority === -2 ? 'Maybe' :
                 'Normal'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wide">Billing</span>
              <span className="text-slate-600 font-medium">
                {project.billing_type || 'hourly'}
                {project.billing_platform === 'bonsai_legacy' && (
                  <span className="ml-1 text-xs text-slate-400">(Bonsai)</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wide">Rate</span>
              <span className="text-slate-600 font-medium">
                ${(project.rate / 100).toFixed(0)}/hr
              </span>
            </div>
            {project.budget_low && project.budget_high && (
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wide">Budget</span>
                <span className="text-slate-600 font-medium">
                  ${(project.budget_low / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })} - ${(project.budget_high / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            {project.due_date && (
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wide">Due Date</span>
                <span className="text-slate-600 font-medium">
                  {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wide">Last Touched</span>
              <span className="text-slate-600 font-medium">
                {project.last_touched_at
                  ? new Date(project.last_touched_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Never'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-xs uppercase tracking-wide">Created</span>
              <span className="text-slate-600 font-medium">
                {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Simplified view for clients - just due date if exists */
        project.due_date && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-400 block text-xs uppercase tracking-wide">Target Completion</span>
                <span className="text-slate-600 font-medium">
                  {new Date(project.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {/* Project description/notes - only in edit mode (contains internal info) */}
      {!isViewMode && (project.description || project.notes) && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <p className="text-slate-600 whitespace-pre-wrap">
            <LinkifiedText text={project.notes || project.description} />
          </p>
        </div>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <GanttTimeline phases={phases} project={project} />
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="space-y-6">
          {phases.map(({ name: phaseName, chunks: phaseChunks }) => (
            <section key={phaseName} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-900">{phaseName}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>{phaseChunks.filter(c => c.status === 'done').length}/{phaseChunks.length} complete</span>
                  <span>{phaseChunks.reduce((sum, c) => sum + c.hours, 0)}h total</span>
                </div>
              </div>

              <div className="space-y-3">
                {phaseChunks.map(chunk => (
                  isViewMode ? (
                    /* Read-only chunk display for clients */
                    <div
                      key={chunk.id}
                      className={`bg-white border rounded-lg p-4 ${
                        chunk.status === 'done' ? 'border-green-200 bg-green-50/50' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {STATUS_ICONS[chunk.status] && (
                              <span className={`w-4 h-4 ${
                                chunk.status === 'done' ? 'text-green-500' :
                                chunk.status === 'in_progress' ? 'text-yellow-500' :
                                chunk.status === 'scheduled' ? 'text-blue-500' :
                                'text-slate-400'
                              }`}>
                                {(() => {
                                  const Icon = STATUS_ICONS[chunk.status]
                                  return <Icon className="w-4 h-4" />
                                })()}
                              </span>
                            )}
                            <h4 className="font-medium text-slate-900">{chunk.name}</h4>
                          </div>
                          {chunk.description && (
                            <p className="text-sm text-slate-500 mt-1">{chunk.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {chunk.hours}h
                            </span>
                            {chunk.scheduled_start && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(chunk.scheduled_start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[chunk.status]}`}>
                          {chunk.status === 'in_progress' ? 'In Progress' :
                           chunk.status.charAt(0).toUpperCase() + chunk.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <ChunkCard
                      key={chunk.id}
                      chunk={chunk}
                      onUpdate={handleChunkUpdate}
                      onDelete={handleChunkDelete}
                      isHighlighted={highlightedChunk === chunk.id}
                    />
                  )
                ))}

                {/* Add chunk button - only in edit mode */}
                {!isViewMode && (
                  addingChunk === phaseName ? (
                    <AddChunkForm
                      projectId={id}
                      phaseName={phaseName}
                      onAdd={handleChunkAdd}
                      onCancel={() => setAddingChunk(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingChunk(phaseName)}
                      className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add chunk
                    </button>
                  )
                )}
              </div>
            </section>
          ))}

          {/* Add new phase - only in edit mode */}
          {!isViewMode && phases.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-400 mb-4">No chunks yet. Add your first one!</p>
              {addingChunk === 'General' ? (
                <div className="max-w-md mx-auto px-4">
                  <AddChunkForm
                    projectId={id}
                    phaseName="General"
                    onAdd={handleChunkAdd}
                    onCancel={() => setAddingChunk(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingChunk('General')}
                  className="bg-brand-slate text-white px-4 py-2 rounded-lg hover:bg-brand-slate/90"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Add Chunk
                </button>
              )}
            </div>
          )}

          {/* Empty state for view mode */}
          {isViewMode && phases.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <p className="text-slate-400">No work items have been scheduled yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Footer for view mode */}
      {isViewMode && (
        <div className="mt-8 text-center text-sm text-slate-400">
          <p>Project timeline by Adrial Designs</p>
          <p className="mt-1">
            <a href="https://adrialdesigns.com" target="_blank" rel="noopener noreferrer" className="text-brand-red hover:underline">
              adrialdesigns.com
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

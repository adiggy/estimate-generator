import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Check, X, RefreshCw, Clock, AlertCircle, ChevronLeft, ChevronRight, DollarSign, TrendingUp } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Time formatting helpers
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

// Group chunks by day for display
function groupByDay(chunks) {
  const groups = new Map()

  for (const chunk of chunks) {
    const day = new Date(chunk.draft_scheduled_start).toDateString()
    if (!groups.has(day)) {
      groups.set(day, [])
    }
    groups.get(day).push(chunk)
  }

  // Sort by date
  return Array.from(groups.entries())
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([day, items]) => ({
      day,
      date: new Date(day),
      chunks: items.sort((a, b) =>
        new Date(a.draft_scheduled_start) - new Date(b.draft_scheduled_start)
      )
    }))
}

// Day column for week view
function DayColumn({ day, chunks, rocks = [], lunchBreaks = [], hourHeight = 60, onChunkClick }) {
  const hours = Array.from({ length: 8 }, (_, i) => i + 12) // 12 PM - 7 PM

  // Filter rocks for this day
  const dayRocks = rocks.filter(rock => {
    if (rock.allDay) {
      // All-day events span from start date to end date
      const rockStart = new Date(rock.start)
      const rockEnd = new Date(rock.end)
      return day.date >= rockStart && day.date < rockEnd
    } else {
      const rockDate = new Date(rock.start).toDateString()
      return rockDate === day.date.toDateString()
    }
  })

  // Filter lunch breaks for this day
  const dayLunches = lunchBreaks.filter(lunch => {
    const lunchDate = new Date(lunch.start).toDateString()
    return lunchDate === day.date.toDateString()
  })

  return (
    <div className="flex-1 min-w-0">
      <div className="text-center py-2 border-b border-slate-200 bg-slate-50 font-medium text-sm">
        <div className="text-slate-500">
          {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
        <div className="text-slate-900">
          {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      </div>

      <div className="relative" style={{ height: hours.length * hourHeight }}>
        {/* Hour lines */}
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute w-full border-b border-slate-100"
            style={{ top: i * hourHeight, height: hourHeight }}
          />
        ))}

        {/* Rocks (calendar blockers) - rendered first so chunks appear on top */}
        {dayRocks.map(rock => {
          if (rock.allDay) {
            // All-day event - show as full day banner
            return (
              <div
                key={rock.id}
                className="absolute left-1 right-1 bg-slate-200 text-slate-600 rounded p-1 overflow-hidden text-xs border border-slate-300"
                style={{ top: 0, height: 20 }}
                title={rock.title}
              >
                <div className="truncate font-medium">{rock.title}</div>
              </div>
            )
          }

          const start = new Date(rock.start)
          const end = new Date(rock.end)
          const startHour = start.getHours() + start.getMinutes() / 60
          const endHour = end.getHours() + end.getMinutes() / 60

          // Clamp to work hours (12-20)
          const clampedStart = Math.max(12, Math.min(20, startHour))
          const clampedEnd = Math.max(12, Math.min(20, endHour))

          if (clampedEnd <= clampedStart) return null // Outside work hours

          const top = (clampedStart - 12) * hourHeight
          const height = (clampedEnd - clampedStart) * hourHeight

          return (
            <div
              key={rock.id}
              className="absolute left-1 right-1 bg-slate-100 border border-slate-300 text-slate-500 rounded p-1 overflow-hidden text-xs"
              style={{ top, height: Math.max(height, 20), zIndex: 1 }}
              title={`${rock.title} (blocked)`}
            >
              <div className="truncate font-medium">{rock.title}</div>
              <div className="truncate opacity-70">
                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          )
        })}

        {/* Lunch breaks */}
        {dayLunches.map((lunch, idx) => {
          const start = new Date(lunch.start)
          const end = new Date(lunch.end)
          const startHour = start.getHours() + start.getMinutes() / 60
          const endHour = end.getHours() + end.getMinutes() / 60

          // Clamp to work hours
          const clampedStart = Math.max(12, Math.min(20, startHour))
          const clampedEnd = Math.max(12, Math.min(20, endHour))

          if (clampedEnd <= clampedStart) return null

          const top = (clampedStart - 12) * hourHeight
          const height = (clampedEnd - clampedStart) * hourHeight

          return (
            <div
              key={`lunch-${idx}`}
              className="absolute left-1 right-1 bg-green-100 border border-green-300 text-green-700 rounded p-1 overflow-hidden text-xs"
              style={{ top, height: Math.max(height, 24), zIndex: 1 }}
              title="Lunch / Workout break"
            >
              <div className="font-medium truncate">🥗 LUNCH / WORKOUT</div>
              <div className="truncate opacity-70">
                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </div>
            </div>
          )
        })}

        {/* Scheduled chunks */}
        {chunks.map(chunk => {
          const start = new Date(chunk.draft_scheduled_start)
          const end = new Date(chunk.draft_scheduled_end)
          const startHour = start.getHours() + start.getMinutes() / 60
          const endHour = end.getHours() + end.getMinutes() / 60

          // Clamp to visible work hours (12pm-8pm)
          const clampedStart = Math.max(12, Math.min(20, startHour))
          const clampedEnd = Math.max(12, Math.min(20, endHour))

          // Skip if entirely outside work hours
          if (clampedEnd <= clampedStart) return null

          const top = (clampedStart - 12) * hourHeight
          const height = (clampedEnd - clampedStart) * hourHeight

          return (
            <div
              key={chunk.id}
              onClick={() => onChunkClick(chunk.project_id, chunk.id)}
              className="absolute left-1 right-1 bg-brand-red text-white rounded p-1 overflow-hidden text-xs shadow-sm cursor-pointer hover:bg-red-700 transition-colors"
              style={{ top, height: Math.max(height, 24), zIndex: 2 }}
              title={`${chunk.project_name}: ${chunk.name} — Click to view project`}
            >
              <div className="font-medium truncate">{chunk.project_name}</div>
              <div className="truncate opacity-80">{chunk.name}</div>
              <div className="opacity-60">{chunk.hours}h</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Week view calendar with navigation
function WeekView({ draftChunks, rocks = [], lunchBreaks = [], weekStart, onWeekChange, weekOffset, onChunkClick }) {
  const hours = Array.from({ length: 8 }, (_, i) => i + 12) // 12 PM - 7 PM
  const hourHeight = 60

  // Generate 5 days (Mon-Fri)
  const days = Array.from({ length: 5 }, (_, i) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + i)
    return {
      date,
      chunks: draftChunks.filter(c => {
        const chunkDate = new Date(c.draft_scheduled_start).toDateString()
        return chunkDate === date.toDateString()
      })
    }
  })

  // Calculate week hours
  const weekChunks = draftChunks.filter(c => {
    const date = new Date(c.draft_scheduled_start)
    return date >= weekStart && date < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  })
  const weekHours = weekChunks.reduce((sum, c) => sum + c.hours, 0)

  // Check if there are chunks in adjacent weeks
  const hasPrevWeek = draftChunks.some(c => {
    const date = new Date(c.draft_scheduled_start)
    return date < weekStart
  })
  const hasNextWeek = draftChunks.some(c => {
    const date = new Date(c.draft_scheduled_start)
    return date >= new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Week navigation header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <button
          onClick={() => onWeekChange(-1)}
          disabled={!hasPrevWeek}
          className="p-2.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="text-center">
          <div className="font-semibold text-slate-900">
            Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="text-sm text-slate-500">
            {weekHours > 0 ? `${weekChunks.length} chunks (${weekHours}h)` : 'No chunks scheduled'}
          </div>
        </div>
        <button
          onClick={() => onWeekChange(1)}
          disabled={!hasNextWeek}
          className="p-2.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex">
        {/* Time column */}
        <div className="w-16 flex-shrink-0 border-r border-slate-200">
          <div className="h-[52px] border-b border-slate-200 bg-slate-50" />
          <div style={{ height: hours.length * hourHeight }}>
            {hours.map((hour, i) => (
              <div
                key={hour}
                className="text-xs text-slate-400 text-right pr-2 border-b border-slate-100"
                style={{ height: hourHeight, lineHeight: `${hourHeight}px` }}
              >
                {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        {days.map((day, i) => (
          <DayColumn key={i} day={day} chunks={day.chunks} rocks={rocks} lunchBreaks={lunchBreaks} hourHeight={hourHeight} onChunkClick={onChunkClick} />
        ))}
      </div>
    </div>
  )
}

// Draft summary card
function DraftSummary({ draft, draftChunks, onPublish, onClear, publishing }) {
  const totalHours = draftChunks.reduce((sum, c) => sum + c.hours, 0)
  const projectCount = new Set(draftChunks.map(c => c.project_id)).size

  // Calculate actual date range from chunks
  const sortedChunks = [...draftChunks].sort(
    (a, b) => new Date(a.draft_scheduled_start) - new Date(b.draft_scheduled_start)
  )
  const firstDate = sortedChunks[0]?.draft_scheduled_start
  const lastDate = sortedChunks[sortedChunks.length - 1]?.draft_scheduled_end

  // Calculate number of weeks
  const weeksSpan = firstDate && lastDate
    ? Math.ceil((new Date(lastDate) - new Date(firstDate)) / (7 * 24 * 60 * 60 * 1000))
    : 1

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-red" />
            Draft Schedule
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {firstDate ? formatDate(firstDate) : formatFullDate(draft?.week_start)} - {lastDate ? formatDate(lastDate) : formatFullDate(draft?.week_end)}
            {weeksSpan > 1 && <span className="ml-2 text-slate-400">({weeksSpan} weeks)</span>}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={publishing}
            className="px-4 py-2.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 min-h-[44px]"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={onPublish}
            disabled={publishing}
            className="px-4 py-2.5 text-sm bg-brand-slate text-white rounded-lg hover:bg-brand-slate/80 disabled:opacity-50 flex items-center gap-1 min-h-[44px]"
          >
            {publishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Publish to Calendar
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-900">{draftChunks.length}</div>
          <div className="text-xs text-slate-500">Chunks</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-900">{totalHours}</div>
          <div className="text-xs text-slate-500">Hours</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-900">{weeksSpan}</div>
          <div className="text-xs text-slate-500">Weeks</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-2xl font-bold text-slate-900">{projectCount}</div>
          <div className="text-xs text-slate-500">Projects</div>
        </div>
      </div>

      {draft?.rocks_avoided > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
          <Check className="w-4 h-4" />
          Avoided {draft.rocks_avoided} calendar conflicts
        </div>
      )}
    </div>
  )
}

// List view of scheduled chunks
function ChunkList({ chunks, onChunkClick }) {
  const grouped = groupByDay(chunks)

  return (
    <div className="space-y-4">
      {grouped.map(group => (
        <div key={group.day} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-medium text-sm text-slate-700">
            {formatFullDate(group.date)}
          </div>
          <div className="divide-y divide-slate-100">
            {group.chunks.map(chunk => (
              <div
                key={chunk.id}
                onClick={() => onChunkClick(chunk.project_id, chunk.id)}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="w-16 text-sm text-slate-500">
                  {formatTime(chunk.draft_scheduled_start)}
                </div>
                <div className="w-8 text-center">
                  <span className="inline-block px-2 py-0.5 bg-brand-red/10 text-brand-red text-xs rounded font-medium">
                    {chunk.hours}h
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 truncate">
                    {chunk.project_name}
                  </div>
                  <div className="text-sm text-slate-500 truncate">
                    {chunk.name}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {chunk.phase_name || 'General'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Revenue Forecast component
function RevenueForecast({ forecast }) {
  if (!forecast || !forecast.weeks || forecast.weeks.length === 0) {
    return null
  }

  const formatMoney = (cents) => {
    if (!cents) return '$0'
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Revenue Forecast
        </h3>
        <div className="text-right">
          <span className="text-xs text-slate-500">Total (conservative)</span>
          <div className="text-lg font-bold text-green-600">{formatMoney(forecast.total)}</div>
        </div>
      </div>

      <div className="space-y-3">
        {forecast.weeks.map((week, i) => (
          <div key={i} className="border border-slate-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Week of {week.weekLabel}</span>
              <span className="text-sm font-semibold text-green-600">{formatMoney(week.total)}</span>
            </div>
            <div className="space-y-1">
              {week.phases.map((phase, j) => (
                <div key={j} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 truncate flex-1 mr-2">
                    {phase.projectName} - {phase.phaseName}
                  </span>
                  <span className="text-slate-600">{formatMoney(phase.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400 mt-3">
        Based on phase completion dates using low-end hour estimates at $120/hr
      </p>
    </div>
  )
}

// Empty state
function EmptyState({ onGenerate, generating }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-slate-900 mb-2">No Draft Schedule</h3>
      <p className="text-slate-500 mb-4">
        Generate a draft schedule to preview before publishing to your calendar.
      </p>

      <div className="bg-slate-50 rounded-lg p-4 mb-4 text-left">
        <p className="text-sm text-slate-600 mb-2">
          <span className="font-semibold text-slate-800">Claude Code tip:</span>{' '}
          Ask Claude to generate and review a schedule:
        </p>
        <code className="block text-xs bg-slate-100 text-slate-700 p-2 rounded font-mono">
          "Generate a schedule for next week, avoiding my existing calendar events"
        </code>
      </div>

      <button
        onClick={onGenerate}
        disabled={generating}
        className="px-4 py-2 bg-brand-slate text-white rounded-lg hover:bg-brand-slate/80 disabled:opacity-50 flex items-center gap-2 mx-auto"
      >
        {generating ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Calendar className="w-4 h-4" />
            Generate Draft Schedule
          </>
        )}
      </button>
    </div>
  )
}

// Main schedule page
export default function SchedulePage() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(null)
  const [draftChunks, setDraftChunks] = useState([])
  const [rocks, setRocks] = useState([])
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('week') // 'week' or 'list'
  const [weekOffset, setWeekOffset] = useState(0)

  const handleChunkClick = (projectId, chunkId) => {
    navigate(`/dashboard/os-beta/projects/${projectId}#chunk-${chunkId}`)
  }

  // Fetch current draft, calendar rocks, and revenue forecast
  const fetchDraft = async () => {
    try {
      const [draftRes, chunksRes, rocksRes, forecastRes] = await Promise.all([
        fetch(`${API_BASE}/schedule/draft`),
        fetch(`${API_BASE}/schedule/draft/chunks`),
        fetch(`${API_BASE}/schedule/rocks`),
        fetch(`${API_BASE}/schedule/forecast`)
      ])

      if (draftRes.ok) {
        const draftData = await draftRes.json()
        setDraft(draftData)
      } else {
        setDraft(null)
      }

      if (chunksRes.ok) {
        const chunksData = await chunksRes.json()
        setDraftChunks(chunksData)
      } else {
        setDraftChunks([])
      }

      if (rocksRes.ok) {
        const rocksData = await rocksRes.json()
        setRocks(rocksData)
      } else {
        setRocks([])
      }

      if (forecastRes.ok) {
        const forecastData = await forecastRes.json()
        setForecast(forecastData)
      } else {
        setForecast(null)
      }

      // Reset week offset when fetching new draft
      setWeekOffset(0)
    } catch (err) {
      console.error('Failed to fetch draft:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDraft()
  }, [])

  // Generate new draft
  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/schedule/generate`, {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to generate schedule')
      }

      await fetchDraft()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  // Publish draft
  const handlePublish = async () => {
    setPublishing(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE}/schedule/publish`, {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to publish schedule')
      }

      await fetchDraft()
    } catch (err) {
      setError(err.message)
    } finally {
      setPublishing(false)
    }
  }

  // Clear draft
  const handleClear = async () => {
    try {
      const res = await fetch(`${API_BASE}/schedule/clear`, {
        method: 'POST'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to clear schedule')
      }

      setDraft(null)
      setDraftChunks([])
    } catch (err) {
      setError(err.message)
    }
  }

  // Calculate week start for calendar view (with offset navigation)
  const baseWeekStart = draft?.week_start
    ? new Date(draft.week_start)
    : (() => {
        const now = new Date()
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? 1 : 1) // Adjust to Monday
        const monday = new Date(now.setDate(diff + 7)) // Next week
        monday.setHours(0, 0, 0, 0)
        return monday
      })()

  // Apply week offset for navigation
  const weekStart = new Date(baseWeekStart)
  weekStart.setDate(weekStart.getDate() + weekOffset * 7)

  const handleWeekChange = (delta) => {
    setWeekOffset(prev => prev + delta)
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
          <p className="text-sm text-slate-500">
            Preview and publish work chunks to your calendar
          </p>
        </div>

        {draftChunks.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-2.5 text-sm rounded-md transition-colors min-h-[44px] ${
                viewMode === 'week'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2.5 text-sm rounded-md transition-colors min-h-[44px] ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              List
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {draftChunks.length === 0 ? (
        <EmptyState onGenerate={handleGenerate} generating={generating} />
      ) : (
        <>
          <DraftSummary
            draft={draft}
            draftChunks={draftChunks}
            onPublish={handlePublish}
            onClear={handleClear}
            publishing={publishing}
          />

          {/* Revenue Forecast */}
          <RevenueForecast forecast={forecast} />

          {viewMode === 'week' ? (
            <WeekView
              draftChunks={draftChunks}
              rocks={rocks}
              lunchBreaks={draft?.lunch_breaks || []}
              weekStart={weekStart}
              onWeekChange={handleWeekChange}
              weekOffset={weekOffset}
              onChunkClick={handleChunkClick}
            />
          ) : (
            <ChunkList chunks={draftChunks} onChunkClick={handleChunkClick} />
          )}
        </>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Play, Pause, Square, Clock, CheckCircle, Trash2, Receipt, ArrowRight, Edit2, Check, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

function formatDuration(seconds) {
  if (!seconds || seconds < 0) seconds = 0
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatMinutes(minutes) {
  if (!minutes) return '0:00'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

// Calculate total elapsed time for a timer
function getElapsedSeconds(timer) {
  let total = timer.accumulated_seconds || 0
  if (timer.status === 'active' && timer.last_resumed_at) {
    const currentSession = Math.floor((Date.now() - new Date(timer.last_resumed_at).getTime()) / 1000)
    total += currentSession
  }
  return total
}

// Active Timer Display
function ActiveTimer({ timer, projects, onPause, onUpdateTime }) {
  const [elapsed, setElapsed] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editHours, setEditHours] = useState('0')
  const [editMins, setEditMins] = useState('00')
  const [editSecs, setEditSecs] = useState('00')
  const intervalRef = useRef(null)

  useEffect(() => {
    setElapsed(getElapsedSeconds(timer))

    if (timer.status === 'active') {
      intervalRef.current = setInterval(() => {
        const newElapsed = getElapsedSeconds(timer)
        setElapsed(newElapsed)
        // Update browser title with timer
        document.title = `${formatDuration(newElapsed)} - Timer Running`
      }, 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      // Reset title when component unmounts
      document.title = 'Adrial OS'
    }
  }, [timer])

  const project = projects.find(p => p.id === timer.project_id)

  const startEdit = () => {
    const hours = Math.floor(elapsed / 3600)
    const mins = Math.floor((elapsed % 3600) / 60)
    const secs = Math.floor(elapsed % 60)
    setEditHours(String(hours))
    setEditMins(String(mins).padStart(2, '0'))
    setEditSecs(String(secs).padStart(2, '0'))
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
  }

  const saveEdit = () => {
    const hours = parseInt(editHours) || 0
    const mins = parseInt(editMins) || 0
    const secs = parseInt(editSecs) || 0
    const newSeconds = hours * 3600 + mins * 60 + secs
    onUpdateTime(timer.id, newSeconds)
    setEditing(false)
  }

  return (
    <div className="bg-brand-slate rounded-2xl p-6 text-white text-center">
      <p className="text-slate-300 text-sm mb-2">Timer Running</p>

      {editing ? (
        <div className="mb-4">
          <div className="flex items-center justify-center gap-1 text-5xl font-bold font-mono">
            <input
              type="number"
              min="0"
              max="99"
              value={editHours}
              onChange={(e) => setEditHours(e.target.value)}
              className="w-16 bg-white/20 text-white text-center rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
            <span>:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={editMins}
              onChange={(e) => setEditMins(e.target.value.slice(-2).padStart(2, '0'))}
              className="w-16 bg-white/20 text-white text-center rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span>:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={editSecs}
              onChange={(e) => setEditSecs(e.target.value.slice(-2).padStart(2, '0'))}
              className="w-16 bg-white/20 text-white text-center rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-white/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex justify-center gap-2 mt-3">
            <button
              onClick={saveEdit}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          onClick={startEdit}
          className="text-5xl font-bold font-mono mb-4 cursor-pointer hover:bg-white/10 rounded-lg px-2 py-1 -mx-2 transition-colors"
          title="Click to edit time"
        >
          {formatDuration(elapsed)}
        </p>
      )}

      <p className="text-slate-300 mb-1">{timer.description || 'Work session'}</p>
      <p className="text-slate-400 text-sm mb-6">
        {project?.name || timer.project_id}
      </p>

      <button
        onClick={() => onPause(timer.id)}
        className="w-full py-4 bg-white text-brand-slate rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
      >
        <Pause className="w-6 h-6" />
        Pause Timer
      </button>
    </div>
  )
}

// New Timer Form
function NewTimerForm({ projects, onStart }) {
  const [selectedProject, setSelectedProject] = useState('')
  const [description, setDescription] = useState('')

  const handleStart = () => {
    if (!selectedProject) return
    onStart(selectedProject, description)
    setDescription('')
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <p className="text-slate-500 text-sm mb-4 text-center">Start a new timer</p>

      <select
        value={selectedProject}
        onChange={(e) => setSelectedProject(e.target.value)}
        className="w-full p-4 text-lg border border-slate-200 rounded-xl mb-4 focus:border-brand-red focus:outline-none"
      >
        <option value="">Select project...</option>
        {projects.map(project => (
          <option key={project.id} value={project.id}>
            {project.name} ({project.client_id})
          </option>
        ))}
      </select>

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What are you working on?"
        className="w-full p-4 text-lg border border-slate-200 rounded-xl mb-6 focus:border-brand-red focus:outline-none"
      />

      <button
        onClick={handleStart}
        disabled={!selectedProject}
        className="w-full py-4 bg-brand-slate text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-3 hover:bg-brand-slate/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play className="w-6 h-6" />
        Start Timer
      </button>
    </div>
  )
}

// Draft Timer Entry (paused/stopped but not finalized)
function DraftEntry({ entry, projects, onResume, onFinalize, onDelete }) {
  const project = projects.find(p => p.id === entry.project_id)
  const totalSeconds = entry.accumulated_seconds || 0
  const isPaused = entry.status === 'paused'

  return (
    <div className={`bg-white rounded-lg border p-4 ${isPaused ? 'border-yellow-300' : 'border-slate-200'}`}>
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${isPaused ? 'bg-yellow-100' : 'bg-slate-100'}`}>
          {isPaused ? (
            <Pause className="w-5 h-5 text-yellow-600" />
          ) : (
            <Clock className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate">
            {entry.description || 'Work session'}
          </p>
          <p className="text-sm text-slate-500 truncate">
            {project?.name || entry.project_id}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono font-semibold text-slate-900">
            {formatDuration(totalSeconds)}
          </p>
          <p className="text-xs text-slate-400">
            {isPaused ? 'Paused' : 'Draft'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
        {isPaused && (
          <button
            onClick={() => onResume(entry.id)}
            className="flex-1 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        )}
        <button
          onClick={() => onFinalize(entry.id)}
          className="flex-1 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center justify-center gap-2"
        >
          <CheckCircle className="w-4 h-4" />
          Finalize
        </button>
        <button
          onClick={() => onDelete(entry.id, entry.description || 'Work session')}
          className="py-2 px-3 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center justify-center"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// Finalized Entry (ready for invoice)
function FinalizedEntry({ entry, projects, onDelete }) {
  const project = projects.find(p => p.id === entry.project_id)

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
      {entry.invoiced ? (
        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
      ) : (
        <Clock className="w-5 h-5 text-blue-500 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">
          {entry.description || 'Work session'}
        </p>
        <p className="text-sm text-slate-500 truncate">
          {project?.name || entry.project_id}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono font-semibold text-slate-900">
          {formatMinutes(entry.duration_minutes)}
        </p>
        {entry.invoiced && entry.invoice_id ? (
          <Link
            to="/invoices"
            className="text-xs text-green-600 hover:text-green-700"
          >
            View Invoice
          </Link>
        ) : (
          <p className="text-xs text-slate-400">Ready</p>
        )}
      </div>
      {!entry.invoiced && (
        <button
          onClick={() => onDelete(entry.id, entry.description || 'Work session')}
          className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Delete"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

export default function TimePage() {
  const [activeTimer, setActiveTimer] = useState(null)
  const [draftTimers, setDraftTimers] = useState([])
  const [finalizedEntries, setFinalizedEntries] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { id, description }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [timersRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE}/time-logs`),
        fetch(`${API_BASE}/projects?status=active`)
      ])
      const timers = await timersRes.json()
      const projectsData = await projectsRes.json()

      // Separate timers by status
      const active = timers.find(t => t.status === 'active')
      const drafts = timers.filter(t => t.status === 'paused' || t.status === 'draft')
      const finalized = timers.filter(t => t.status === 'finalized' || (t.ended_at && t.status !== 'paused' && t.status !== 'draft' && t.status !== 'active'))
        .sort((a, b) => new Date(b.ended_at || b.updated_at) - new Date(a.ended_at || a.updated_at))

      setActiveTimer(active || null)
      setDraftTimers(drafts)
      setFinalizedEntries(finalized.slice(0, 20))
      setProjects(projectsData)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  const handleStart = async (projectId, description) => {
    try {
      const res = await fetch(`${API_BASE}/time-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          description: description || 'Work session',
          status: 'active',
          last_resumed_at: new Date().toISOString()
        })
      })
      const newTimer = await res.json()
      setActiveTimer(newTimer)
    } catch (err) {
      console.error('Failed to start timer:', err)
    }
  }

  const handlePause = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/time-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      })
      const updated = await res.json()
      setActiveTimer(null)
      setDraftTimers(prev => [updated, ...prev])
    } catch (err) {
      console.error('Failed to pause timer:', err)
    }
  }

  const handleResume = async (id) => {
    // If there's already an active timer, pause it first
    if (activeTimer) {
      await handlePause(activeTimer.id)
    }

    try {
      const res = await fetch(`${API_BASE}/time-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      })
      const updated = await res.json()
      setActiveTimer(updated)
      setDraftTimers(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Failed to resume timer:', err)
    }
  }

  const handleStop = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/time-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })
      const updated = await res.json()
      setActiveTimer(null)
      setDraftTimers(prev => [updated, ...prev.filter(t => t.id !== id)])
    } catch (err) {
      console.error('Failed to stop timer:', err)
    }
  }

  const handleUpdateTime = async (id, newSeconds) => {
    try {
      const res = await fetch(`${API_BASE}/time-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_time', accumulated_seconds: newSeconds })
      })
      const updated = await res.json()
      setActiveTimer(updated)
    } catch (err) {
      console.error('Failed to update time:', err)
    }
  }

  const handleFinalize = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/time-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finalize' })
      })
      const updated = await res.json()
      setDraftTimers(prev => prev.filter(t => t.id !== id))
      setFinalizedEntries(prev => [updated, ...prev])
    } catch (err) {
      console.error('Failed to finalize timer:', err)
    }
  }

  const handleDelete = (id, description) => {
    setDeleteConfirm({ id, description: description || 'this time entry' })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    try {
      await fetch(`${API_BASE}/time-logs/${deleteConfirm.id}`, { method: 'DELETE' })
      setDraftTimers(prev => prev.filter(t => t.id !== deleteConfirm.id))
      setFinalizedEntries(prev => prev.filter(t => t.id !== deleteConfirm.id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      {/* Active Timer or New Timer Form */}
      {activeTimer ? (
        <ActiveTimer
          timer={activeTimer}
          projects={projects}
          onPause={handlePause}
          onUpdateTime={handleUpdateTime}
        />
      ) : (
        <NewTimerForm projects={projects} onStart={handleStart} />
      )}

      {/* Draft Timers */}
      {draftTimers.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Draft Timers
            <span className="ml-2 text-sm font-normal text-slate-400">
              (resume or finalize)
            </span>
          </h2>
          <div className="space-y-3">
            {draftTimers.map(entry => (
              <DraftEntry
                key={entry.id}
                entry={entry}
                projects={projects}
                onResume={handleResume}
                onFinalize={handleFinalize}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Finalized Entries (ready for invoice) */}
      {finalizedEntries.filter(e => !e.invoiced).length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Ready to Invoice</h2>
            <Link
              to="/invoices?create=1"
              className="flex items-center gap-2 text-sm text-brand-slate hover:text-brand-slate/80"
            >
              <Receipt className="w-4 h-4" />
              Create Invoice
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-2">
            {finalizedEntries.filter(e => !e.invoiced).map(entry => (
              <FinalizedEntry
                key={entry.id}
                entry={entry}
                projects={projects}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recently Invoiced */}
      {finalizedEntries.filter(e => e.invoiced).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recently Invoiced</h2>
          <div className="space-y-2">
            {finalizedEntries.filter(e => e.invoiced).slice(0, 5).map(entry => (
              <FinalizedEntry
                key={entry.id}
                entry={entry}
                projects={projects}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title="Delete Time Entry"
        message={`Delete "${deleteConfirm?.description}"?\n\nThis cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  )
}

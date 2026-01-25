import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Save, X, Plus, Trash2, Clock,
  Calendar, CheckCircle, Circle, PlayCircle
} from 'lucide-react'

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

function ChunkCard({ chunk, onUpdate, onDelete }) {
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
            className="text-sm bg-brand-red text-white px-3 py-1 rounded hover:bg-brand-red/90"
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 group">
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
            {chunk.scheduled_start && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(chunk.scheduled_start).toLocaleDateString()}
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
          className="text-sm bg-brand-red text-white px-3 py-1 rounded hover:bg-brand-red/90"
        >
          Add Chunk
        </button>
      </div>
    </form>
  )
}

export default function ProjectDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [chunks, setChunks] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingChunk, setAddingChunk] = useState(null) // phase_name or null

  useEffect(() => {
    loadData()
  }, [id])

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

  // Group chunks by phase
  const phases = chunks.reduce((acc, chunk) => {
    const phase = chunk.phase_name || 'General'
    if (!acc[phase]) acc[phase] = []
    acc[phase].push(chunk)
    return acc
  }, {})

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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="text-slate-500">{project.client_id}</p>
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
      </div>

      {/* Claude Code tip */}
      {totalHours > 0 && chunks.filter(c => c.status === 'pending').length > 0 && (
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

      {/* Project description/notes */}
      {(project.description || project.notes) && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
          <p className="text-slate-600 whitespace-pre-wrap">
            <LinkifiedText text={project.notes || project.description} />
          </p>
        </div>
      )}

      {/* Gantt-style phase view */}
      <div className="space-y-6">
        {Object.entries(phases).map(([phaseName, phaseChunks]) => (
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
                <ChunkCard
                  key={chunk.id}
                  chunk={chunk}
                  onUpdate={handleChunkUpdate}
                  onDelete={handleChunkDelete}
                />
              ))}

              {addingChunk === phaseName ? (
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
              )}
            </div>
          </section>
        ))}

        {/* Add new phase */}
        {Object.keys(phases).length === 0 && (
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
                className="bg-brand-red text-white px-4 py-2 rounded-lg hover:bg-brand-red/90"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Chunk
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

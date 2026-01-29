import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useSearchParams, Link, useLocation } from 'react-router-dom'
import { Printer, Copy, Check, Palette, Layout as LayoutIcon, Smartphone, BarChart3, Shield, Zap, Megaphone, RefreshCw, PenTool, Plus, Trash2, ArrowLeft, FileText, Calendar, Percent, Download, LinkIcon, Lock, Save, History, ChevronDown, RotateCcw, X } from 'lucide-react'

// Import unified Layout and pages
import Layout from './components/Layout'
import VersionModal from './components/VersionModal'
import ConfirmModal from './components/ConfirmModal'
import DashboardPage from './pages/DashboardPage'
import ProposalsPage from './pages/ProposalsPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailsPage from './pages/ProjectDetailsPage'
import HostingPage from './pages/HostingPage'
import TimePage from './pages/TimePage'
import InvoicesPage from './pages/InvoicesPage'
import SchedulePage from './pages/SchedulePage'
import MasterTimelinePage from './pages/MasterTimelinePage'
import FeedbackPage from './pages/FeedbackPage'
import SearchPage from './pages/SearchPage'

// Use relative path for Vercel, localhost for dev
const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api' : '/api'

// Token-based authentication
const getAuthToken = () => localStorage.getItem('authToken')
const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('authToken', token)
  } else {
    localStorage.removeItem('authToken')
  }
}
const isAuthenticated = () => !!getAuthToken()

// Helper for authenticated fetch requests
const authFetch = async (url, options = {}) => {
  const token = getAuthToken()
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return fetch(url, { ...options, headers })
}

const Logo = () => (
  <svg viewBox="0 0 508.8 94.3" className="h-10 w-auto">
    <defs>
      <linearGradient id="logo-grad" x1="47.1" y1="8" x2="47.1" y2="90.2" gradientTransform="translate(0 96.4) scale(1 -1)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#f69220"/>
        <stop offset="1" stopColor="#d72027"/>
      </linearGradient>
    </defs>
    <path fill="url(#logo-grad)" d="M47.1,94.2h0c14.8,0,28-6.8,36.7-17.5,4.4-5.7,7-14.3-2.8-24.4-11.5-11.8-32.9-29-33.9-29s-22.3,17.1-33.9,29c-9.8,10.1-7.2,18.7-2.8,24.4,8.6,10.7,21.9,17.6,36.7,17.6h0Z"/>
    <path fill="url(#logo-grad)" d="M47.1,12c2.4,0,25.1,18.3,47.1,36.5v-1.4C94.2,21.1,73.1,0,47.1,0h0C21.1,0,0,21.1,0,47.1s0,.9,0,1.4C22,30.4,44.7,12.1,47.1,12.1h0Z"/>
    <path fill="#6e0e0f" opacity="0.4" d="M81,52.3c-11.5-11.8-32.9-29-33.9-29s-22.3,17.1-33.9,29c-3.5,3.6-5.4,6.9-6.2,10.1,1.1-2.2,2.8-4.6,5.5-7.1,11.8-10.7,33.6-26.2,34.6-26.2s22.8,15.5,34.6,26.2c2.6,2.4,4.4,4.7,5.5,6.9-.9-3.1-2.7-6.4-6.2-9.9Z"/>
    <g fill="#2b303a">
      <path d="M135.2,25l3.2,8.7h-6.3l3.2-8.7h0ZM147.4,43l-8.6-23.2h-7.2l-8.6,23.2h5.7l1.6-4.4h9.8l1.6,4.4h5.7Z"/>
      <path d="M157.1,38v-13.3h5.1c3.1,0,5.5,2.5,5.5,6.6s-2.4,6.8-5.5,6.8h-5.1ZM151.6,19.7v23.2h10.7c6.6,0,11-4.9,11-11.6s-4.4-11.6-11-11.6h-10.7Z"/>
      <path d="M190.1,24.6c1.7,0,3.1,1.3,3.1,2.9s-1.3,3-3.3,3h-5.8v-5.9h6ZM199.3,43l-5.6-8.3c3.1-1.3,4.7-4.1,4.7-7.1s-3.1-7.8-8.2-7.8h-11.6v23.2h5.4v-7.6h4l4.9,7.6h6.4Z"/>
      <rect x="204.2" y="19.7" width="5.6" height="23.2"/>
      <path d="M226.2,25l3.2,8.7h-6.3l3.2-8.7h-.1ZM238.4,43l-8.6-23.2h-7.2l-8.6,23.2h5.7l1.6-4.4h9.8l1.6,4.4h5.7Z"/>
      <polygon points="248.1 19.7 242.6 19.7 242.6 43 259 43 259 37.9 248.1 37.9 248.1 19.7"/>
      <path d="M279.5,38v-13.3h5.1c3.1,0,5.5,2.5,5.5,6.6s-2.4,6.8-5.5,6.8h-5.1ZM274,19.7v23.2h10.7c6.6,0,11-4.9,11-11.6s-4.4-11.6-11-11.6h-10.7Z"/>
      <polygon points="318.5 19.7 301 19.7 301 43 318.5 43 318.5 38 306.4 38 306.4 33.6 316.8 33.6 316.8 28.8 306.4 28.8 306.4 24.7 318.5 24.7 318.5 19.7"/>
      <path d="M332.8,43.4c5.7,0,9.6-3.2,9.6-7.3s-2.9-5.5-6.3-6.6l-5.1-1.7c-1.3-.4-1.9-1-1.9-1.8s1.3-1.9,3.2-1.9,4.1,1.1,4.7,2.8l5.1-1.5c-.9-3.4-4.4-6.1-9.6-6.1s-9,3.1-9,6.9,2.3,5.1,5.3,6.1l5.8,1.9c1.5.5,2.2,1.2,2.2,2.2s-1.4,2.2-3.6,2.2-5-1.7-5.6-3.9l-5.2,1.6c.9,3.7,4.2,7.1,10.5,7.1h-.1Z"/>
      <rect x="347.6" y="19.7" width="5.6" height="23.2"/>
      <path d="M382.8,29.8h-11.9v4.7h6.1c-.4,1.9-2.3,3.8-5.6,3.8-4.9,0-7.4-3.4-7.4-7s2.7-6.9,6.7-6.9,5,1.4,6.1,3.5l5.1-1.5c-1.4-3.9-5.4-7.2-11.3-7.2s-12.2,5.2-12.2,12.1,5.3,12.1,12.5,12.1,11.8-4.6,11.8-10.9v-2.8h0Z"/>
      <polygon points="403 33 392.6 19.7 388.1 19.7 388.1 43 393.6 43 393.6 29.7 404 43 408.5 43 408.5 19.7 403 19.7 403 33"/>
      <path d="M424.2,43.4c5.7,0,9.6-3.2,9.6-7.3s-2.9-5.5-6.3-6.6l-5.1-1.7c-1.3-.4-1.9-1-1.9-1.8s1.3-1.9,3.2-1.9,4.1,1.1,4.7,2.8l5.1-1.5c-.9-3.4-4.4-6.1-9.6-6.1s-9,3.1-9,6.9,2.3,5.1,5.3,6.1l5.8,1.9c1.5.5,2.2,1.2,2.2,2.2s-1.4,2.2-3.6,2.2-5-1.7-5.6-3.9l-5.2,1.6c.9,3.7,4.2,7.1,10.5,7.1h-.1Z"/>
    </g>
    <g fill="#9ca3af">
      <text x="122" y="77" fontSize="14" fontFamily="system-ui">Strategic Marketing & Design</text>
    </g>
  </svg>
)

const iconMap = { Palette, Layout: LayoutIcon, Smartphone, BarChart3, Shield, Zap, Megaphone, RefreshCw, PenTool }

// PIN Entry component for edit mode authentication
const PinEntry = ({ onSuccess }) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

      if (res.ok) {
        const data = await res.json()
        setAuthToken(data.token)
        onSuccess()
      } else {
        setError('Invalid password')
        setPin('')
      }
    } catch (err) {
      setError('Connection error')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 w-80">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-medium text-slate-900">Login</h2>
        </div>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter password"
          className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
        <button
          type="submit"
          disabled={pin.length < 1 || loading}
          className="w-full mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Checking...' : 'Login'}
        </button>
      </form>
    </div>
  )
}

// Simple markdown renderer for project specifics
const MarkdownContent = ({ content }) => {
  if (!content) return null

  const lines = content.split('\n')
  const elements = []
  let currentList = []
  let listKey = 0

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc list-outside ml-5 mb-4 space-y-1">
          {currentList.map((item, i) => (
            <li key={i} className="text-slate-600" dangerouslySetInnerHTML={{ __html: parseLine(item) }} />
          ))}
        </ul>
      )
      currentList = []
    }
  }

  const parseLine = (text) => {
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900 font-semibold">$1</strong>')
    text = text.replace(/__(.+?)__/g, '<strong class="text-slate-900 font-semibold">$1</strong>')
    return text
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      return
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(<h5 key={i} className="font-semibold text-slate-800 mt-6 mb-2">{trimmed.slice(4)}</h5>)
      return
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(<h4 key={i} className="font-bold text-slate-900 mt-6 mb-3 text-base">{trimmed.slice(3)}</h4>)
      return
    }
    if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(<h3 key={i} className="font-bold text-slate-900 mt-6 mb-3 text-lg">{trimmed.slice(2)}</h3>)
      return
    }

    // List items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      currentList.push(trimmed.slice(2))
      return
    }

    // Regular paragraph
    flushList()
    elements.push(
      <p key={i} className="text-slate-600 mb-3" dangerouslySetInnerHTML={{ __html: parseLine(trimmed) }} />
    )
  })

  flushList()
  return <>{elements}</>
}

// Editable text component
const EditableText = ({ value, onChange, tag: Tag = 'span', className = '' }) => {
  return (
    <Tag
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.target.innerText)}
      className={className}
    >
      {value}
    </Tag>
  )
}

// Line item row component for proposal editor
const LineItem = ({ phase, index, onUpdate, onDelete, onToggleOptional }) => {
  const lowTotal = phase.lowHrs * phase.rate
  const highTotal = phase.highHrs * phase.rate

  return (
    <tr className={`pricing-row group ${phase.optional ? 'opacity-60' : ''}`}>
      <td className="py-3 pr-6 align-top">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <EditableText
                value={phase.name}
                onChange={(val) => onUpdate(index, { ...phase, name: val })}
                tag="span"
                className="font-medium text-slate-900"
              />
              {phase.optional && (
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Optional</span>
              )}
            </div>
            <EditableText
              value={phase.description}
              onChange={(val) => onUpdate(index, { ...phase, description: val })}
              tag="p"
              className="text-slate-500 text-sm mt-1"
            />
          </div>
          <div className="no-print flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onToggleOptional(index)}
              className={`p-1 rounded text-xs ${phase.optional ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
              title={phase.optional ? 'Mark as required' : 'Mark as optional'}
            >
              Opt
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 rounded bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600"
              title="Delete phase"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </td>
      <td className="hidden sm:table-cell py-3 px-4 text-center text-sm text-slate-600 align-top whitespace-nowrap print:table-cell">
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate(index, { ...phase, lowHrs: parseFloat(e.target.innerText) || 0 })}
        >
          {phase.lowHrs}
        </span>
        –
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => onUpdate(index, { ...phase, highHrs: parseFloat(e.target.innerText) || 0 })}
        >
          {phase.highHrs}
        </span>
      </td>
      <td className="py-3 pl-4 text-right text-sm text-slate-600 align-top whitespace-nowrap">
        ${lowTotal.toLocaleString()}–${highTotal.toLocaleString()}
      </td>
    </tr>
  )
}

// Main Proposal Editor component
function Editor({ proposal: initialProposal, onSave, templates, isViewMode }) {
  const navigate = useNavigate()
  const [data, setData] = useState(initialProposal)
  const [copiedLink, setCopiedLink] = useState(false)
  const [versions, setVersions] = useState([])
  const [showVersions, setShowVersions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [versionError, setVersionError] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null) // {title, message, onConfirm, danger, confirmText}

  useEffect(() => {
    if (data?.id && !isViewMode) {
      loadVersions()
    }
  }, [data?.id, isViewMode])

  const loadVersions = async () => {
    setLoadingVersions(true)
    try {
      const res = await authFetch(`${API_BASE}/proposals/${data.id}/versions`)
      if (res.ok) {
        const versionsData = await res.json()
        setVersions(versionsData)
      }
    } catch (err) {
      console.error('Failed to load versions:', err)
    }
    setLoadingVersions(false)
  }

  const saveVersion = async (name) => {
    const versionName = name || `Version ${versions.length + 1}`
    setSaving(true)
    setVersionError(null)
    try {
      const res = await authFetch(`${API_BASE}/proposals/${data.id}/versions`, {
        method: 'POST',
        body: JSON.stringify({ versionName })
      })
      if (res.ok) {
        await loadVersions()
        setShowVersionModal(false)
        setVersionError(null)
      } else {
        const errorData = await res.json().catch(() => ({}))
        setVersionError(errorData.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      console.error('Failed to save version:', err)
      setVersionError('Network error - check your connection')
    }
    setSaving(false)
  }

  const restoreVersion = (filename) => {
    setConfirmModal({
      title: 'Restore Version',
      message: 'Restore this version? Current changes will be overwritten.',
      confirmText: 'Restore',
      danger: false,
      onConfirm: async () => {
        try {
          const res = await authFetch(`${API_BASE}/proposals/${data.id}/versions/${filename}/restore`, {
            method: 'POST'
          })
          if (res.ok) {
            const restored = await res.json()
            setData(restored)
          }
        } catch (err) {
          console.error('Failed to restore version:', err)
        }
        setShowVersions(false)
      }
    })
  }

  const deleteVersion = (filename, e) => {
    e.stopPropagation()
    setConfirmModal({
      title: 'Delete Version',
      message: 'Delete this version? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await authFetch(`${API_BASE}/proposals/${data.id}/versions/${filename}`, {
            method: 'DELETE'
          })
          if (res.ok) {
            await loadVersions()
          }
        } catch (err) {
          console.error('Failed to delete version:', err)
        }
      }
    })
  }

  // Auto-save debounce
  useEffect(() => {
    if (isViewMode || !data || !onSave) return
    const timer = setTimeout(() => onSave(data), 500)
    return () => clearTimeout(timer)
  }, [data, onSave, isViewMode])

  const updateField = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }))
  }, [])

  const updatePhase = useCallback((index, updatedPhase) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === index ? updatedPhase : p)
    }))
  }, [])

  const addPhase = useCallback(() => {
    setData(prev => ({
      ...prev,
      phases: [...prev.phases, {
        name: 'New Phase',
        description: 'Description of this phase.',
        lowHrs: 10,
        highHrs: 15,
        rate: 120,
        optional: false
      }]
    }))
  }, [])

  const deletePhase = useCallback((index) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index)
    }))
  }, [])

  const toggleOptional = useCallback((index) => {
    setData(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) =>
        i === index ? { ...p, optional: !p.optional } : p
      )
    }))
  }, [])

  const handleCopyLink = async () => {
    const baseUrl = window.location.origin
    const viewUrl = `${baseUrl}/${data.id}?view=1`
    await navigator.clipboard.writeText(viewUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (!data) return null

  const template = templates[data.projectType] || templates['web'] || {}
  const benefits = data.benefits || template.benefits || []
  const upsells = data.upsells || template.upsells || []

  const requiredPhases = data.phases?.filter(p => !p.optional) || []
  const optionalPhases = data.phases?.filter(p => p.optional) || []

  const subtotal = requiredPhases.reduce(
    (acc, phase) => ({
      lowHrs: acc.lowHrs + phase.lowHrs,
      highHrs: acc.highHrs + phase.highHrs,
      lowTotal: acc.lowTotal + (phase.lowHrs * phase.rate),
      highTotal: acc.highTotal + (phase.highHrs * phase.rate)
    }),
    { lowHrs: 0, highHrs: 0, lowTotal: 0, highTotal: 0 }
  )

  const discount = data.discountPercent || 0
  const totals = {
    ...subtotal,
    lowTotal: subtotal.lowTotal * (1 - discount / 100),
    highTotal: subtotal.highTotal * (1 - discount / 100)
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 print:bg-white print:py-0">
      {/* Toolbar for view mode - Download PDF button */}
      {isViewMode && (
        <div className="no-print fixed top-4 right-4 flex items-center gap-2 z-50">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800 shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      )}

      {/* Toolbar - not shown in view mode */}
      {!isViewMode && (
        <div className="no-print fixed top-4 right-4 flex items-center gap-2 z-50">
          {/* Version History */}
          <div className="relative">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 shadow-sm"
            >
              <History className="w-4 h-4" />
              History
              <ChevronDown className={`w-3 h-3 transition-transform ${showVersions ? 'rotate-180' : ''}`} />
            </button>

            {showVersions && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
                <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Versions</span>
                  <button
                    onClick={() => { setVersionError(null); setShowVersionModal(true) }}
                    className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded hover:bg-slate-200"
                  >
                    + Save New
                  </button>
                </div>
                {loadingVersions ? (
                  <p className="p-3 text-sm text-slate-400">Loading...</p>
                ) : versions.length === 0 ? (
                  <p className="p-3 text-sm text-slate-400">No versions saved</p>
                ) : (
                  versions.map(v => (
                    <div
                      key={v.filename}
                      className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2 group"
                    >
                      <button
                        onClick={() => restoreVersion(v.filename)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        title="Restore this version"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 truncate">{v.versionName || v.filename}</p>
                          <p className="text-xs text-slate-400">
                            {v.createdAt ? new Date(v.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : (v.date || 'Unknown date')}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => deleteVersion(v.filename, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 text-slate-400 transition-opacity"
                        title="Delete this version"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <LinkIcon className="w-4 h-4" />}
            {copiedLink ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded text-sm hover:bg-slate-800 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      )}

      {/* Back button - only in edit mode */}
      {!isViewMode && (
        <div className="no-print max-w-[8.5in] mx-auto mb-4 px-4">
          <Link
            to="/proposals"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Proposals
          </Link>
        </div>
      )}

      {/* Internal Notes - only in edit mode */}
      {!isViewMode && (
        <div className="no-print max-w-[8.5in] mx-auto mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-amber-700 uppercase">Internal Notes</span>
              {discount > 0 && (
                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                  <Percent className="w-3 h-3" /> {discount}% discount
                </span>
              )}
            </div>
          </div>
          <textarea
            value={data.internalNotes || ''}
            onChange={(e) => updateField('internalNotes', e.target.value)}
            placeholder="Add internal notes here (won't print)..."
            className="w-full mt-2 text-sm text-amber-900 bg-transparent border-none resize-none focus:outline-none"
            rows={2}
          />
        </div>
      )}

      {/* Document */}
      <div className="print-page mx-auto bg-white shadow-sm px-4 py-8 sm:p-[0.6in] print:p-[0.6in] print:shadow-none">
        {/* Header */}
        <header className="flex flex-col items-start sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 mb-12">
          <Logo />
          <div className="text-left sm:text-right text-sm text-slate-500">
            <p>{data.contactInfo?.email || 'adrial@adrialdesigns.com'}</p>
            <p>{data.contactInfo?.phone || '(919) 968-8818'}</p>
          </div>
        </header>

        {/* Title Block */}
        <div className="mb-10">
          {isViewMode ? (
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">{data.projectName}</h1>
          ) : (
            <EditableText
              value={data.projectName}
              onChange={(val) => updateField('projectName', val)}
              tag="h1"
              className="text-3xl font-semibold text-slate-900 tracking-tight"
            />
          )}
          <div className="flex gap-4 mt-2 text-sm text-slate-400">
            {isViewMode ? (
              <span>{data.date}</span>
            ) : (
              <EditableText
                value={data.date}
                onChange={(val) => updateField('date', val)}
                tag="span"
              />
            )}
            {data.expirationDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Valid until {data.expirationDate}
              </span>
            )}
          </div>

          {/* Client Details */}
          <div className="mt-6">
            <p className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-2">Proposal For</p>
            {isViewMode ? (
              <>
                <p className="text-lg text-slate-900">{data.clientName}</p>
                {data.clientRole && <p className="text-slate-600">{data.clientRole}</p>}
                {data.clientCompany && <p className="text-slate-500 text-sm mt-1">{data.clientCompany}</p>}
              </>
            ) : (
              <>
                <EditableText
                  value={data.clientName}
                  onChange={(val) => updateField('clientName', val)}
                  tag="p"
                  className="text-lg text-slate-900"
                />
                {data.clientRole && (
                  <EditableText
                    value={data.clientRole}
                    onChange={(val) => updateField('clientRole', val)}
                    tag="p"
                    className="text-slate-600"
                  />
                )}
                {data.clientCompany && (
                  <EditableText
                    value={data.clientCompany}
                    onChange={(val) => updateField('clientCompany', val)}
                    tag="p"
                    className="text-slate-500 text-sm mt-1"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Overview */}
        <div className="mb-8 w-full md:w-[60%] print:w-[60%]">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-3">Overview</h3>
          {isViewMode ? (
            <p className="text-slate-600 leading-relaxed">{data.projectDescription}</p>
          ) : (
            <EditableText
              value={data.projectDescription}
              onChange={(val) => updateField('projectDescription', val)}
              tag="p"
              className="text-slate-600 leading-relaxed"
            />
          )}
        </div>

        {/* Benefits Grid */}
        {benefits.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-1">What's Included</h3>
            <p className="text-sm text-slate-400 mb-4">Here's what you'll get with this project.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3">
              {benefits.map((benefit, i) => {
                const Icon = iconMap[benefit.icon]
                return (
                  <div key={i} className="flex gap-3">
                    {Icon && <Icon className="w-5 h-5 text-[#d72027] shrink-0 mt-0.5" strokeWidth={1.5} />}
                    <div>
                      <div className="font-medium text-slate-900">{benefit.title}</div>
                      <div className="text-slate-500 text-sm">{benefit.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Estimate */}
        <div className="mb-12">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-4">Estimate</h3>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-sm font-medium text-slate-400">Phase</th>
                <th className="hidden sm:table-cell text-center py-2 text-sm font-medium text-slate-400 w-24 print:table-cell">Hours</th>
                <th className="text-right py-2 text-sm font-medium text-slate-400 w-28 sm:w-44">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isViewMode ? (
                // View mode - read only
                data.phases?.map((phase, i) => {
                  const lowTotal = phase.lowHrs * phase.rate
                  const highTotal = phase.highHrs * phase.rate
                  return (
                    <tr key={i} className={phase.optional ? 'opacity-60' : ''}>
                      <td className="py-3 pr-6 align-top">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{phase.name}</span>
                          {phase.optional && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Optional</span>}
                        </div>
                        <p className="text-slate-500 text-sm mt-1">{phase.description}</p>
                      </td>
                      <td className="hidden sm:table-cell py-3 px-4 text-center text-sm text-slate-600 align-top whitespace-nowrap print:table-cell">
                        {phase.lowHrs}–{phase.highHrs}
                      </td>
                      <td className="py-3 pl-4 text-right text-sm text-slate-600 align-top whitespace-nowrap">
                        ${lowTotal.toLocaleString()}–${highTotal.toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              ) : (
                // Edit mode - editable
                data.phases?.map((phase, i) => (
                  <LineItem
                    key={i}
                    phase={phase}
                    index={i}
                    onUpdate={updatePhase}
                    onDelete={deletePhase}
                    onToggleOptional={toggleOptional}
                  />
                ))
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t border-slate-300 mt-0">
            <table className="w-full">
              <tbody>
                {discount > 0 && (
                  <>
                    <tr>
                      <td className="py-2 text-sm text-slate-500">Subtotal</td>
                      <td className="hidden sm:table-cell w-24 print:table-cell"></td>
                      <td className="py-2 text-right text-sm text-slate-500 whitespace-nowrap w-28 sm:w-44">
                        ${subtotal.lowTotal.toLocaleString()}–${subtotal.highTotal.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-sm text-green-600">Discount ({discount}%)</td>
                      <td className="hidden sm:table-cell print:table-cell"></td>
                      <td className="py-2 text-right text-sm text-green-600 whitespace-nowrap">
                        -${(subtotal.lowTotal * discount / 100).toLocaleString()}–${(subtotal.highTotal * discount / 100).toLocaleString()}
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td className="py-4 font-medium text-slate-900">Total</td>
                  <td className="hidden sm:table-cell py-4 text-center text-sm text-slate-600 print:table-cell">
                    {totals.lowHrs}–{totals.highHrs} hrs
                  </td>
                  <td className="py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                    ${totals.lowTotal.toLocaleString()}–${totals.highTotal.toLocaleString()}
                  </td>
                </tr>
                {optionalPhases.length > 0 && (
                  <tr>
                    <td className="pb-2 text-sm text-slate-500">With optional phases</td>
                    <td className="hidden sm:table-cell print:table-cell"></td>
                    <td className="pb-2 text-right text-sm text-slate-500 whitespace-nowrap">
                      ${(totals.lowTotal + optionalPhases.reduce((a, p) => a + p.lowHrs * p.rate, 0) * (1 - discount / 100)).toLocaleString()}–${(totals.highTotal + optionalPhases.reduce((a, p) => a + p.highHrs * p.rate, 0) * (1 - discount / 100)).toLocaleString()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start mt-4">
            <div className="text-sm text-slate-400">
              <p>Rate: ${data.phases?.[0]?.rate || 120}/hr</p>
            </div>
            {!isViewMode && (
              <button
                onClick={addPhase}
                className="no-print flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <Plus className="w-4 h-4" /> Add phase
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="mb-8">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-3">Estimated Timeline</h3>
          {isViewMode ? (
            <p className="text-slate-600">{data.estimatedTimeline || 'Timeline to be determined based on project start date.'}</p>
          ) : (
            <EditableText
              value={data.estimatedTimeline || 'Timeline to be determined based on project start date.'}
              onChange={(val) => updateField('estimatedTimeline', val)}
              tag="p"
              className="text-slate-600"
            />
          )}
        </div>

        {/* Upsells */}
        {upsells.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-1">Also Available</h3>
            <p className="text-sm text-slate-400 mb-4">These services are not included in this estimate but can be added upon request.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-3">
              {upsells.map((upsell, i) => {
                const Icon = iconMap[upsell.icon]
                return (
                  <div key={i} className="border border-slate-200 rounded-lg p-4">
                    {Icon && <Icon className="w-5 h-5 text-[#d72027] mb-2" strokeWidth={1.5} />}
                    <div className="font-medium text-slate-900 mb-1">{upsell.title}</div>
                    <div className="text-slate-500 text-sm">{upsell.description}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Project Specifics */}
        {data.projectSpecifics && (
          <div className="mb-12">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-4">Project Specifics</h3>
            <div className="prose prose-slate prose-sm max-w-none">
              <MarkdownContent content={data.projectSpecifics} />
            </div>
          </div>
        )}

        {/* Exclusions */}
        {data.exclusions && (
          <div className="mb-12">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#bb2225] mb-4">What Is Not Included</h3>
            <div className="prose prose-slate prose-sm max-w-none">
              <MarkdownContent content={data.exclusions} />
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="pt-12 border-t border-slate-100 text-sm text-slate-400">
          {data.contactInfo?.website || 'www.adrialdesigns.com'}
        </footer>
      </div>

      {/* Instructions */}
      {!isViewMode && (
        <p className="no-print text-center text-sm text-slate-400 mt-8">
          Click any text to edit · Auto-saves every second
        </p>
      )}

      {/* Version Save Modal */}
      <VersionModal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        onSave={saveVersion}
        saving={saving}
        error={versionError}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => {
          confirmModal?.onConfirm()
          setConfirmModal(null)
        }}
        title={confirmModal?.title || 'Confirm'}
        message={confirmModal?.message || 'Are you sure?'}
        confirmText={confirmModal?.confirmText || 'Confirm'}
        danger={confirmModal?.danger || false}
      />
    </div>
  )
}

// Editor Page (loads proposal from URL - standalone, no layout)
function EditorPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isViewMode = searchParams.get('view') === '1'
  const [proposal, setProposal] = useState(null)
  const [templates, setTemplates] = useState({})
  const [loading, setLoading] = useState(true)
  const [needsAuth, setNeedsAuth] = useState(false)

  // Add noindex meta tag for proposal pages (don't index client proposals)
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  // Check auth for edit mode - must happen before data fetch
  const authChecked = !isViewMode ? isAuthenticated() : true

  useEffect(() => {
    if (!isViewMode && !isAuthenticated()) {
      setNeedsAuth(true)
      setLoading(false)
    }
  }, [isViewMode])

  useEffect(() => {
    // Don't fetch if auth is needed but user isn't authenticated
    if (!isViewMode && !authChecked) {
      return
    }

    // For public view mode, add ?view=1 to bypass auth on server
    const viewParam = isViewMode ? '?view=1' : ''
    const fetchFn = isViewMode ? fetch : authFetch

    Promise.all([
      fetchFn(`${API_BASE}/proposals/${id}${viewParam}`).then(r => r.json()),
      fetchFn(`${API_BASE}/templates${viewParam}`).then(r => r.json())
    ])
      .then(([proposalData, templatesData]) => {
        setProposal(proposalData)
        const templatesMap = {}
        if (Array.isArray(templatesData)) {
          templatesData.forEach(t => { templatesMap[t.type] = t })
        }
        setTemplates(templatesMap)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load proposal:', err)
        setLoading(false)
      })
  }, [id, isViewMode, authChecked])

  const saveProposal = async (updatedProposal) => {
    // Don't save in view mode or if not authenticated
    if (isViewMode || !isAuthenticated()) return
    await authFetch(`${API_BASE}/proposals/${updatedProposal.id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedProposal)
    })
  }

  // Show PIN entry if trying to edit without auth - check FIRST
  if (needsAuth) {
    return <PinEntry onSuccess={() => setNeedsAuth(false)} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Proposal not found</p>
      </div>
    )
  }

  return <Editor proposal={proposal} onSave={saveProposal} templates={templates} isViewMode={isViewMode} />
}

// Protected Layout wrapper - requires PIN authentication
function ProtectedLayout() {
  const [needsAuth, setNeedsAuth] = useState(!isAuthenticated())

  if (needsAuth) {
    return <PinEntry onSuccess={() => setNeedsAuth(false)} />
  }

  return <Layout />
}

// Backwards compatibility redirects for old OS-Beta URLs
function OsBetaRedirect() {
  const location = useLocation()
  const path = location.pathname.replace('/dashboard/os-beta', '') || '/'

  // Map old paths to new paths
  const pathMapping = {
    '': '/',
    '/': '/',
    '/proposals': '/proposals',
    '/projects': '/projects',
    '/hosting': '/hosting',
    '/time': '/time',
    '/invoices': '/invoices',
    '/schedule': '/schedule',
    '/timeline': '/timeline',
    '/feedback': '/feedback',
    '/search': '/search',
  }

  // Check for exact matches first
  if (pathMapping[path]) {
    return <Navigate to={pathMapping[path] + location.search} replace />
  }

  // Handle dynamic routes
  if (path.startsWith('/projects/')) {
    return <Navigate to={path + location.search} replace />
  }
  if (path.startsWith('/proposals/')) {
    return <Navigate to={path + location.search} replace />
  }

  // Default redirect to dashboard
  return <Navigate to="/" replace />
}

// Main App with Router
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public proposal view - no auth required */}
        <Route path="/:id" element={<EditorPage />} />

        {/* Backwards compatibility redirects for old OS-Beta URLs */}
        <Route path="/dashboard/os-beta/*" element={<OsBetaRedirect />} />

        {/* Protected routes with unified layout */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/proposals/:id" element={<EditorPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailsPage />} />
          <Route path="/hosting" element={<HostingPage />} />
          <Route path="/time" element={<TimePage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/timeline" element={<MasterTimelinePage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

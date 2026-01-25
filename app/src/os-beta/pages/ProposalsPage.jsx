import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, ArrowRight, Check, Clock, AlertCircle } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

function formatMoney(cents) {
  if (!cents) return '$0'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700'
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${styles[status] || styles.draft}`}>
      {status || 'draft'}
    </span>
  )
}

function ProposalCard({ proposal, onConvert }) {
  const [converting, setConverting] = useState(false)
  const rate = 120 // $120/hr

  const handleConvert = async () => {
    if (!confirm(`Convert "${proposal.projectName}" to a project?\n\nThis will create a project and break the phases into schedulable chunks.`)) {
      return
    }
    setConverting(true)
    try {
      await onConvert(proposal.id)
    } finally {
      setConverting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 truncate">{proposal.projectName}</h3>
            <StatusBadge status={proposal.status} />
          </div>
          <p className="text-sm text-slate-500 truncate">{proposal.clientName}</p>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
            <span>{proposal.totalLowHrs}-{proposal.totalHighHrs} hrs</span>
            <span>{formatMoney(proposal.totalLowHrs * rate * 100)} - {formatMoney(proposal.totalHighHrs * rate * 100)}</span>
            <span>{proposal.phases?.length || 0} phases</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {proposal.status === 'accepted' ? (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="w-4 h-4" />
              Converted
            </span>
          ) : (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red/90 disabled:opacity-50 transition-colors"
            >
              {converting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  Convert to Project
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Phase preview */}
      {proposal.phases && proposal.phases.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Phases</p>
          <div className="flex flex-wrap gap-2">
            {proposal.phases.slice(0, 5).map((phase, i) => (
              <span
                key={i}
                className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded"
              >
                {phase.name} ({phase.lowHrs}-{phase.highHrs}h)
              </span>
            ))}
            {proposal.phases.length > 5 && (
              <span className="text-xs px-2 py-1 text-slate-400">
                +{proposal.phases.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all') // all, draft, sent, accepted
  const navigate = useNavigate()

  useEffect(() => {
    loadProposals()
  }, [])

  const loadProposals = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/proposals`)
      if (!res.ok) throw new Error('Failed to load proposals')
      const data = await res.json()
      setProposals(data)
    } catch (err) {
      console.error('Failed to load proposals:', err)
      setError(err.message)
    }
    setLoading(false)
  }

  const handleConvert = async (proposalId) => {
    try {
      const res = await fetch(`${API_BASE}/proposals/${proposalId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.projectId) {
          // Project already exists, navigate to it
          navigate(`/dashboard/os-beta/projects/${data.projectId}`)
          return
        }
        throw new Error(data.error)
      }
      // Navigate to the new project
      navigate(`/dashboard/os-beta/projects/${data.project.id}`)
    } catch (err) {
      alert(`Failed to convert: ${err.message}`)
    }
  }

  const filteredProposals = proposals.filter(p => {
    if (filter === 'all') return true
    return p.status === filter
  })

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Loading proposals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proposals</h1>
          <p className="text-slate-500 text-sm">Convert accepted proposals to projects</p>
        </div>
      </div>

      {/* Claude Code tip */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Claude Code tip:</span>{' '}
          Ask Claude to convert a proposal and schedule it. Try:
        </p>
        <code className="block mt-2 text-xs bg-slate-100 text-slate-700 p-2 rounded font-mono">
          "Convert the Water Institute proposal to a project, chunk it out, and schedule it on my calendar for next week"
        </code>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'draft', 'sent', 'accepted'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === f
                ? 'bg-brand-red/10 text-brand-red border border-brand-red'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-1 text-xs">
                ({proposals.filter(p => p.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Proposals list */}
      {filteredProposals.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500">No proposals found</p>
          <p className="text-sm text-slate-400 mt-1">
            Create proposals in the main app, then convert them here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onConvert={handleConvert}
            />
          ))}
        </div>
      )}
    </div>
  )
}

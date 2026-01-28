import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Trash2, ArrowRight, ExternalLink, Copy, Check, FolderPlus } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700'
  }
  return (
    <span className={`text-xs px-2 py-1 rounded ${styles[status] || styles.draft}`}>
      {status || 'draft'}
    </span>
  )
}

function ProposalCard({ proposal, project, onDelete, onConvert }) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const viewUrl = `${window.location.origin}/${proposal.id}?view=1`
    try {
      await navigator.clipboard.writeText(viewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 group">
      <div className="flex justify-between items-start">
        <Link
          to={`/proposals/${proposal.id}`}
          className="min-w-0 flex-1 cursor-pointer"
        >
          <h3 className="font-medium text-slate-900 truncate">{proposal.projectName}</h3>
          <p className="text-sm text-slate-500 truncate">{proposal.clientName}</p>
          {proposal.clientCompany && (
            <p className="text-xs text-slate-400 truncate">{proposal.clientCompany}</p>
          )}
        </Link>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <StatusBadge status={proposal.status} />
          <span className="text-sm text-slate-400 hidden sm:block">{proposal.date || proposal.createdAt}</span>

          {/* Copy link button */}
          <button
            onClick={handleCopyLink}
            className={`p-2 rounded text-xs flex items-center gap-1 transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            title="Copy client view link"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* View client link */}
          <a
            href={`/${proposal.id}?view=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
            title="Open client view"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Convert to Project button (if no linked project) */}
          {!project && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onConvert(proposal)
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
              title="Convert to project"
            >
              <FolderPlus className="w-3 h-3" />
              <span className="hidden sm:inline">Convert</span>
            </button>
          )}

          {/* View Project button (if linked project exists) */}
          {project && (
            <Link
              to={`/projects/${project.id}`}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
              title="View project"
            >
              <span className="hidden sm:inline">Project</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(proposal)
            }}
            className="p-2 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 text-slate-400 transition-opacity min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProposalsPage() {
  const navigate = useNavigate()
  const [proposals, setProposals] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [converting, setConverting] = useState(false)

  useEffect(() => {
    loadProposals()
  }, [])

  const loadProposals = async () => {
    setLoading(true)
    try {
      const [proposalsRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE}/proposals`),
        fetch(`${API_BASE}/projects`)
      ])
      const proposalsData = await proposalsRes.json()
      const projectsData = await projectsRes.json()
      setProposals(proposalsData)
      setProjects(projectsData)
    } catch (err) {
      console.error('Failed to load proposals:', err)
    }
    setLoading(false)
  }

  // Find project that was converted from a proposal
  const getProjectForProposal = (proposalId) => {
    return projects.find(p => p.proposal_id === proposalId)
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try {
      await fetch(`${API_BASE}/proposals/${deleteConfirm.id}`, { method: 'DELETE' })
      setProposals(prev => prev.filter(p => p.id !== deleteConfirm.id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleConvert = async (proposal) => {
    if (converting) return
    setConverting(true)
    try {
      const res = await fetch(`${API_BASE}/proposals/${proposal.id}/convert`, {
        method: 'POST'
      })
      if (res.ok) {
        const project = await res.json()
        navigate(`/projects/${project.id}`)
      } else {
        console.error('Failed to convert proposal')
      }
    } catch (err) {
      console.error('Failed to convert:', err)
    }
    setConverting(false)
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Loading proposals...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Proposals</h1>
          <p className="text-slate-500 text-sm">Click any proposal to edit</p>
        </div>
      </div>

      {/* Claude Code tip */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Claude Code tip:</span>{' '}
          Drop client documents into <code className="bg-slate-100 px-1 rounded">/input</code> and ask Claude to create a proposal.
        </p>
      </div>

      {/* Proposals List */}
      {proposals.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No proposals yet.</p>
          <p className="text-sm mt-1">Create proposals using Claude Code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              project={getProjectForProposal(p.id)}
              onDelete={setDeleteConfirm}
              onConvert={handleConvert}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Proposal"
        message={`Delete "${deleteConfirm?.projectName}"?\n\nThis cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  )
}

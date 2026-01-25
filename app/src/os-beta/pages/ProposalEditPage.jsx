import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Check, AlertCircle, Plus, Trash2, GripVertical } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

function formatMoney(cents) {
  if (!cents) return '$0'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`
}

export default function ProposalEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [proposal, setProposal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadProposal()
  }, [id])

  const loadProposal = async () => {
    try {
      const res = await fetch(`${API_BASE}/proposals/${id}`)
      if (!res.ok) throw new Error('Proposal not found')
      const data = await res.json()
      setProposal(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`${API_BASE}/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal)
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
    setSaving(false)
  }

  const handleDelete = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    try {
      const res = await fetch(`${API_BASE}/proposals/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server responded with ${res.status}`)
      }
      navigate('/dashboard/os-beta/proposals')
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete: ' + err.message)
    }
  }

  const updateField = useCallback((field, value) => {
    setProposal(prev => ({ ...prev, [field]: value }))
  }, [])

  const updatePhase = useCallback((index, field, value) => {
    setProposal(prev => ({
      ...prev,
      phases: prev.phases.map((p, i) => i === index ? { ...p, [field]: value } : p)
    }))
  }, [])

  const addPhase = useCallback(() => {
    setProposal(prev => ({
      ...prev,
      phases: [...prev.phases, {
        name: 'New Phase',
        description: 'Description of this phase.',
        lowHrs: 8,
        highHrs: 12,
        rate: 120,
        optional: false
      }]
    }))
  }, [])

  const removePhase = useCallback((index) => {
    if (!confirm('Remove this phase?')) return
    setProposal(prev => ({
      ...prev,
      phases: prev.phases.filter((_, i) => i !== index)
    }))
  }, [])

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Loading proposal...</p>
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
        <Link
          to="/dashboard/os-beta/proposals"
          className="mt-4 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Proposals
        </Link>
      </div>
    )
  }

  const rate = 120
  const totalLow = proposal.phases?.reduce((sum, p) => sum + (p.optional ? 0 : p.lowHrs), 0) || 0
  const totalHigh = proposal.phases?.reduce((sum, p) => sum + (p.optional ? 0 : p.highHrs), 0) || 0
  const discount = proposal.discountPercent || 0
  const subtotalLow = totalLow * rate
  const subtotalHigh = totalHigh * rate
  const finalLow = subtotalLow * (1 - discount / 100)
  const finalHigh = subtotalHigh * (1 - discount / 100)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard/os-beta/proposals"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Proposal</h1>
            <p className="text-sm text-slate-500">Changes are saved to OS Beta only (not live)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-slate text-white rounded-lg hover:bg-brand-slate/90 disabled:opacity-50"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : saving ? (
              'Saving...'
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Firewalled Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>Sandbox Mode:</strong> This proposal is isolated from your live proposal system.
          Changes here won't affect your production proposals.
        </p>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
            <input
              type="text"
              value={proposal.projectName || ''}
              onChange={(e) => updateField('projectName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
            <input
              type="text"
              value={proposal.clientName || ''}
              onChange={(e) => updateField('clientName', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Company</label>
            <input
              type="text"
              value={proposal.clientCompany || ''}
              onChange={(e) => updateField('clientCompany', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={proposal.status || 'draft'}
              onChange={(e) => updateField('status', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Project Description</label>
            <textarea
              value={proposal.projectDescription || ''}
              onChange={(e) => updateField('projectDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount %</label>
            <input
              type="number"
              value={proposal.discountPercent || 0}
              onChange={(e) => updateField('discountPercent', parseInt(e.target.value) || 0)}
              min="0"
              max="100"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Fee</label>
            <input
              type="number"
              value={proposal.monthlyFee || 0}
              onChange={(e) => updateField('monthlyFee', parseInt(e.target.value) || 0)}
              min="0"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-red"
            />
          </div>
        </div>
      </div>

      {/* Phases */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Phases</h2>
          <button
            onClick={addPhase}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            <Plus className="w-4 h-4" />
            Add Phase
          </button>
        </div>

        <div className="space-y-4">
          {proposal.phases?.map((phase, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4 relative group">
              <button
                onClick={() => removePhase(index)}
                className="absolute top-2 right-2 p-1.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phase Name</label>
                  <input
                    type="text"
                    value={phase.name}
                    onChange={(e) => updatePhase(index, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Low Hours</label>
                    <input
                      type="number"
                      value={phase.lowHrs}
                      onChange={(e) => updatePhase(index, 'lowHrs', parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">High Hours</label>
                    <input
                      type="number"
                      value={phase.highHrs}
                      onChange={(e) => updatePhase(index, 'highHrs', parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={phase.optional || false}
                      onChange={(e) => updatePhase(index, 'optional', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-500">Optional</span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                  <textarea
                    value={phase.description}
                    onChange={(e) => updatePhase(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-red"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Total Hours (required phases)</span>
            <span className="font-medium">{totalLow}-{totalHigh} hrs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal @ ${rate}/hr</span>
            <span className="font-medium">{formatMoney(subtotalLow * 100)} - {formatMoney(subtotalHigh * 100)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount ({discount}%)</span>
              <span>-{formatMoney(subtotalLow * discount)} - -{formatMoney(subtotalHigh * discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-slate-300">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="font-bold text-lg">{formatMoney(finalLow * 100)} - {formatMoney(finalHigh * 100)}</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Proposal"
        message={`Delete "${proposal?.projectName}"?\n\nThis cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  )
}

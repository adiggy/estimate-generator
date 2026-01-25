import { useState, useEffect } from 'react'
import { Plus, FileText, Send, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-700'
}

const STATUS_ICONS = {
  draft: FileText,
  sent: Send,
  paid: CheckCircle,
  void: XCircle
}

function formatMoney(cents) {
  if (!cents) return '$0.00'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function InvoiceRow({ invoice, onUpdate }) {
  const StatusIcon = STATUS_ICONS[invoice.status] || FileText

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      const updated = await res.json()
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update invoice:', err)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${
              invoice.status === 'paid' ? 'text-green-500' :
              invoice.status === 'sent' ? 'text-yellow-500' :
              invoice.status === 'void' ? 'text-red-500' :
              'text-slate-400'
            }`} />
            <span className="font-mono text-sm text-slate-500">{invoice.id}</span>
          </div>
          <p className="font-medium text-slate-900 mt-1">{invoice.client_id}</p>
          <p className="text-sm text-slate-500">{formatDate(invoice.created_at)}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-slate-900">{formatMoney(invoice.total)}</p>
          <select
            value={invoice.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className={`mt-2 text-xs px-2 py-1 rounded ${STATUS_STYLES[invoice.status]}`}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>
      </div>

      {/* Line items preview */}
      {invoice.line_items && invoice.line_items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">
            {invoice.line_items.length} line item{invoice.line_items.length !== 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {invoice.line_items.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600 truncate">{item.description}</span>
                <span className="text-slate-500">{formatMoney(item.amount)}</span>
              </div>
            ))}
            {invoice.line_items.length > 3 && (
              <p className="text-xs text-slate-400">
                +{invoice.line_items.length - 3} more
              </p>
            )}
          </div>
        </div>
      )}

      {invoice.stripe_invoice_url && (
        <a
          href={invoice.stripe_invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3"
        >
          <ExternalLink className="w-4 h-4" />
          View in Stripe
        </a>
      )}
    </div>
  )
}

// Modal for selecting time entries to invoice
function CreateInvoiceModal({ isOpen, onClose, projects, onCreateInvoice }) {
  const [selectedProject, setSelectedProject] = useState('')
  const [unbilledData, setUnbilledData] = useState(null)
  const [selectedLogs, setSelectedLogs] = useState(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (selectedProject) {
      loadUnbilled()
    } else {
      setUnbilledData(null)
      setSelectedLogs(new Set())
    }
  }, [selectedProject])

  const loadUnbilled = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/time-logs?project_id=${selectedProject}&invoiced=false`)
      const data = await res.json()
      setUnbilledData(data)
      // Select all by default
      setSelectedLogs(new Set(data.logs.map(l => l.id)))
    } catch (err) {
      console.error('Failed to load unbilled time:', err)
    }
    setLoading(false)
  }

  const toggleLog = (logId) => {
    const newSelected = new Set(selectedLogs)
    if (newSelected.has(logId)) {
      newSelected.delete(logId)
    } else {
      newSelected.add(logId)
    }
    setSelectedLogs(newSelected)
  }

  const handleCreate = async () => {
    if (!selectedProject || selectedLogs.size === 0) return

    const project = projects.find(p => p.id === selectedProject)
    const selectedLogsArray = unbilledData.logs.filter(l => selectedLogs.has(l.id))

    // Build line items
    const lineItems = selectedLogsArray.map(log => {
      const rate = log.rate || log.project_rate || 12000
      const hours = log.duration_minutes / 60
      return {
        time_log_id: log.id,
        description: log.description || 'Work session',
        date: new Date(log.started_at).toISOString().split('T')[0],
        quantity: parseFloat(hours.toFixed(2)),
        rate,
        amount: Math.round(hours * rate)
      }
    })

    const total = lineItems.reduce((sum, item) => sum + item.amount, 0)

    try {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: project.client_id,
          subtotal: total,
          total,
          line_items: lineItems,
          time_log_ids: Array.from(selectedLogs)
        })
      })
      const newInvoice = await res.json()
      onCreateInvoice(newInvoice)
      onClose()
    } catch (err) {
      console.error('Failed to create invoice:', err)
    }
  }

  if (!isOpen) return null

  const selectedTotal = unbilledData?.logs
    .filter(l => selectedLogs.has(l.id))
    .reduce((sum, l) => {
      const rate = l.rate || l.project_rate || 12000
      return sum + Math.round((l.duration_minutes / 60) * rate)
    }, 0) || 0

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Create Invoice</h2>
        </div>

        <div className="p-4 overflow-auto flex-1">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-lg mb-4"
          >
            <option value="">Select project...</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.client_id})
              </option>
            ))}
          </select>

          {loading && (
            <p className="text-slate-400 text-center py-8">Loading unbilled time...</p>
          )}

          {unbilledData && unbilledData.logs.length === 0 && (
            <p className="text-slate-400 text-center py-8">No unbilled time for this project.</p>
          )}

          {unbilledData && unbilledData.logs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                <span>Select time entries to invoice:</span>
                <button
                  onClick={() => {
                    if (selectedLogs.size === unbilledData.logs.length) {
                      setSelectedLogs(new Set())
                    } else {
                      setSelectedLogs(new Set(unbilledData.logs.map(l => l.id)))
                    }
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {selectedLogs.size === unbilledData.logs.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {unbilledData.logs.map(log => {
                const rate = log.rate || log.project_rate || 12000
                const amount = Math.round((log.duration_minutes / 60) * rate)
                return (
                  <label
                    key={log.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedLogs.has(log.id)
                        ? 'border-brand-red bg-red-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLogs.has(log.id)}
                      onChange={() => toggleLog(log.id)}
                      className="w-4 h-4 text-brand-red"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {log.description || 'Work session'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {new Date(log.started_at).toLocaleDateString()} • {Math.round(log.duration_minutes / 60 * 10) / 10}h
                      </p>
                    </div>
                    <span className="font-medium text-slate-700">
                      {formatMoney(amount)}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Selected Total</p>
              <p className="text-xl font-bold text-slate-900">{formatMoney(selectedTotal)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={selectedLogs.size === 0}
                className="px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red/90 disabled:opacity-50"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      let invoicesUrl = `${API_BASE}/invoices`
      if (statusFilter) {
        invoicesUrl += `?status=${statusFilter}`
      }

      const [invoicesRes, projectsRes] = await Promise.all([
        fetch(invoicesUrl),
        fetch(`${API_BASE}/projects?exclude_hosting=true`)
      ])

      const invoicesData = await invoicesRes.json()
      const projectsData = await projectsRes.json()

      setInvoices(invoicesData)
      setProjects(projectsData)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  const handleInvoiceUpdate = (updated) => {
    setInvoices(prev => prev.map(inv => inv.id === updated.id ? updated : inv))
  }

  const handleCreateInvoice = (newInvoice) => {
    setInvoices(prev => [newInvoice, ...prev])
  }

  // Stats
  const stats = {
    draft: invoices.filter(i => i.status === 'draft').reduce((sum, i) => sum + i.total, 0),
    sent: invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.total, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red/90"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase">Draft</p>
          <p className="text-xl font-bold text-slate-600">{formatMoney(stats.draft)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase">Unpaid</p>
          <p className="text-xl font-bold text-yellow-600">{formatMoney(stats.sent)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase">Paid</p>
          <p className="text-xl font-bold text-green-600">{formatMoney(stats.paid)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['', 'draft', 'sent', 'paid', 'void'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              statusFilter === status
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <p className="text-center text-slate-400 py-12">Loading invoices...</p>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No invoices found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map(invoice => (
            <InvoiceRow
              key={invoice.id}
              invoice={invoice}
              onUpdate={handleInvoiceUpdate}
            />
          ))}
        </div>
      )}

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        projects={projects}
        onCreateInvoice={handleCreateInvoice}
      />
    </div>
  )
}

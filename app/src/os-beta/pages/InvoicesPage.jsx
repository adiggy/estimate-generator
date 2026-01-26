import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, FileText, Send, CheckCircle, XCircle, ExternalLink, Server, FolderKanban, ChevronDown, ChevronUp, Edit2, Check, X, Trash2 } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Detect hosting invoices: recurring amounts (2+ occurrences) under $100
// Hosting is typically $37-39 or $79, always under $100
// This excludes recurring project payments like $1000 milestones
const HOSTING_MAX = 10000 // $100 in cents

function getHostingAmounts(invoices) {
  const amountCounts = {}
  invoices.forEach(inv => {
    amountCounts[inv.total] = (amountCounts[inv.total] || 0) + 1
  })
  // Amounts that appear at least twice AND are under $100 are hosting
  return new Set(
    Object.entries(amountCounts)
      .filter(([amount, count]) => count >= 2 && parseInt(amount) < HOSTING_MAX)
      .map(([amount]) => parseInt(amount))
  )
}

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

// Editable line item component
function EditableLineItem({ item, index, onUpdate, onDelete, rate }) {
  const [editing, setEditing] = useState(null) // 'description' or 'hours'
  const [editValue, setEditValue] = useState('')

  const startEdit = (field) => {
    setEditing(field)
    if (field === 'description') {
      setEditValue(item.description)
    } else if (field === 'hours') {
      setEditValue(String(item.quantity || (item.amount / (rate || 12000))))
    }
  }

  const saveEdit = () => {
    if (editing === 'description') {
      onUpdate(index, { ...item, description: editValue })
    } else if (editing === 'hours') {
      const hours = parseFloat(editValue) || 0
      const itemRate = item.rate || rate || 12000
      onUpdate(index, { ...item, quantity: hours, amount: Math.round(hours * itemRate) })
    }
    setEditing(null)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditValue('')
  }

  const hours = item.quantity || (item.amount / (item.rate || rate || 12000))

  return (
    <div className="flex items-center gap-2 py-2 group">
      <div className="flex-1 min-w-0">
        {editing === 'description' ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:border-brand-slate focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
            />
            <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={cancelEdit} className="p-1 text-slate-400 hover:bg-slate-50 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span
            onClick={() => startEdit('description')}
            className="text-sm text-slate-700 cursor-pointer hover:text-slate-900 hover:bg-slate-50 px-1 -mx-1 rounded"
          >
            {item.description}
          </span>
        )}
      </div>
      <div className="w-20 text-right">
        {editing === 'hours' ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="0.25"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:border-brand-slate focus:outline-none text-right"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
            />
            <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <span
            onClick={() => startEdit('hours')}
            className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 hover:bg-slate-50 px-1 rounded"
          >
            {hours.toFixed(2)}h
          </span>
        )}
      </div>
      <div className="w-24 text-right">
        <span className="text-sm font-medium text-slate-700">{formatMoney(item.amount)}</span>
      </div>
      <button
        onClick={() => onDelete(index)}
        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function InvoiceRow({ invoice, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [lineItems, setLineItems] = useState(invoice.line_items || [])
  const [saving, setSaving] = useState(false)
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

  const handleLineItemUpdate = (index, updatedItem) => {
    const newItems = [...lineItems]
    newItems[index] = updatedItem
    setLineItems(newItems)
    saveLineItems(newItems)
  }

  const handleLineItemDelete = (index) => {
    const newItems = lineItems.filter((_, i) => i !== index)
    setLineItems(newItems)
    saveLineItems(newItems)
  }

  const saveLineItems = async (items) => {
    setSaving(true)
    try {
      const newTotal = items.reduce((sum, item) => sum + (item.amount || 0), 0)
      const res = await fetch(`${API_BASE}/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_items: items, subtotal: newTotal, total: newTotal })
      })
      const updated = await res.json()
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update line items:', err)
    }
    setSaving(false)
  }

  const currentTotal = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header row - always visible */}
      <div
        className="p-4 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${
              invoice.status === 'paid' ? 'text-green-500' :
              invoice.status === 'sent' ? 'text-yellow-500' :
              invoice.status === 'void' ? 'text-red-500' :
              'text-slate-400'
            }`} />
            <span className="font-mono text-sm text-slate-500">{invoice.id}</span>
            {saving && <span className="text-xs text-slate-400">Saving...</span>}
          </div>
          <p className="font-medium text-slate-900 mt-1">{invoice.client_id}</p>
          <p className="text-sm text-slate-500">{formatDate(invoice.created_at)}</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <p className="text-xl font-bold text-slate-900">{formatMoney(currentTotal)}</p>
            <select
              value={invoice.status}
              onChange={(e) => {
                e.stopPropagation()
                handleStatusChange(e.target.value)
              }}
              onClick={(e) => e.stopPropagation()}
              className={`mt-2 text-xs px-2 py-1 rounded ${STATUS_STYLES[invoice.status]}`}
            >
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="void">Void</option>
            </select>
          </div>
          <button className="p-1 text-slate-400 mt-1">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded line items - editable */}
      {expanded && lineItems.length > 0 && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400 uppercase tracking-wide">
            <div className="flex-1">Description</div>
            <div className="w-20 text-right">Hours</div>
            <div className="w-24 text-right">Amount</div>
            <div className="w-6"></div>
          </div>
          <div className="divide-y divide-slate-100">
            {lineItems.map((item, i) => (
              <EditableLineItem
                key={i}
                item={item}
                index={i}
                onUpdate={handleLineItemUpdate}
                onDelete={handleLineItemDelete}
                rate={12000}
              />
            ))}
          </div>
          <div className="flex justify-end pt-3 mt-3 border-t border-slate-200">
            <div className="text-right">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-lg font-bold text-slate-900">{formatMoney(currentTotal)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed preview */}
      {!expanded && lineItems.length > 0 && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs text-slate-400">
            {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''} • Click to expand & edit
          </p>
        </div>
      )}

      {invoice.stripe_invoice_url && (
        <div className="px-4 pb-4">
          <a
            href={invoice.stripe_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
            View in Stripe
          </a>
        </div>
      )}
    </div>
  )
}

// Modal for selecting time entries to invoice
function CreateInvoiceModal({ isOpen, onClose, projects, existingInvoices, onCreateInvoice, onRefresh }) {
  const [selectedProject, setSelectedProject] = useState('')
  const [unbilledData, setUnbilledData] = useState(null)
  const [selectedLogs, setSelectedLogs] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [draftInvoices, setDraftInvoices] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState('new') // 'new' or invoice id

  useEffect(() => {
    if (selectedProject) {
      loadUnbilled()
      // Find existing draft invoices for this client
      const project = projects.find(p => p.id === selectedProject)
      if (project) {
        const drafts = existingInvoices.filter(
          inv => inv.client_id === project.client_id && inv.status === 'draft'
        )
        setDraftInvoices(drafts)
        setSelectedInvoice('new') // Reset to new by default
      }
    } else {
      setUnbilledData(null)
      setSelectedLogs(new Set())
      setDraftInvoices([])
      setSelectedInvoice('new')
    }
  }, [selectedProject, existingInvoices, projects])

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
    const newLineItems = selectedLogsArray.map(log => {
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

    try {
      if (selectedInvoice !== 'new') {
        // Add to existing draft invoice
        const existingInvoice = draftInvoices.find(inv => inv.id === selectedInvoice)
        const combinedItems = [...(existingInvoice.line_items || []), ...newLineItems]
        const newTotal = combinedItems.reduce((sum, item) => sum + (item.amount || 0), 0)

        await fetch(`${API_BASE}/invoices/${selectedInvoice}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            line_items: combinedItems,
            subtotal: newTotal,
            total: newTotal,
            time_log_ids: Array.from(selectedLogs)
          })
        })
        // Refresh to show updated invoice
        onRefresh()
      } else {
        // Create new invoice
        const total = newLineItems.reduce((sum, item) => sum + item.amount, 0)

        const res = await fetch(`${API_BASE}/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: project.client_id,
            subtotal: total,
            total,
            line_items: newLineItems,
            time_log_ids: Array.from(selectedLogs)
          })
        })
        const newInvoice = await res.json()
        onCreateInvoice(newInvoice)
      }
      onClose()
    } catch (err) {
      console.error('Failed to create/update invoice:', err)
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

          {/* Invoice selection - show if there are draft invoices for this client */}
          {unbilledData && unbilledData.logs.length > 0 && draftInvoices.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">
                Add to existing draft or create new?
              </p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                  selectedInvoice === 'new' ? 'bg-blue-100' : 'hover:bg-blue-100/50'
                }`}>
                  <input
                    type="radio"
                    name="invoice"
                    checked={selectedInvoice === 'new'}
                    onChange={() => setSelectedInvoice('new')}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-slate-700">Create new invoice</span>
                </label>
                {draftInvoices.map(inv => (
                  <label key={inv.id} className={`flex items-center gap-3 p-2 rounded cursor-pointer ${
                    selectedInvoice === inv.id ? 'bg-blue-100' : 'hover:bg-blue-100/50'
                  }`}>
                    <input
                      type="radio"
                      name="invoice"
                      checked={selectedInvoice === inv.id}
                      onChange={() => setSelectedInvoice(inv.id)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-slate-700">
                        Add to draft {inv.id}
                      </span>
                      <span className="text-xs text-slate-500 ml-2">
                        ({(inv.line_items || []).length} items, {formatMoney(inv.total)})
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
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
                className="px-4 py-2 bg-brand-slate text-white rounded-lg hover:bg-brand-slate/90 disabled:opacity-50"
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [invoices, setInvoices] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [activeTab, setActiveTab] = useState('projects') // 'projects' or 'hosting'
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Auto-open create modal if ?create=1 in URL
  useEffect(() => {
    if (searchParams.get('create') === '1' && !loading && projects.length > 0) {
      setShowCreateModal(true)
      // Remove the query param so refreshing doesn't re-open
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, loading, projects])

  const loadData = async () => {
    setLoading(true)
    try {
      // Always fetch ALL invoices so we can detect recurring amounts properly
      const [invoicesRes, projectsRes] = await Promise.all([
        fetch(`${API_BASE}/invoices`),
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

  // Split invoices by type - recurring amounts under $100 are hosting charges
  const hostingAmounts = getHostingAmounts(invoices)
  const allHostingInvoices = invoices.filter(i => hostingAmounts.has(i.total))
  const allProjectInvoices = invoices.filter(i => !hostingAmounts.has(i.total))

  // Apply status filter client-side
  const filterByStatus = (list) => statusFilter ? list.filter(i => i.status === statusFilter) : list
  const hostingInvoices = filterByStatus(allHostingInvoices)
  const projectInvoices = filterByStatus(allProjectInvoices)
  const displayedInvoices = activeTab === 'projects' ? projectInvoices : hostingInvoices

  // Stats for current tab (use filtered invoices)
  const currentInvoices = activeTab === 'projects' ? projectInvoices : hostingInvoices
  const stats = {
    draft: currentInvoices.filter(i => i.status === 'draft').reduce((sum, i) => sum + i.total, 0),
    sent: currentInvoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + i.total, 0),
    paid: currentInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  }

  // Calculate MRR for hosting tab (average of last 3 months of paid hosting invoices)
  const calculateMRR = () => {
    const paidHosting = hostingInvoices.filter(i => i.status === 'paid')
    if (paidHosting.length === 0) return 0

    // Get unique months with paid invoices
    const monthlyTotals = {}
    paidHosting.forEach(inv => {
      const date = new Date(inv.paid_at || inv.created_at)
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + inv.total
    })

    const months = Object.values(monthlyTotals)
    if (months.length === 0) return 0

    // Average of available months (up to 3)
    const recentMonths = months.slice(-3)
    return Math.round(recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length)
  }

  const mrr = calculateMRR()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        {activeTab === 'projects' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-slate text-white rounded-lg hover:bg-brand-slate/90"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === 'projects'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          Projects
          <span className="ml-1 px-1.5 py-0.5 bg-slate-200 rounded text-xs">
            {allProjectInvoices.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('hosting')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors min-h-[44px] ${
            activeTab === 'hosting'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Server className="w-4 h-4" />
          Hosting
          <span className="ml-1 px-1.5 py-0.5 bg-slate-200 rounded text-xs">
            {allHostingInvoices.length}
          </span>
        </button>
      </div>

      {/* Stats */}
      <div className={`grid gap-4 mb-6 ${activeTab === 'hosting' ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {activeTab === 'hosting' && (
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <p className="text-xs text-blue-600 uppercase font-medium">MRR</p>
            <p className="text-xl font-bold text-blue-700">{formatMoney(mrr)}</p>
          </div>
        )}
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
      <div className="flex flex-wrap gap-2 mb-6">
        {['', 'draft', 'sent', 'paid', 'void'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2.5 text-sm rounded-lg min-h-[44px] ${
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
      ) : displayedInvoices.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">
            {activeTab === 'hosting'
              ? 'No hosting invoices found.'
              : 'No project invoices found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedInvoices.map(invoice => (
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
        existingInvoices={invoices}
        onCreateInvoice={handleCreateInvoice}
        onRefresh={loadData}
      />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Plus, Copy, Trash2, CheckCircle, MessageSquare } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const STORAGE_KEY = 'adrial-os-feedback'

export default function FeedbackPage() {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setItems(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to parse saved feedback:', e)
      }
    }
  }, [])

  // Save to localStorage whenever items change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const newItem = {
      id: Date.now().toString(),
      text: input.trim(),
      createdAt: new Date().toISOString()
    }

    setItems(prev => [newItem, ...prev])
    setInput('')
  }

  const handleDelete = (id) => {
    setItems(prev => prev.filter(item => item.id !== id))
    setDeleteItemId(null)
  }

  const handleDeleteAll = () => {
    setItems([])
    setDeleteAllConfirm(false)
  }

  const handleCopyAll = async () => {
    if (items.length === 0) return

    const bulletList = items
      .map(item => `- ${item.text}`)
      .join('\n')

    try {
      await navigator.clipboard.writeText(bulletList)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for mobile
      const textArea = document.createElement('textarea')
      textArea.value = bulletList
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback & Ideas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Capture bugs and ideas on the go
          </p>
        </div>
        <MessageSquare className="w-8 h-8 text-slate-300" />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bug, idea, or note..."
            className="flex-1 p-4 text-lg border border-slate-200 rounded-xl focus:border-brand-slate focus:outline-none"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-6 py-4 bg-brand-slate text-white rounded-xl font-semibold hover:bg-brand-slate/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </form>

      {/* Action Buttons */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleCopyAll}
            className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copy All ({items.length})
              </>
            )}
          </button>
          <button
            onClick={() => setDeleteAllConfirm(true)}
            className="py-3 px-4 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Delete All
          </button>
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400">No items yet. Add your first bug or idea above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-slate-900">{item.text}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDate(item.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setDeleteItemId(item.id)}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete All Confirmation */}
      <ConfirmModal
        isOpen={deleteAllConfirm}
        onClose={() => setDeleteAllConfirm(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Items"
        message={`Delete all ${items.length} item${items.length !== 1 ? 's' : ''}?\n\nThis cannot be undone. Make sure you've copied them first if needed.`}
        confirmText="Delete All"
        danger
      />

      {/* Delete Single Item Confirmation */}
      <ConfirmModal
        isOpen={!!deleteItemId}
        onClose={() => setDeleteItemId(null)}
        onConfirm={() => handleDelete(deleteItemId)}
        title="Delete Item"
        message="Delete this item?"
        confirmText="Delete"
        danger
      />
    </div>
  )
}

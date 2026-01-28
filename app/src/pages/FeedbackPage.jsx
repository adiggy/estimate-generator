import { useState, useEffect, useRef } from 'react'
import { Plus, Copy, Trash2, CheckCircle, MessageSquare, Loader2, Image, X } from 'lucide-react'
import ConfirmModal from '../components/ConfirmModal'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

export default function FeedbackPage() {
  const [items, setItems] = useState([])
  const [input, setInput] = useState('')
  const [image, setImage] = useState(null) // base64 image data
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const [deleteItemId, setDeleteItemId] = useState(null)
  const [expandedImage, setExpandedImage] = useState(null)
  const inputRef = useRef(null)

  // Load from database on mount
  useEffect(() => {
    loadFeedback()
  }, [])

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
              setImage(e.target.result)
            }
            reader.readAsDataURL(file)
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const loadFeedback = async () => {
    try {
      const res = await fetch(`${API_BASE}/feedback`)
      const data = await res.json()
      setItems(data)
    } catch (err) {
      console.error('Failed to load feedback:', err)
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if ((!input.trim() && !image) || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: input.trim() || '(screenshot)',
          image: image
        })
      })
      const newItem = await res.json()
      setItems(prev => [newItem, ...prev])
      setInput('')
      setImage(null)
    } catch (err) {
      console.error('Failed to create feedback:', err)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API_BASE}/feedback/${id}`, { method: 'DELETE' })
      setItems(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      console.error('Failed to delete feedback:', err)
    }
    setDeleteItemId(null)
  }

  const handleDeleteAll = async () => {
    try {
      await fetch(`${API_BASE}/feedback`, { method: 'DELETE' })
      setItems([])
    } catch (err) {
      console.error('Failed to delete all feedback:', err)
    }
    setDeleteAllConfirm(false)
  }

  const handleCopyAll = async () => {
    if (items.length === 0) return

    const bulletList = items
      .map(item => `- ${item.text}${item.image ? ' [has screenshot]' : ''}`)
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

  const removeImage = () => {
    setImage(null)
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Feedback & Ideas</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Paste screenshots or type notes
          </p>
        </div>
        <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Bug, idea, or paste screenshot..."
            className="flex-1 p-3 sm:p-4 text-base sm:text-lg border border-slate-200 rounded-xl focus:border-brand-slate focus:outline-none"
            autoComplete="off"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !image) || submitting}
            className="px-4 sm:px-6 py-3 sm:py-4 bg-brand-slate text-white rounded-xl font-semibold hover:bg-brand-slate/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
            ) : (
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </button>
        </div>

        {/* Image Preview */}
        {image && (
          <div className="mt-3 relative inline-block">
            <img
              src={image}
              alt="Screenshot preview"
              className="max-h-32 sm:max-h-48 rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Image className="w-3 h-3" />
              Screenshot attached
            </p>
          </div>
        )}
      </form>

      {/* Action Buttons */}
      {items.length > 0 && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleCopyAll}
            className={`flex-1 py-2.5 sm:py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-sm sm:text-base ${
              copied
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                Copy All ({items.length})
              </>
            )}
          </button>
          <button
            onClick={() => setDeleteAllConfirm(true)}
            className="py-2.5 sm:py-3 px-3 sm:px-4 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Delete All</span>
          </button>
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-sm sm:text-base">No items yet. Add your first bug or idea above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 text-sm sm:text-base">{item.text}</p>
                  {item.image && (
                    <img
                      src={item.image}
                      alt="Screenshot"
                      className="mt-2 max-h-32 sm:max-h-48 rounded-lg border border-slate-200 cursor-pointer hover:opacity-90"
                      onClick={() => setExpandedImage(item.image)}
                    />
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    {formatDate(item.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteItemId(item.id)}
                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
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

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 p-2 bg-white/20 text-white rounded-full hover:bg-white/30"
            onClick={() => setExpandedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  )
}

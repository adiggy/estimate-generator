import { useState, useEffect } from 'react'
import { Save, X } from 'lucide-react'

export default function VersionModal({
  isOpen,
  onClose,
  onSave,
  saving = false,
  error = null
}) {
  const [versionName, setVersionName] = useState('')

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setVersionName('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(versionName.trim())
    // Don't clear here - let parent handle on success
  }

  const handleClose = () => {
    setVersionName('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Save className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Save Version</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Version Name
          </label>
          <input
            type="text"
            value={versionName}
            onChange={(e) => setVersionName(e.target.value)}
            placeholder="e.g., Before client feedback, Final draft..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <p className="mt-2 text-xs text-slate-400">
            Leave blank to auto-generate a name with the current date/time.
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Version'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, FileText, Search, Menu, X, Users } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

// Top header bar with live search
export default function Header({ onMenuClick }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()
  const searchRef = useRef(null)

  // Live search as user types
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch (err) {
        console.error('Search error:', err)
      }
      setSearching(false)
    }, 200) // Debounce

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false)
        setSearchQuery('')
        setSearchResults(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (path) => {
    navigate(path)
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults(null)
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-3 -ml-3 text-slate-600 hover:text-slate-900 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-2 relative" ref={searchRef}>
        {searchOpen ? (
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects, invoices..."
                  className="w-80 pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-brand-slate"
                  autoFocus
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false)
                  setSearchQuery('')
                  setSearchResults(null)
                }}
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live search results dropdown */}
            {(searchResults || searching) && searchQuery.length >= 2 && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-lg max-h-96 overflow-auto">
                {searching && !searchResults && (
                  <div className="p-4 text-center text-slate-400 text-sm">Searching...</div>
                )}

                {searchResults && searchResults.counts.total === 0 && (
                  <div className="p-4 text-center text-slate-400 text-sm">No results found</div>
                )}

                {searchResults && searchResults.counts.total > 0 && (
                  <div className="divide-y divide-slate-100">
                    {/* Projects */}
                    {searchResults.results.projects.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <FolderKanban className="w-3 h-3" />
                          Projects
                        </p>
                        {searchResults.results.projects.slice(0, 5).map(project => (
                          <button
                            key={project.id}
                            onClick={() => handleResultClick(`/projects/${project.id}`)}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-blue-100 text-blue-700 rounded">
                              <FolderKanban className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{project.name}</p>
                              <p className="text-xs text-slate-400">{project.client_id}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Invoices */}
                    {searchResults.results.invoices.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Invoices
                        </p>
                        {searchResults.results.invoices.slice(0, 5).map(invoice => (
                          <button
                            key={invoice.id}
                            onClick={() => handleResultClick('/invoices')}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-green-100 text-green-700 rounded">
                              <FileText className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">Invoice {invoice.id}</p>
                              <p className="text-xs text-slate-400">{invoice.client_id} • ${((invoice.total || 0) / 100).toFixed(0)}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Clients */}
                    {searchResults.results.clients.length > 0 && (
                      <div className="p-2">
                        <p className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Clients
                        </p>
                        {searchResults.results.clients.slice(0, 5).map(client => (
                          <div
                            key={client.id}
                            className="px-2 py-2 rounded-lg flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-purple-100 text-purple-700 rounded">
                              <Users className="w-3 h-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{client.name}</p>
                              {client.company && <p className="text-xs text-slate-400">{client.company}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  )
}

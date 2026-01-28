import { useState, useEffect } from 'react'
import { useSearchParams, NavLink } from 'react-router-dom'
import { Search, FolderKanban, FileText, Users, AlertCircle } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

const TYPE_ICONS = {
  project: FolderKanban,
  invoice: FileText,
  client: Users
}

const TYPE_COLORS = {
  project: 'bg-blue-100 text-blue-700',
  invoice: 'bg-green-100 text-green-700',
  client: 'bg-purple-100 text-purple-700'
}

function SearchResult({ result }) {
  const Icon = TYPE_ICONS[result.type] || FolderKanban

  if (result.type === 'project') {
    return (
      <NavLink
        to={`/projects/${result.id}`}
        className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
      >
        <div className={`p-2 rounded-lg ${TYPE_COLORS.project}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{result.name}</p>
          <p className="text-sm text-slate-500">{result.client_id}</p>
          {result.description && (
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{result.description}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded ${
          result.status === 'active' ? 'bg-green-100 text-green-700' :
          result.status === 'done' ? 'bg-blue-100 text-blue-700' :
          'bg-slate-100 text-slate-600'
        }`}>
          {result.status}
        </span>
      </NavLink>
    )
  }

  if (result.type === 'invoice') {
    return (
      <NavLink
        to="/invoices"
        className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
      >
        <div className={`p-2 rounded-lg ${TYPE_COLORS.invoice}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">Invoice {result.id}</p>
          <p className="text-sm text-slate-500">{result.client_id}</p>
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-900">
            ${((result.total || 0) / 100).toFixed(2)}
          </p>
          <span className={`text-xs px-2 py-1 rounded ${
            result.status === 'paid' ? 'bg-green-100 text-green-700' :
            result.status === 'sent' ? 'bg-yellow-100 text-yellow-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {result.status}
          </span>
        </div>
      </NavLink>
    )
  }

  if (result.type === 'client') {
    return (
      <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200">
        <div className={`p-2 rounded-lg ${TYPE_COLORS.client}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{result.name}</p>
          {result.company && result.company !== result.name && (
            <p className="text-sm text-slate-500">{result.company}</p>
          )}
          {result.email && (
            <p className="text-sm text-slate-400">{result.email}</p>
          )}
        </div>
      </div>
    )
  }

  return null
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (query.length >= 2) {
      search()
    } else {
      setResults(null)
    }
  }, [query])

  const search = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data)
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed. Please try again.')
    }
    setLoading(false)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const newQuery = formData.get('q')
    setSearchParams({ q: newQuery })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search projects, invoices, clients..."
            className="w-full pl-12 pr-4 py-3 text-lg border border-slate-200 rounded-xl focus:border-brand-red focus:outline-none"
            autoFocus
          />
        </div>
      </form>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-slate-400">Searching...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div>
          {/* Summary */}
          <p className="text-sm text-slate-500 mb-6">
            Found {results.counts.total} result{results.counts.total !== 1 ? 's' : ''} for "{results.query}"
          </p>

          {results.counts.total === 0 ? (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">No results found.</p>
              <p className="text-sm text-slate-400 mt-1">Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Projects */}
              {results.results.projects.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FolderKanban className="w-4 h-4" />
                    Projects ({results.counts.projects})
                  </h2>
                  <div className="space-y-2">
                    {results.results.projects.map(project => (
                      <SearchResult key={project.id} result={project} />
                    ))}
                  </div>
                </section>
              )}

              {/* Invoices */}
              {results.results.invoices.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Invoices ({results.counts.invoices})
                  </h2>
                  <div className="space-y-2">
                    {results.results.invoices.map(invoice => (
                      <SearchResult key={invoice.id} result={invoice} />
                    ))}
                  </div>
                </section>
              )}

              {/* Clients */}
              {results.results.clients.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Clients ({results.counts.clients})
                  </h2>
                  <div className="space-y-2">
                    {results.results.clients.map(client => (
                      <SearchResult key={client.id} result={client} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no query */}
      {!query && !loading && !results && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">Enter a search term to find projects, invoices, and clients.</p>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { Server, DollarSign, Users, Calendar, TrendingUp, TrendingDown } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

export default function HostingPage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/hosting`)
      const data = await res.json()
      setRecords(data)
    } catch (err) {
      console.error('Failed to load hosting data:', err)
    }
    setLoading(false)
  }

  const formatMoney = (cents) => {
    if (!cents && cents !== 0) return '$0.00'
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  // Active records have webflow_cost > 0
  const activeRecords = useMemo(() => {
    return records.filter(r => r.webflow_cost_cents > 0)
  }, [records])

  // Inactive/defunct records
  const inactiveRecords = useMemo(() => {
    return records.filter(r => !r.webflow_cost_cents || r.webflow_cost_cents === 0)
  }, [records])

  // Calculate totals from active records
  const totals = useMemo(() => {
    return activeRecords.reduce((acc, r) => ({
      mrr: acc.mrr + (r.rate_cents || 0),
      webflowCost: acc.webflowCost + (r.webflow_cost_cents || 0),
      profit: acc.profit + (r.profit_cents || 0)
    }), { mrr: 0, webflowCost: 0, profit: 0 })
  }, [activeRecords])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Hosting & Legacy</h1>

      {/* MRR Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Revenue Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-blue-100 text-xs uppercase tracking-wide">Monthly Revenue</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : formatMoney(totals.mrr)}
              </p>
            </div>
          </div>
        </div>

        {/* Webflow Costs Card */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-orange-100 text-xs uppercase tracking-wide">Webflow Costs</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : formatMoney(totals.webflowCost)}
              </p>
            </div>
          </div>
        </div>

        {/* Net Profit Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-green-100 text-xs uppercase tracking-wide">Net Profit</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : formatMoney(totals.profit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-slate-50 rounded-lg p-4 mb-8 flex flex-wrap items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Users className="w-4 h-4" />
          <span>{activeRecords.length} active clients</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <Server className="w-4 h-4" />
          <span>Billed via Bonsai</span>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading hosting clients...</p>
        </div>
      )}

      {/* Active Hosting Clients */}
      {!loading && activeRecords.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">
            Active Hosting ({activeRecords.length})
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Project</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Billing</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Webflow</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRecords.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {record.client_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {record.project_name}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                        record.billing_frequency === 'annual'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {record.billing_frequency === 'annual' && <Calendar className="w-3 h-3" />}
                        {record.billing_frequency === 'annual' ? 'Annual' : 'Monthly'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatMoney(record.rate_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-orange-600">{formatMoney(record.webflow_cost_cents)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={record.profit_cents > 0 ? 'text-green-600 font-medium' : record.profit_cents < 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                        {formatMoney(record.profit_cents)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan="3" className="px-4 py-3 font-semibold text-slate-900 hidden lg:table-cell">
                    Totals
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900 lg:hidden">
                    Totals
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 hidden md:table-cell lg:hidden">
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(totals.mrr)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">
                    {formatMoney(totals.webflowCost)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {formatMoney(totals.profit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Inactive/Former Hosting Clients */}
      {!loading && inactiveRecords.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Inactive ({inactiveRecords.length})
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden opacity-60">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inactiveRecords.map(record => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-slate-600">
                      {record.client_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {record.project_name}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      Defunct
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && records.length === 0 && (
        <div className="text-center py-12">
          <Server className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No hosting clients found.</p>
        </div>
      )}
    </div>
  )
}

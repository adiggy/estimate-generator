import { useState, useEffect, useMemo } from 'react'
import { Server, DollarSign, Users, Calendar } from 'lucide-react'

const API_BASE = import.meta.env.DEV ? 'http://localhost:3002/api/os-beta' : '/api/os-beta'

export default function HostingPage() {
  const [projects, setProjects] = useState([])
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectsRes, invoicesRes] = await Promise.all([
        fetch(`${API_BASE}/projects?billing_platform=bonsai_legacy`),
        fetch(`${API_BASE}/invoices`)
      ])
      const projectsData = await projectsRes.json()
      const invoicesData = await invoicesRes.json()
      setProjects(projectsData)
      setInvoices(invoicesData)
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  // Get hosting invoices (using is_hosting flag)
  const hostingInvoices = useMemo(() => {
    return invoices.filter(inv => inv.is_hosting)
  }, [invoices])

  // Get the most recent hosting invoice per client with MRR calculation
  const clientFees = useMemo(() => {
    const fees = {}
    // Sort by date descending to get most recent first
    const sortedInvoices = [...hostingInvoices]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    sortedInvoices.forEach(inv => {
      if (!fees[inv.client_id]) {
        // For annual billing, divide by 12 for monthly rate
        const monthlyAmount = inv.billing_cycle === 'annual'
          ? Math.round(inv.total / 12)
          : inv.total
        fees[inv.client_id] = {
          monthlyAmount,
          totalAmount: inv.total,
          billingCycle: inv.billing_cycle || 'monthly'
        }
      }
    })
    return fees
  }, [hostingInvoices])

  const formatMoney = (cents) => {
    if (!cents) return '$0'
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const activeProjects = projects.filter(p => p.status === 'active')
  const inactiveProjects = projects.filter(p => p.status !== 'active')

  // Calculate MRR (sum of monthly amounts for active clients)
  const actualMRR = useMemo(() => {
    return activeProjects.reduce((sum, project) => {
      const fee = clientFees[project.client_id]
      return sum + (fee?.monthlyAmount || 0)
    }, 0)
  }, [activeProjects, clientFees])

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Hosting & Legacy</h1>

      {/* MRR Card */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-3">
            <DollarSign className="w-8 h-8" />
          </div>
          <div>
            <p className="text-blue-100 text-sm">Monthly Recurring Revenue</p>
            <p className="text-4xl font-bold">
              {loading ? '...' : formatMoney(actualMRR)}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{activeProjects.length} active clients</span>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <span>Billed via Bonsai</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-slate-400">Loading hosting clients...</p>
        </div>
      )}

      {/* Active Hosting Clients */}
      {!loading && activeProjects.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-4">
            Active Hosting ({activeProjects.length})
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Billing</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Monthly Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeProjects.map(project => {
                  const fee = clientFees[project.client_id]
                  return (
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {project.client_id}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {project.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {fee ? (
                          <span className={`text-xs px-2 py-1 rounded ${
                            fee.billingCycle === 'annual'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {fee.billingCycle === 'annual' ? (
                              <span className="flex items-center gap-1 justify-center">
                                <Calendar className="w-3 h-3" />
                                Annual ({formatMoney(fee.totalAmount)}/yr)
                              </span>
                            ) : 'Monthly'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {fee ? formatMoney(fee.monthlyAmount) : <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td colSpan="3" className="px-4 py-3 font-semibold text-slate-900">
                    Total MRR
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(actualMRR)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Inactive/Former Hosting Clients */}
      {!loading && inactiveProjects.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Inactive ({inactiveProjects.length})
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
                {inactiveProjects.map(project => (
                  <tr key={project.id}>
                    <td className="px-4 py-3 text-slate-600">
                      {project.client_id}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {project.name}
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">
                      {project.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-12">
          <Server className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-400">No hosting clients found.</p>
        </div>
      )}
    </div>
  )
}

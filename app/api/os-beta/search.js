import { neon } from '@neondatabase/serverless'

/**
 * Global Search API
 *
 * Searches across:
 * - Projects (name, description, notes)
 * - Invoices (line_items JSONB via GIN index)
 * - Clients (name, company)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q } = req.query

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' })
  }

  const sql = neon(process.env.DATABASE_URL)
  const searchTerm = `%${q}%`

  try {
    // Run all searches in parallel
    const [projects, invoices, clients] = await Promise.all([
      // Search projects
      sql`
        SELECT id, name, description, client_id, status, priority, billing_platform
        FROM projects
        WHERE name ILIKE ${searchTerm}
          OR description ILIKE ${searchTerm}
          OR notes ILIKE ${searchTerm}
        ORDER BY last_touched_at DESC NULLS LAST
        LIMIT 20
      `,

      // Search invoice line items (uses GIN index)
      sql`
        SELECT id, client_id, total, status, line_items, created_at
        FROM invoices
        WHERE line_items::text ILIKE ${searchTerm}
        ORDER BY created_at DESC
        LIMIT 20
      `,

      // Search clients
      sql`
        SELECT id, data
        FROM clients
        WHERE data::text ILIKE ${searchTerm}
        LIMIT 20
      `
    ])

    // Parse client data
    const parsedClients = clients.map(row => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      return { id: row.id, ...data }
    })

    return res.status(200).json({
      query: q,
      results: {
        projects: projects.map(p => ({
          type: 'project',
          id: p.id,
          name: p.name,
          description: p.description?.substring(0, 100),
          client_id: p.client_id,
          status: p.status,
          priority: p.priority,
          billing_platform: p.billing_platform
        })),
        invoices: invoices.map(i => ({
          type: 'invoice',
          id: i.id,
          client_id: i.client_id,
          total: i.total,
          status: i.status,
          created_at: i.created_at
        })),
        clients: parsedClients.map(c => ({
          type: 'client',
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email
        }))
      },
      counts: {
        projects: projects.length,
        invoices: invoices.length,
        clients: parsedClients.length,
        total: projects.length + invoices.length + parsedClients.length
      }
    })
  } catch (err) {
    console.error('Search API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

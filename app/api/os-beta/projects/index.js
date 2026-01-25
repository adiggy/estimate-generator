import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    if (req.method === 'GET') {
      const { status, client_id, billing_platform, exclude_hosting } = req.query

      let query = 'SELECT * FROM projects WHERE 1=1'
      const params = []

      if (status) {
        params.push(status)
        query += ` AND status = $${params.length}`
      }
      if (client_id) {
        params.push(client_id)
        query += ` AND client_id = $${params.length}`
      }
      if (billing_platform) {
        params.push(billing_platform)
        query += ` AND billing_platform = $${params.length}`
      }
      if (exclude_hosting === 'true') {
        query += ` AND billing_platform != 'bonsai_legacy'`
      }

      query += ' ORDER BY last_touched_at DESC NULLS LAST'

      const rows = await sql(query, params)
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const project = req.body

      // Generate ID if not provided
      if (!project.id) {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        const slug = (project.name || 'project')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .substring(0, 30)
        project.id = `${project.client_id || 'unknown'}-${slug}-${timestamp}`.substring(0, 60)
      }

      const {
        id, client_id, proposal_id, name, description, status = 'active',
        priority = 0, billing_type = 'hourly', billing_platform = 'os',
        budget_low, budget_high, rate = 12000, due_date, notes,
        external_links = [], people = [], tags = []
      } = project

      await sql`
        INSERT INTO projects (
          id, client_id, proposal_id, name, description, status,
          priority, billing_type, billing_platform, budget_low, budget_high,
          rate, due_date, last_touched_at, notes, external_links, people, tags
        ) VALUES (
          ${id}, ${client_id}, ${proposal_id}, ${name}, ${description}, ${status},
          ${priority}, ${billing_type}, ${billing_platform}, ${budget_low}, ${budget_high},
          ${rate}, ${due_date}, NOW(), ${notes}, ${JSON.stringify(external_links)},
          ${JSON.stringify(people)}, ${JSON.stringify(tags)}
        )
      `

      const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Projects API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

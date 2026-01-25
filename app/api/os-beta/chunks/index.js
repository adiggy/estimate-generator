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
      const { project_id, status, phase_name, pending_only } = req.query

      if (pending_only === 'true') {
        // Get all pending chunks with project info (for scheduling)
        const rows = await sql`
          SELECT c.*, p.name as project_name, p.priority, p.client_id
          FROM chunks c
          JOIN projects p ON c.project_id = p.id
          WHERE c.status = 'pending'
          ORDER BY p.priority DESC, p.last_touched_at DESC
        `
        return res.status(200).json(rows)
      }

      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' })
      }

      let rows
      if (status && phase_name) {
        rows = await sql`
          SELECT * FROM chunks
          WHERE project_id = ${project_id} AND status = ${status} AND phase_name = ${phase_name}
          ORDER BY created_at ASC
        `
      } else if (status) {
        rows = await sql`
          SELECT * FROM chunks
          WHERE project_id = ${project_id} AND status = ${status}
          ORDER BY created_at ASC
        `
      } else if (phase_name) {
        rows = await sql`
          SELECT * FROM chunks
          WHERE project_id = ${project_id} AND phase_name = ${phase_name}
          ORDER BY created_at ASC
        `
      } else {
        rows = await sql`
          SELECT * FROM chunks
          WHERE project_id = ${project_id}
          ORDER BY phase_name ASC NULLS LAST, created_at ASC
        `
      }

      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const chunk = req.body

      // Generate ID if not provided
      if (!chunk.id) {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        chunk.id = `chk-${timestamp}-${random}`
      }

      const {
        id, project_id, phase_name, name, description, hours, status = 'pending',
        scheduled_start, scheduled_end, notes
      } = chunk

      if (!project_id || !name || !hours) {
        return res.status(400).json({ error: 'project_id, name, and hours are required' })
      }

      // Validate hours is 1, 2, or 3
      if (![1, 2, 3].includes(hours)) {
        return res.status(400).json({ error: 'hours must be 1, 2, or 3' })
      }

      await sql`
        INSERT INTO chunks (
          id, project_id, phase_name, name, description, hours, status,
          scheduled_start, scheduled_end, notes
        ) VALUES (
          ${id}, ${project_id}, ${phase_name}, ${name}, ${description}, ${hours},
          ${status}, ${scheduled_start}, ${scheduled_end}, ${notes}
        )
      `

      // Touch the project
      await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${project_id}`

      const rows = await sql`SELECT * FROM chunks WHERE id = ${id}`
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Chunks API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

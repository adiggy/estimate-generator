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
      const { project_id, invoiced, running } = req.query

      // Get running timer
      if (running === 'true') {
        const rows = await sql`
          SELECT * FROM time_logs
          WHERE started_at IS NOT NULL AND ended_at IS NULL
          ORDER BY started_at DESC
          LIMIT 1
        `
        return res.status(200).json(rows[0] || null)
      }

      // Get unbilled time for a project
      if (project_id && invoiced === 'false') {
        const rows = await sql`
          SELECT tl.*, p.rate as project_rate
          FROM time_logs tl
          JOIN projects p ON tl.project_id = p.id
          WHERE tl.project_id = ${project_id}
            AND tl.invoiced = false
            AND tl.billable = true
            AND tl.duration_minutes IS NOT NULL
          ORDER BY tl.started_at ASC
        `

        const totalMinutes = rows.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
        const totalAmount = rows.reduce((sum, l) => {
          const rate = l.rate || l.project_rate || 12000
          return sum + Math.round((l.duration_minutes / 60) * rate)
        }, 0)

        return res.status(200).json({ logs: rows, totalMinutes, totalAmount })
      }

      // Get all time logs with filters
      let rows
      if (project_id) {
        rows = await sql`
          SELECT * FROM time_logs
          WHERE project_id = ${project_id}
          ORDER BY started_at DESC
        `
      } else if (invoiced === 'false') {
        rows = await sql`
          SELECT * FROM time_logs
          WHERE invoiced = false
          ORDER BY started_at DESC
        `
      } else {
        rows = await sql`SELECT * FROM time_logs ORDER BY started_at DESC LIMIT 100`
      }

      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const entry = req.body

      // Generate ID if not provided
      if (!entry.id) {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        entry.id = `tl-${timestamp}-${random}`
      }

      const {
        id, project_id, chunk_id, description,
        started_at = new Date().toISOString(),
        ended_at, duration_minutes,
        billable = true, rate
      } = entry

      if (!project_id) {
        return res.status(400).json({ error: 'project_id is required' })
      }

      // Check if there's already a running timer
      if (!ended_at) {
        const running = await sql`
          SELECT * FROM time_logs
          WHERE started_at IS NOT NULL AND ended_at IS NULL
        `
        if (running.length > 0) {
          return res.status(400).json({
            error: 'Timer already running',
            running: running[0]
          })
        }
      }

      await sql`
        INSERT INTO time_logs (
          id, project_id, chunk_id, description, started_at, ended_at,
          duration_minutes, billable, rate
        ) VALUES (
          ${id}, ${project_id}, ${chunk_id}, ${description || 'Work session'},
          ${started_at}, ${ended_at}, ${duration_minutes}, ${billable}, ${rate}
        )
      `

      // Touch the project
      await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${project_id}`

      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Time Logs API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

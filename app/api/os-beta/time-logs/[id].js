import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)
  const { id } = req.query

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Time log not found' })
      }
      return res.status(200).json(rows[0])
    }

    if (req.method === 'PUT') {
      const updates = req.body

      // Get current log
      const current = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      if (current.length === 0) {
        return res.status(404).json({ error: 'Time log not found' })
      }

      const log = current[0]

      // Special case: stopping a timer
      if (updates.stop === true && log.started_at && !log.ended_at) {
        const endedAt = new Date()
        const startedAt = new Date(log.started_at)
        const durationMinutes = Math.round((endedAt - startedAt) / 60000)

        await sql`
          UPDATE time_logs
          SET ended_at = ${endedAt.toISOString()},
              duration_minutes = ${durationMinutes},
              updated_at = NOW()
          WHERE id = ${id}
        `

        const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
        return res.status(200).json(rows[0])
      }

      // Regular update
      const allowedFields = [
        'description', 'ended_at', 'duration_minutes', 'billable', 'invoiced', 'invoice_id', 'rate'
      ]

      const sets = []
      const params = []

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          params.push(value)
          sets.push(`${key} = $${params.length}`)
        }
      }

      if (sets.length === 0) {
        return res.status(200).json(log)
      }

      sets.push('updated_at = NOW()')
      params.push(id)

      const query = `UPDATE time_logs SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
      const rows = await sql(query, params)

      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM time_logs WHERE id = ${id}`
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Time Log API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

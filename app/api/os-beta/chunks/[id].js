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
      const rows = await sql`SELECT * FROM chunks WHERE id = ${id}`
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Chunk not found' })
      }
      return res.status(200).json(rows[0])
    }

    if (req.method === 'PUT') {
      const updates = req.body
      const allowedFields = [
        'phase_name', 'name', 'description', 'hours', 'status',
        'scheduled_start', 'scheduled_end', 'completed_at', 'calendar_event_id', 'notes'
      ]

      // Get current chunk to know project_id for touching
      const current = await sql`SELECT * FROM chunks WHERE id = ${id}`
      if (current.length === 0) {
        return res.status(404).json({ error: 'Chunk not found' })
      }

      const sets = []
      const params = []

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          params.push(value)
          sets.push(`${key} = $${params.length}`)
        }
      }

      // Handle special case: marking as done
      if (updates.status === 'done' && !updates.completed_at) {
        params.push(new Date().toISOString())
        sets.push(`completed_at = $${params.length}`)
      }

      if (sets.length === 0) {
        return res.status(200).json(current[0])
      }

      sets.push('updated_at = NOW()')
      params.push(id)

      const query = `UPDATE chunks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
      const rows = await sql(query, params)

      // Touch the project
      await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${current[0].project_id}`

      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      // Get project_id before deleting
      const current = await sql`SELECT project_id FROM chunks WHERE id = ${id}`

      await sql`DELETE FROM chunks WHERE id = ${id}`

      // Touch the project if it existed
      if (current.length > 0) {
        await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${current[0].project_id}`
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Chunk API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

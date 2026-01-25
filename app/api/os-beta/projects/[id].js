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
      const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' })
      }
      return res.status(200).json(rows[0])
    }

    if (req.method === 'PUT') {
      const updates = req.body
      const allowedFields = [
        'name', 'description', 'status', 'priority', 'billing_type',
        'billing_platform', 'budget_low', 'budget_high', 'rate', 'due_date',
        'last_touched_at', 'notes', 'external_links', 'people', 'tags'
      ]

      const sets = []
      const params = []

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          const serialized = ['external_links', 'people', 'tags'].includes(key)
            ? JSON.stringify(value)
            : value
          params.push(serialized)
          sets.push(`${key} = $${params.length}`)
        }
      }

      if (sets.length === 0) {
        const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
        return res.status(200).json(rows[0] || null)
      }

      sets.push('updated_at = NOW()')
      params.push(id)

      const query = `UPDATE projects SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
      const rows = await sql(query, params)

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' })
      }

      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM projects WHERE id = ${id}`
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Project API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

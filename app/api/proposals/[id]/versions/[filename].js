import { neon } from '@neondatabase/serverless'
import { requireAuth, setCorsHeaders } from '../../../../lib/auth.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req)) return res.status(401).json({ error: 'Authentication required' })

  const sql = neon(process.env.DATABASE_URL)
  const { id, filename } = req.query

  // Validate filename format
  if (!/^[\w\-]+\.json$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM proposal_versions
        WHERE proposal_id = ${id} AND filename = ${filename}
      `
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Version not found' })
      }
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
      return res.status(200).json(data)
    }

    if (req.method === 'DELETE') {
      const result = await sql`
        DELETE FROM proposal_versions
        WHERE proposal_id = ${id} AND filename = ${filename}
        RETURNING id
      `
      if (result.length === 0) {
        return res.status(404).json({ error: 'Version not found' })
      }
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Version detail API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

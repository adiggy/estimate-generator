import { neon } from '@neondatabase/serverless'
import { requireAuth, setCorsHeaders } from '../lib/auth.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Require authentication
  if (!requireAuth(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sql = neon(process.env.DATABASE_URL)
  const { id } = req.query

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM clients WHERE id = ${id}
      `
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' })
      }
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Client API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

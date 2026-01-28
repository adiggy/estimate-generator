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

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM templates`
      const templates = rows.map(row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data)
      return res.status(200).json(templates)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Templates API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

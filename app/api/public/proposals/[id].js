import { neon } from '@neondatabase/serverless'
import { setCorsHeaders } from '../../lib/auth.js'

/**
 * Public read-only proposal view (for client links)
 * No authentication required - only returns proposal data needed for viewing
 */
export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Only allow GET requests for public view
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = neon(process.env.DATABASE_URL)
  const { id } = req.query

  // SECURITY: Validate ID format to prevent injection
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid proposal ID' })
  }

  try {
    const rows = await sql`
      SELECT data FROM proposals WHERE id = ${id}
    `
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' })
    }
    const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
    return res.status(200).json(data)
  } catch (err) {
    console.error('Public proposal API error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

import { neon } from '@neondatabase/serverless'

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)
  const { type } = req.query

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM templates WHERE type = ${type}
      `
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' })
      }
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
      return res.status(200).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Template API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

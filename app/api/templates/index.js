const { sql } = require('../_db.js')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM templates`
      const templates = rows.map(row => row.data)
      return res.status(200).json(templates)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Templates API error:', err)
    return res.status(500).json({ error: 'Database error' })
  }
}

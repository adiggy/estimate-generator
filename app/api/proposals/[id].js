const { sql } = require('../_db.js')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { id } = req.query

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM proposals WHERE id = ${id}
      `
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Proposal not found' })
      }
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
      return res.status(200).json(data)
    }

    if (req.method === 'PUT') {
      const proposal = req.body
      proposal.updatedAt = new Date().toISOString().split('T')[0]

      await sql`
        UPDATE proposals
        SET data = ${JSON.stringify(proposal)}, updated_at = NOW()
        WHERE id = ${id}
      `
      return res.status(200).json(proposal)
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM proposals WHERE id = ${id}`
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Proposal API error:', err)
    return res.status(500).json({ error: 'Database error' })
  }
}

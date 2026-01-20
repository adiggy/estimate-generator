import { sql } from '../_db.js'

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    if (req.method === 'GET') {
      // Get all proposals (metadata only for dashboard)
      const rows = await sql`
        SELECT id, data, updated_at
        FROM proposals
        ORDER BY updated_at DESC
      `
      const proposals = rows.map(row => ({
        id: row.id,
        clientName: row.data.clientName,
        projectName: row.data.projectName,
        date: row.data.date,
        status: row.data.status,
        updatedAt: row.data.updatedAt
      }))
      return res.status(200).json(proposals)
    }

    if (req.method === 'POST') {
      const proposal = req.body
      const today = new Date().toISOString().split('T')[0]

      // Generate ID if not provided
      if (!proposal.id) {
        const slug = proposal.projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .substring(0, 30)
        proposal.id = `${today}-${slug}`
      }

      proposal.createdAt = proposal.createdAt || today
      proposal.updatedAt = today
      proposal.status = proposal.status || 'draft'

      await sql`
        INSERT INTO proposals (id, data, updated_at)
        VALUES (${proposal.id}, ${JSON.stringify(proposal)}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          data = ${JSON.stringify(proposal)},
          updated_at = NOW()
      `

      return res.status(200).json(proposal)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Proposals API error:', err)
    return res.status(500).json({ error: 'Database error' })
  }
}

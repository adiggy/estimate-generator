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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    if (req.method === 'GET') {
      // Get all proposals (metadata only for dashboard)
      const rows = await sql`
        SELECT id, data, updated_at
        FROM proposals
        ORDER BY updated_at DESC
      `
      const proposals = rows.map(row => {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        return {
          id: row.id,
          clientName: data.clientName,
          projectName: data.projectName,
          date: data.date,
          status: data.status,
          updatedAt: data.updatedAt
        }
      })
      return res.status(200).json(proposals)
    }

    if (req.method === 'POST') {
      const proposal = req.body
      const today = new Date().toISOString().split('T')[0]

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
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

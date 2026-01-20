import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM clients`
      const clients = rows.map(row => typeof row.data === 'string' ? JSON.parse(row.data) : row.data)
      return res.status(200).json(clients)
    }

    if (req.method === 'POST') {
      const client = req.body
      await sql`
        INSERT INTO clients (id, data)
        VALUES (${client.id}, ${JSON.stringify(client)})
        ON CONFLICT (id) DO UPDATE SET data = ${JSON.stringify(client)}
      `
      return res.status(200).json(client)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Clients API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

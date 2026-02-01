import { neon } from '@neondatabase/serverless'
import { requireAuth, setCorsHeaders } from '../../../lib/auth.js'

// GET  /api/proposals/:id/versions → list versions
// POST /api/proposals/:id/versions → save new version

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req)) return res.status(401).json({ error: 'Authentication required' })

  const sql = neon(process.env.DATABASE_URL)
  const { id } = req.query

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT filename, version_name, created_at
        FROM proposal_versions
        WHERE proposal_id = ${id}
        ORDER BY created_at DESC
      `
      const versions = rows.map(row => {
        const parts = row.filename.replace('.json', '').split('_')
        const date = parts[0]
        const hasTime = parts[1] && /^\d{4}$/.test(parts[1])
        const time = hasTime ? parts[1] : null
        let timeDisplay = ''
        if (time) {
          const hours = parseInt(time.slice(0, 2))
          const mins = time.slice(2)
          const ampm = hours >= 12 ? 'PM' : 'AM'
          const hour12 = hours % 12 || 12
          timeDisplay = `${hour12}:${mins} ${ampm}`
        }
        return {
          filename: row.filename, date, time: timeDisplay,
          versionName: row.version_name || row.filename,
          createdAt: row.created_at
        }
      })
      return res.status(200).json(versions)
    }

    if (req.method === 'POST') {
      const { versionName } = req.body
      const proposalRows = await sql`SELECT data FROM proposals WHERE id = ${id}`
      if (proposalRows.length === 0) {
        return res.status(404).json({ error: 'Proposal not found' })
      }
      const proposalData = typeof proposalRows[0].data === 'string'
        ? JSON.parse(proposalRows[0].data) : proposalRows[0].data

      const now = new Date()
      const estDate = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      const estTime = now.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit'
      }).replace(':', '')
      const safeName = versionName
        ? versionName.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-')
        : 'backup'
      const filename = `${estDate}_${estTime}_${safeName}.json`

      await sql`
        INSERT INTO proposal_versions (proposal_id, filename, version_name, data)
        VALUES (${id}, ${filename}, ${versionName || 'backup'}, ${JSON.stringify(proposalData)})
        ON CONFLICT (proposal_id, filename) DO UPDATE SET data = ${JSON.stringify(proposalData)}
      `
      return res.status(200).json({
        success: true, filename, date: estDate, time: estTime,
        versionName: versionName || 'backup'
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Versions API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

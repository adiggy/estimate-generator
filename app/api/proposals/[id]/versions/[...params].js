import { neon } from '@neondatabase/serverless'
import { requireAuth, setCorsHeaders } from '../../../../lib/auth.js'

// GET    /api/proposals/:id/versions/:filename         → get version data
// DELETE /api/proposals/:id/versions/:filename         → delete version
// POST   /api/proposals/:id/versions/:filename/restore → restore version

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req)) return res.status(401).json({ error: 'Authentication required' })

  const sql = neon(process.env.DATABASE_URL)
  const { id, params } = req.query
  const filename = params?.[0] || null
  const action = params?.[1] || null

  if (!filename || !/^[\w\-]+\.json$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  try {
    // POST /versions/:filename/restore
    if (req.method === 'POST' && action === 'restore') {
      const versionRows = await sql`
        SELECT data FROM proposal_versions
        WHERE proposal_id = ${id} AND filename = ${filename}
      `
      if (versionRows.length === 0) {
        return res.status(404).json({ error: 'Version not found' })
      }
      const versionData = typeof versionRows[0].data === 'string'
        ? JSON.parse(versionRows[0].data) : versionRows[0].data
      versionData.updatedAt = new Date().toISOString().split('T')[0]

      await sql`
        UPDATE proposals SET data = ${JSON.stringify(versionData)}, updated_at = NOW()
        WHERE id = ${id}
      `
      try {
        await sql`
          UPDATE proposals_flat
          SET data = ${JSON.stringify(versionData)},
              project_name = ${versionData.projectName || ''},
              client_name = ${versionData.clientName || ''},
              client_company = ${versionData.clientCompany || ''},
              status = ${versionData.status || 'draft'},
              updated_at = NOW()
          WHERE id = ${id}
        `
      } catch (e) { /* proposals_flat may not exist */ }

      return res.status(200).json({ success: true, proposal: versionData })
    }

    // GET /versions/:filename
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM proposal_versions
        WHERE proposal_id = ${id} AND filename = ${filename}
      `
      if (rows.length === 0) return res.status(404).json({ error: 'Version not found' })
      const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
      return res.status(200).json(data)
    }

    // DELETE /versions/:filename
    if (req.method === 'DELETE') {
      const result = await sql`
        DELETE FROM proposal_versions
        WHERE proposal_id = ${id} AND filename = ${filename}
        RETURNING id
      `
      if (result.length === 0) return res.status(404).json({ error: 'Version not found' })
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Version detail API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

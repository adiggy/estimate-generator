import { neon } from '@neondatabase/serverless'
import { requireAuth, setCorsHeaders } from '../../../../../lib/auth.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req)) return res.status(401).json({ error: 'Authentication required' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = neon(process.env.DATABASE_URL)
  const { id, filename } = req.query

  // Validate filename format
  if (!/^[\w\-]+\.json$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  try {
    // Get version data
    const versionRows = await sql`
      SELECT data FROM proposal_versions
      WHERE proposal_id = ${id} AND filename = ${filename}
    `
    if (versionRows.length === 0) {
      return res.status(404).json({ error: 'Version not found' })
    }

    const versionData = typeof versionRows[0].data === 'string'
      ? JSON.parse(versionRows[0].data)
      : versionRows[0].data

    // Update timestamp
    versionData.updatedAt = new Date().toISOString().split('T')[0]

    // Update the proposal in Neon
    await sql`
      UPDATE proposals
      SET data = ${JSON.stringify(versionData)}, updated_at = NOW()
      WHERE id = ${id}
    `

    // Also update the flat proposals table if it exists
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
    } catch (e) {
      // proposals_flat may not exist, that's ok
    }

    return res.status(200).json({ success: true, proposal: versionData })
  } catch (err) {
    console.error('Version restore API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

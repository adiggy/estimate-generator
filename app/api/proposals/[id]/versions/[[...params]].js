import { neon } from '@neondatabase/serverless'
import { requireAuth, setCorsHeaders } from '../../../../lib/auth.js'

// Single catch-all handler for all version operations:
//   GET    /api/proposals/:id/versions              → list versions
//   POST   /api/proposals/:id/versions              → save new version
//   GET    /api/proposals/:id/versions/:filename     → get version data
//   DELETE /api/proposals/:id/versions/:filename     → delete version
//   POST   /api/proposals/:id/versions/:filename/restore → restore version

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!requireAuth(req)) return res.status(401).json({ error: 'Authentication required' })

  const sql = neon(process.env.DATABASE_URL)
  const { id, params } = req.query
  const filename = params?.[0] || null
  const action = params?.[1] || null

  // Validate filename if present
  if (filename && !/^[\w\-]+\.json$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  try {
    // POST /versions/:filename/restore
    if (req.method === 'POST' && filename && action === 'restore') {
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

    // No filename → list or save
    if (!filename) {
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
        const newFilename = `${estDate}_${estTime}_${safeName}.json`

        await sql`
          INSERT INTO proposal_versions (proposal_id, filename, version_name, data)
          VALUES (${id}, ${newFilename}, ${versionName || 'backup'}, ${JSON.stringify(proposalData)})
          ON CONFLICT (proposal_id, filename) DO UPDATE SET data = ${JSON.stringify(proposalData)}
        `
        return res.status(200).json({
          success: true, filename: newFilename, date: estDate, time: estTime,
          versionName: versionName || 'backup'
        })
      }
    }

    // With filename → get or delete
    if (filename && !action) {
      if (req.method === 'GET') {
        const rows = await sql`
          SELECT data FROM proposal_versions
          WHERE proposal_id = ${id} AND filename = ${filename}
        `
        if (rows.length === 0) return res.status(404).json({ error: 'Version not found' })
        const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
        return res.status(200).json(data)
      }

      if (req.method === 'DELETE') {
        const result = await sql`
          DELETE FROM proposal_versions
          WHERE proposal_id = ${id} AND filename = ${filename}
          RETURNING id
        `
        if (result.length === 0) return res.status(404).json({ error: 'Version not found' })
        return res.status(200).json({ success: true })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Versions API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

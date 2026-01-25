/**
 * Google OAuth - Connection Status
 * GET /api/os-beta/auth/google/status
 *
 * Returns whether Google Calendar is connected
 */

import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL)
    const rows = await sql`
      SELECT expires_at, scope, updated_at
      FROM oauth_tokens
      WHERE provider = 'google'
    `

    if (rows.length === 0) {
      return res.json({
        connected: false,
        message: 'Google Calendar not connected',
        authUrl: '/api/os-beta/auth/google'
      })
    }

    const token = rows[0]
    const isExpired = new Date(token.expires_at) < new Date()

    res.json({
      connected: true,
      expired: isExpired,
      expiresAt: token.expires_at,
      scope: token.scope,
      lastUpdated: token.updated_at,
      message: isExpired ? 'Token expired, will refresh on next use' : 'Connected and ready'
    })
  } catch (err) {
    console.error('Status check error:', err)
    res.status(500).json({ error: err.message })
  }
}

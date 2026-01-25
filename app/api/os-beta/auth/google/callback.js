/**
 * Google OAuth - Callback Handler
 * GET /api/os-beta/auth/google/callback
 *
 * Exchanges authorization code for tokens and stores them
 */

import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  const { code, error } = req.query

  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>Authorization Failed</h1>
          <p>Error: ${error}</p>
          <a href="/dashboard/os-beta">Back to OS</a>
        </body>
      </html>
    `)
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return res.status(500).json({ error: 'Google OAuth not configured' })
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error)
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Store tokens in database
    const sql = neon(process.env.DATABASE_URL)
    await sql`
      INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope)
      VALUES ('google', ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt.toISOString()}, ${tokens.scope})
      ON CONFLICT (provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        updated_at = NOW()
    `

    // Success page
    res.send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: #22c55e;">Google Calendar Connected!</h1>
          <p>You can now schedule chunks to your calendar.</p>
          <p style="margin-top: 20px;">
            <a href="/dashboard/os-beta" style="background: #d72027; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
              Back to OS
            </a>
          </p>
        </body>
      </html>
    `)
  } catch (err) {
    console.error('OAuth callback error:', err)
    res.status(500).send(`
      <html>
        <body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1 style="color: #dc2626;">Authorization Failed</h1>
          <p>${err.message}</p>
          <a href="/dashboard/os-beta">Back to OS</a>
        </body>
      </html>
    `)
  }
}

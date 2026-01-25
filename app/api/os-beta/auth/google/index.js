/**
 * Google OAuth - Initiate Authorization
 * GET /api/os-beta/auth/google
 *
 * Redirects to Google's OAuth consent screen
 */

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.'
    })
  }

  // Scopes needed for calendar read/write
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ].join(' ')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')

  res.redirect(authUrl.toString())
}

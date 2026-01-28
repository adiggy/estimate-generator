import crypto from 'crypto';

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
];

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Create a signed session token (stateless - can be verified without storage)
function createSessionToken() {
  const secret = process.env.SESSION_SECRET || process.env.LOGIN_PW;
  const expiresAt = Date.now() + SESSION_DURATION;
  const data = `${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${expiresAt}.${signature}`;
}

// Verify a signed session token
export function verifySessionToken(token) {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET || process.env.LOGIN_PW;
  const [expiresAt, signature] = token.split('.');

  if (!expiresAt || !signature) return false;

  // Check expiration
  if (Date.now() > parseInt(expiresAt)) return false;

  // Verify signature
  const expectedSignature = crypto.createHmac('sha256', secret).update(expiresAt).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // Set CORS headers for allowed origins only
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle logout
  if (req.method === 'POST' && req.url?.includes('/logout')) {
    return res.status(200).json({ success: true });
  }

  // Handle verify
  if (req.method === 'GET' && req.url?.includes('/verify')) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (verifySessionToken(token)) {
      return res.status(200).json({ valid: true });
    }
    return res.status(401).json({ valid: false });
  }

  // Handle login
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin } = req.body;
  const correctPin = process.env.LOGIN_PW;

  // SECURITY: Require LOGIN_PW to be set - no fallback
  if (!correctPin) {
    console.error('LOGIN_PW environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (pin === correctPin) {
    const token = createSessionToken();
    return res.status(200).json({ success: true, token });
  }

  return res.status(401).json({ error: 'Invalid PIN' });
}

import crypto from 'crypto';

// Verify a signed session token
export function verifySessionToken(token) {
  if (!token) return false;
  const secret = process.env.SESSION_SECRET || process.env.LOGIN_PW;
  if (!secret) return false;

  const [expiresAt, signature] = token.split('.');
  if (!expiresAt || !signature) return false;

  // Check expiration
  if (Date.now() > parseInt(expiresAt)) return false;

  // Verify signature
  const expectedSignature = crypto.createHmac('sha256', secret).update(expiresAt).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

// Check authentication from request
export function requireAuth(req) {
  // Allow public view mode
  if (req.query?.view === '1') return true;

  const authHeader = req.headers?.authorization;
  const token = authHeader?.replace('Bearer ', '');
  return verifySessionToken(token);
}

// Allowed origins for CORS
export const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
];

// Set CORS headers
export function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

import crypto from 'crypto';

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
];

const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Simple in-memory rate limiting for serverless
// Note: This works within a single instance; for robust limiting, use Vercel Edge Middleware
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // 5 attempts per window

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const record = rateLimitStore.get(key);

  // Clean up old entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now - v.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

// Create a signed session token (stateless - can be verified without storage)
// SECURITY: Uses AUTH_SECRET (high-entropy) for token signing, not LOGIN_PW
function createSessionToken() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set and be at least 32 characters');
  }
  const expiresAt = Date.now() + SESSION_DURATION;
  const data = `${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${expiresAt}.${signature}`;
}

// Verify a signed session token
export function verifySessionToken(token) {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return false;

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

  // Handle verify - rate limited to prevent token guessing
  if (req.method === 'GET' && req.url?.includes('/verify')) {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    if (verifySessionToken(token)) {
      return res.status(200).json({ valid: true });
    }
    return res.status(401).json({ valid: false });
  }

  // Handle login - rate limited to prevent brute force
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many login attempts. Please try again in 15 minutes.' });
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

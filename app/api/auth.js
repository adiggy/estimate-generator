// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
];

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // Set CORS headers for allowed origins only
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin } = req.body;
  const correctPin = process.env.EDIT_PIN;

  // SECURITY: Require EDIT_PIN to be set - no fallback
  if (!correctPin) {
    console.error('EDIT_PIN environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (pin === correctPin) {
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid PIN' });
}

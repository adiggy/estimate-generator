const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
require('dotenv').config();

// OS database utilities
const db = require('./scripts/lib/db');

const app = express();
const PORT = 3002;

const DATA_DIR = path.join(__dirname, 'data');
const PROPOSALS_DIR = path.join(DATA_DIR, 'proposals');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

// App URL for redirects (defaults to localhost for development)
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

// =============================================================================
// RATE LIMITING
// =============================================================================

// Strict rate limit for auth endpoint (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// =============================================================================
// INPUT VALIDATION SCHEMAS (Zod)
// =============================================================================

const schemas = {
  // Auth
  auth: z.object({
    pin: z.string().min(1, 'PIN is required'),
  }),

  // Client
  client: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    company: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),

  // Proposal
  proposal: z.object({
    id: z.string().optional(),
    projectName: z.string().min(1, 'Project name is required'),
    clientName: z.string().min(1, 'Client name is required'),
    clientCompany: z.string().optional(),
    projectType: z.string().optional(),
    status: z.enum(['draft', 'sent', 'accepted', 'declined']).optional(),
    phases: z.array(z.any()).optional(),
  }).passthrough(), // Allow additional fields

  // Project
  project: z.object({
    id: z.string().optional(),
    client_id: z.string().min(1, 'Client ID is required'),
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    status: z.enum(['active', 'waiting_on', 'paused', 'done', 'invoiced', 'archived']).optional(),
    priority: z.number().int().min(-2).max(1).optional(),
    billing_type: z.enum(['hourly', 'fixed', 'retainer']).optional(),
    rate: z.number().int().nonnegative().optional(),
  }).passthrough(),

  // Chunk
  chunk: z.object({
    id: z.string().optional(),
    project_id: z.string().min(1, 'Project ID is required'),
    phase_name: z.string().optional(),
    name: z.string().min(1, 'Chunk name is required'),
    description: z.string().optional(),
    hours: z.number().positive().optional(),
    status: z.enum(['pending', 'scheduled', 'in_progress', 'done']).optional(),
  }).passthrough(),

  // Time log
  timeLog: z.object({
    id: z.string().optional(),
    project_id: z.string().min(1, 'Project ID is required'),
    chunk_id: z.string().optional().nullable(),
    description: z.string().optional(),
    hours: z.number().positive().optional(),
    date: z.string().optional(),
    status: z.enum(['active', 'paused', 'stopped', 'finalized']).optional(),
  }).passthrough(),

  // Invoice
  invoice: z.object({
    id: z.string().optional(),
    client_id: z.string().min(1, 'Client ID is required'),
    project_id: z.string().optional().nullable(),
    total: z.number().int().nonnegative(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
    line_items: z.array(z.any()).optional(),
  }).passthrough(),

  // Stripe charge
  stripeCharge: z.object({
    clientId: z.string().min(1, 'Client ID is required'),
    amount: z.number().int().positive('Amount must be positive'),
    description: z.string().optional(),
  }),
};

// Validation middleware factory
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(err);
    }
  };
}

// =============================================================================
// SESSION-BASED AUTHENTICATION
// =============================================================================

const crypto = require('crypto');

// Stateless HMAC token authentication (survives server restarts)
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// SECURITY: Require separate high-entropy secret for token signing
// LOGIN_PW is the human PIN, AUTH_SECRET is the crypto key
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  console.error('FATAL: AUTH_SECRET environment variable must be set and be at least 32 characters');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

// OAuth state storage (short-lived, in-memory)
const oauthStateStore = new Map();
const OAUTH_STATE_TTL = 10 * 60 * 1000; // 10 minutes

function createSession() {
  const expiresAt = Date.now() + SESSION_DURATION;
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(String(expiresAt))
    .digest('hex');
  return `${expiresAt}.${signature}`;
}

function validateSession(token) {
  if (!token) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiresAt, signature] = parts;
  const expiresAtNum = parseInt(expiresAt, 10);

  // Check if expired
  if (isNaN(expiresAtNum) || Date.now() > expiresAtNum) {
    return false;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(expiresAt)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

function destroySession(token) {
  // Stateless tokens can't be invalidated server-side
  // Client should just delete the token from localStorage
  // For true logout, would need a blocklist (not implemented)
}

// Authentication middleware
// SECURITY: No bypass except for OAuth browser redirects which can't include headers
function requireAuth(req, res, next) {
  // Allow OAuth browser redirect flow (these can't include auth headers)
  // Only allow the initiate and callback routes, not other auth routes
  // Use originalUrl since req.path may be relative when using app.use() mounting
  const fullPath = req.originalUrl.split('?')[0]; // Remove query string
  if (fullPath.match(/^\/api\/os-beta\/auth\/google(\/callback)?$/)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!validateSession(token)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
}

// HTML escape helper to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Validate file path parameter to prevent path traversal
function isValidPathParam(param) {
  if (!param || typeof param !== 'string') return false;
  // Only allow alphanumeric, hyphens, and underscores
  return /^[a-zA-Z0-9_-]+$/.test(param);
}

// CORS - restrict to allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3002',
  'https://adesigns-estimate.vercel.app',
  'https://adrialdesigns.com'
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

// Auth endpoint with strict rate limiting
app.post('/api/auth', authLimiter, validate(schemas.auth), (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.LOGIN_PW;

  // SECURITY: Require LOGIN_PW to be set - no fallback
  if (!correctPin) {
    console.error('LOGIN_PW environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (pin === correctPin) {
    const token = createSession();
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid PIN' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (token) {
    destroySession(token);
  }
  res.json({ success: true });
});

// Verify session endpoint - rate limited to prevent brute-force token guessing
app.get('/api/auth/verify', authLimiter, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  if (validateSession(token)) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

// =============================================================================
// PUBLIC API ROUTES - No authentication required
// =============================================================================

// Public read-only proposal view (for client links)
// Only returns the proposal data needed for viewing, no sensitive metadata
app.get('/api/public/proposals/:id', (req, res) => {
  try {
    // SECURITY: Validate path parameter to prevent path traversal
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!filePath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // Return proposal data (already public-facing content)
      res.json(data);
    } else {
      res.status(404).json({ error: 'Proposal not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read proposal' });
  }
});

// =============================================================================
// PROTECTED API ROUTES - Require authentication
// =============================================================================
// Apply auth middleware to all routes below this point
app.use('/api/clients', requireAuth);
app.use('/api/templates', requireAuth);
app.use('/api/proposals', requireAuth);
app.use('/api/os-beta', requireAuth);

// Get all clients
app.get('/api/clients', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
    res.json(data.clients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read clients' });
  }
});

// Get single client
app.get('/api/clients/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
    const client = data.clients.find(c => c.id === req.params.id);
    if (client) {
      res.json(client);
    } else {
      res.status(404).json({ error: 'Client not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read client' });
  }
});

// Create/update client
app.post('/api/clients', validate(schemas.client), (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
    const existingIndex = data.clients.findIndex(c => c.id === req.body.id);
    if (existingIndex >= 0) {
      data.clients[existingIndex] = req.body;
    } else {
      data.clients.push(req.body);
    }
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(data, null, 2));
    res.json(req.body);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save client' });
  }
});

// Get all templates
app.get('/api/templates', (req, res) => {
  try {
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8'));
      return data;
    });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read templates' });
  }
});

// Get single template by type
app.get('/api/templates/:type', (req, res) => {
  try {
    // SECURITY: Validate path parameter to prevent path traversal
    if (!isValidPathParam(req.params.type)) {
      return res.status(400).json({ error: 'Invalid template type' });
    }
    const filePath = path.join(TEMPLATES_DIR, `${req.params.type}.json`);
    // Double-check the resolved path is within TEMPLATES_DIR
    if (!filePath.startsWith(TEMPLATES_DIR)) {
      return res.status(400).json({ error: 'Invalid template path' });
    }
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read template' });
  }
});

// Get all proposals (metadata only for dashboard)
app.get('/api/proposals', (req, res) => {
  try {
    const files = fs.readdirSync(PROPOSALS_DIR).filter(f => f.endsWith('.json'));
    const proposals = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(PROPOSALS_DIR, file), 'utf8'));
      return {
        id: data.id,
        clientName: data.clientName,
        projectName: data.projectName,
        date: data.date,
        status: data.status,
        updatedAt: data.updatedAt
      };
    });
    // Sort by date descending
    proposals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json(proposals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read proposals' });
  }
});

// Get single proposal
app.get('/api/proposals/:id', (req, res) => {
  try {
    // SECURITY: Validate path parameter to prevent path traversal
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!filePath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'Proposal not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to read proposal' });
  }
});

// Create new proposal
app.post('/api/proposals', (req, res) => {
  try {
    const proposal = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Generate ID if not provided
    if (!proposal.id) {
      const slug = proposal.projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 30);
      proposal.id = `${today}-${slug}`;
    }

    // SECURITY: Validate generated/provided ID
    if (!isValidPathParam(proposal.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID format' });
    }

    proposal.createdAt = proposal.createdAt || today;
    proposal.updatedAt = today;
    proposal.status = proposal.status || 'draft';

    const filePath = path.join(PROPOSALS_DIR, `${proposal.id}.json`);
    if (!filePath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2));
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// Update proposal
app.put('/api/proposals/:id', async (req, res) => {
  try {
    // SECURITY: Validate path parameter to prevent path traversal
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!filePath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }
    const proposal = req.body;
    proposal.updatedAt = new Date().toISOString().split('T')[0];

    // Save to local file
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2));

    // Also sync to Neon database (both tables)
    try {
      await db.query(
        `UPDATE proposals SET data = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(proposal), req.params.id]
      );
      await db.query(
        `UPDATE os_beta_proposals SET data = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(proposal), req.params.id]
      );
    } catch (dbErr) {
      console.error('Failed to sync proposal to Neon:', dbErr);
      // Continue anyway - local file is saved
    }

    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// Delete proposal
app.delete('/api/proposals/:id', (req, res) => {
  try {
    // SECURITY: Validate path parameter to prevent path traversal
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!filePath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Proposal not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

// ============================================================================
// PROPOSAL VERSIONING
// ============================================================================

// Save a version of a proposal
app.post('/api/proposals/:id/versions', (req, res) => {
  try {
    // SECURITY: Validate path parameter
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    const { versionName } = req.body;
    const proposalPath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!proposalPath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }

    if (!fs.existsSync(proposalPath)) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
    const archivePath = proposal.archivePath || `archive/${req.params.id}`;
    const versionsDir = path.join(__dirname, archivePath, 'versions');

    // Create versions directory if needed
    if (!fs.existsSync(versionsDir)) {
      fs.mkdirSync(versionsDir, { recursive: true });
    }

    // Generate filename with date and time (EST)
    const now = new Date();
    const estDate = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
    const estTime = now.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    }).replace(':', ''); // HHMM
    const safeName = versionName
      ? versionName.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-')
      : 'backup';
    const filename = `${estDate}_${estTime}_${safeName}.json`;
    const filepath = path.join(versionsDir, filename);

    // Save version
    fs.writeFileSync(filepath, JSON.stringify(proposal, null, 2));

    res.json({
      success: true,
      filename,
      path: filepath,
      date: estDate,
      time: estTime,
      versionName: versionName || 'backup'
    });
  } catch (err) {
    console.error('Version save error:', err);
    res.status(500).json({ error: 'Failed to save version' });
  }
});

// List versions of a proposal
app.get('/api/proposals/:id/versions', (req, res) => {
  try {
    // SECURITY: Validate path parameter
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    const proposalPath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!proposalPath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }

    if (!fs.existsSync(proposalPath)) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
    const archivePath = proposal.archivePath || `archive/${req.params.id}`;
    const versionsDir = path.join(__dirname, archivePath, 'versions');

    if (!fs.existsSync(versionsDir)) {
      return res.json([]);
    }

    const files = fs.readdirSync(versionsDir)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const parts = filename.replace('.json', '').split('_');
        const date = parts[0];
        // Check if second part is a time (4 digits) or part of the name
        const hasTime = parts[1] && /^\d{4}$/.test(parts[1]);
        const time = hasTime ? parts[1] : null;
        const nameParts = hasTime ? parts.slice(2) : parts.slice(1);
        const stats = fs.statSync(path.join(versionsDir, filename));

        // Format time for display (HHMM -> HH:MM AM/PM)
        let timeDisplay = '';
        if (time) {
          const hours = parseInt(time.slice(0, 2));
          const mins = time.slice(2);
          const ampm = hours >= 12 ? 'PM' : 'AM';
          const hour12 = hours % 12 || 12;
          timeDisplay = `${hour12}:${mins} ${ampm}`;
        }

        return {
          filename,
          date,
          time: timeDisplay,
          versionName: nameParts.join('_').replace(/-/g, ' '),
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(files);
  } catch (err) {
    console.error('Version list error:', err);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// Get a specific version
app.get('/api/proposals/:id/versions/:filename', (req, res) => {
  try {
    // SECURITY: Validate path parameters
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    // Filename validation: allow date_time_name.json format
    if (!/^[\w\-]+\.json$/.test(req.params.filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const proposalPath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!proposalPath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }

    if (!fs.existsSync(proposalPath)) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
    const archivePath = proposal.archivePath || `archive/${req.params.id}`;
    const versionsDir = path.resolve(__dirname, archivePath, 'versions');
    const versionPath = path.join(versionsDir, req.params.filename);
    // Verify resolved path is within versions directory
    if (!versionPath.startsWith(versionsDir)) {
      return res.status(400).json({ error: 'Invalid version path' });
    }

    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    res.json(versionData);
  } catch (err) {
    console.error('Version get error:', err);
    res.status(500).json({ error: 'Failed to get version' });
  }
});

// Delete a version
app.delete('/api/proposals/:id/versions/:filename', (req, res) => {
  try {
    // SECURITY: Validate path parameters
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    // Filename validation: allow date_time_name.json format
    if (!/^[\w\-]+\.json$/.test(req.params.filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const proposalPath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!proposalPath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }

    if (!fs.existsSync(proposalPath)) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
    const archivePath = proposal.archivePath || `archive/${req.params.id}`;
    const versionsDir = path.resolve(__dirname, archivePath, 'versions');
    const versionPath = path.join(versionsDir, req.params.filename);
    // Verify resolved path is within versions directory
    if (!versionPath.startsWith(versionsDir)) {
      return res.status(400).json({ error: 'Invalid version path' });
    }

    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({ error: 'Version not found' });
    }

    fs.unlinkSync(versionPath);
    res.json({ success: true });
  } catch (err) {
    console.error('Version delete error:', err);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// Restore a version (overwrites current proposal)
app.post('/api/proposals/:id/versions/:filename/restore', async (req, res) => {
  try {
    // SECURITY: Validate path parameters
    if (!isValidPathParam(req.params.id)) {
      return res.status(400).json({ error: 'Invalid proposal ID' });
    }
    // Filename validation: allow date_time_name.json format
    if (!/^[\w\-]+\.json$/.test(req.params.filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const proposalPath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    if (!proposalPath.startsWith(PROPOSALS_DIR)) {
      return res.status(400).json({ error: 'Invalid proposal path' });
    }

    if (!fs.existsSync(proposalPath)) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
    const archivePath = proposal.archivePath || `archive/${req.params.id}`;
    const versionsDir = path.resolve(__dirname, archivePath, 'versions');
    const versionPath = path.join(versionsDir, req.params.filename);
    // Verify resolved path is within versions directory
    if (!versionPath.startsWith(versionsDir)) {
      return res.status(400).json({ error: 'Invalid version path' });
    }

    if (!fs.existsSync(versionPath)) {
      return res.status(404).json({ error: 'Version not found' });
    }

    const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));

    // Update the timestamp
    versionData.updatedAt = new Date().toISOString().split('T')[0];

    // Save as current proposal (local file)
    fs.writeFileSync(proposalPath, JSON.stringify(versionData, null, 2));

    // Also sync to Neon database (both tables)
    try {
      await db.query(
        `UPDATE proposals SET data = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(versionData), req.params.id]
      );
      await db.query(
        `UPDATE os_beta_proposals SET data = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(versionData), req.params.id]
      );
    } catch (dbErr) {
      console.error('Failed to sync restored version to Neon:', dbErr);
      // Continue anyway - local file is restored
    }

    res.json({ success: true, proposal: versionData });
  } catch (err) {
    console.error('Version restore error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// ============================================================================
// OS BETA API ROUTES
// ============================================================================

// Projects
app.get('/api/os-beta/projects', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      clientId: req.query.client_id,
      billingPlatform: req.query.billing_platform,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };
    const projects = await db.getProjects(filters);
    res.json(projects);
  } catch (err) {
    console.error('Projects error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/os-beta/projects', async (req, res) => {
  try {
    const project = await db.createProject(req.body);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/os-beta/projects/:id', async (req, res) => {
  try {
    const project = await db.getProject(req.params.id);
    if (project) {
      res.json(project);
    } else {
      res.status(404).json({ error: 'Project not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/os-beta/projects/:id', async (req, res) => {
  try {
    const project = await db.updateProject(req.params.id, req.body);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/os-beta/projects/:id', async (req, res) => {
  try {
    await db.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chunks
app.get('/api/os-beta/chunks', async (req, res) => {
  try {
    const projectId = req.query.project_id;
    const options = { status: req.query.status };
    const chunks = await db.getChunks(projectId, options);
    res.json(chunks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/os-beta/chunks', async (req, res) => {
  try {
    const chunk = await db.createChunk(req.body);
    res.json(chunk);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/os-beta/chunks/:id', async (req, res) => {
  try {
    const chunk = await db.getChunk(req.params.id);
    if (chunk) {
      res.json(chunk);
    } else {
      res.status(404).json({ error: 'Chunk not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/os-beta/chunks/:id', async (req, res) => {
  try {
    const chunk = await db.updateChunk(req.params.id, req.body);
    res.json(chunk);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/os-beta/chunks/:id', async (req, res) => {
  try {
    await db.deleteChunk(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Time Logs
app.get('/api/os-beta/time-logs', async (req, res) => {
  try {
    // Special case: find running timer
    if (req.query.running === 'true') {
      const logs = await db.getTimeLogs({});
      const running = logs.find(log => log.started_at && !log.ended_at);
      res.json(running || null);
      return;
    }

    const filters = {
      projectId: req.query.project_id,
      invoiced: req.query.invoiced === 'true' ? true : req.query.invoiced === 'false' ? false : undefined
    };

    // If fetching unbilled time for a specific project, use the getUnbilledTime function
    // which includes project_rate and only finalized entries with duration_minutes
    if (filters.projectId && filters.invoiced === false) {
      const unbilledData = await db.getUnbilledTime(filters.projectId);
      res.json(unbilledData); // Returns { logs, totalMinutes, totalAmount }
      return;
    }

    const logs = await db.getTimeLogs(filters);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/os-beta/time-logs', async (req, res) => {
  try {
    const data = {
      ...req.body,
      id: req.body.id || db.generateId(),
      started_at: req.body.started_at || new Date().toISOString()
    };
    const log = await db.createTimeLog(data);
    res.json(log);
  } catch (err) {
    console.error('Create time log error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/os-beta/time-logs/:id', async (req, res) => {
  try {
    const log = await db.getTimeLog(req.params.id);
    if (log) {
      res.json(log);
    } else {
      res.status(404).json({ error: 'Time log not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/os-beta/time-logs/:id', async (req, res) => {
  try {
    const { action } = req.body;
    const id = req.params.id;

    // Get current timer state
    const current = await db.getTimeLog(id);
    if (!current) {
      return res.status(404).json({ error: 'Time log not found' });
    }

    // Handle timer actions
    if (action === 'pause') {
      // Calculate accumulated time and pause
      let accumulated = current.accumulated_seconds || 0;
      if (current.last_resumed_at) {
        const sessionSeconds = Math.floor((Date.now() - new Date(current.last_resumed_at).getTime()) / 1000);
        accumulated += sessionSeconds;
      }
      await db.sql`
        UPDATE time_logs
        SET status = 'paused',
            accumulated_seconds = ${accumulated},
            last_resumed_at = NULL,
            updated_at = NOW()
        WHERE id = ${id}
      `;
      const updated = await db.getTimeLog(id);
      return res.json(updated);
    }

    if (action === 'resume') {
      await db.sql`
        UPDATE time_logs
        SET status = 'active',
            last_resumed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}
      `;
      const updated = await db.getTimeLog(id);
      return res.json(updated);
    }

    if (action === 'stop' || req.body.stop) {
      // Calculate total accumulated time
      let accumulated = current.accumulated_seconds || 0;
      if (current.status === 'active' && current.last_resumed_at) {
        const sessionSeconds = Math.floor((Date.now() - new Date(current.last_resumed_at).getTime()) / 1000);
        accumulated += sessionSeconds;
      }
      await db.sql`
        UPDATE time_logs
        SET status = 'draft',
            accumulated_seconds = ${accumulated},
            last_resumed_at = NULL,
            updated_at = NOW()
        WHERE id = ${id}
      `;
      const updated = await db.getTimeLog(id);
      return res.json(updated);
    }

    if (action === 'set_time') {
      // Manually set the accumulated time (for editing timer while running)
      const newSeconds = req.body.accumulated_seconds || 0;
      // Reset last_resumed_at to now so the timer continues from this new base
      await db.sql`
        UPDATE time_logs
        SET accumulated_seconds = ${newSeconds},
            last_resumed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}
      `;
      const updated = await db.getTimeLog(id);
      return res.json(updated);
    }

    if (action === 'finalize') {
      // Calculate duration in minutes and round UP to nearest 15 minutes
      const accumulated = current.accumulated_seconds || 0;
      const rawMinutes = accumulated / 60;
      const durationMinutes = Math.ceil(rawMinutes / 15) * 15; // Round up to nearest 15
      await db.sql`
        UPDATE time_logs
        SET status = 'finalized',
            ended_at = NOW(),
            duration_minutes = ${durationMinutes},
            updated_at = NOW()
        WHERE id = ${id}
      `;
      const updated = await db.getTimeLog(id);
      return res.json(updated);
    }

    // Default: update fields directly
    const log = await db.updateTimeLog(id, req.body);
    res.json(log);
  } catch (err) {
    console.error('Update time log error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/os-beta/time-logs/:id', async (req, res) => {
  try {
    await db.deleteTimeLog(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invoices
app.get('/api/os-beta/invoices', async (req, res) => {
  try {
    const filters = {
      clientId: req.query.client_id,
      status: req.query.status
    };
    const invoices = await db.getInvoices(filters);
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/os-beta/invoices', async (req, res) => {
  try {
    // Generate ID if not provided
    const invoiceData = {
      ...req.body,
      id: req.body.id || db.generateId('inv')
    };
    const invoice = await db.createInvoice(invoiceData);

    // Mark the associated time logs as invoiced
    if (req.body.time_log_ids && req.body.time_log_ids.length > 0) {
      await db.markTimeLogsInvoiced(req.body.time_log_ids, invoice.id);
    }

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/os-beta/invoices/:id', async (req, res) => {
  try {
    const invoice = await db.getInvoice(req.params.id);
    if (invoice) {
      res.json(invoice);
    } else {
      res.status(404).json({ error: 'Invoice not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/os-beta/invoices/:id', async (req, res) => {
  try {
    const { time_log_ids, ...updateData } = req.body;
    const invoice = await db.updateInvoice(req.params.id, updateData);

    // If time_log_ids provided, mark them as invoiced
    if (time_log_ids && time_log_ids.length > 0) {
      await db.markTimeLogsInvoiced(time_log_ids, req.params.id);
    }

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/os-beta/invoices/:id', async (req, res) => {
  try {
    await db.deleteInvoice(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats
app.get('/api/os-beta/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search
app.get('/api/os-beta/search', async (req, res) => {
  try {
    const results = await db.search(req.query.q || '');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Feedback
app.get('/api/os-beta/feedback', async (req, res) => {
  try {
    const items = await db.getFeedback();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/os-beta/feedback', async (req, res) => {
  try {
    const { text, image } = req.body;
    if (!text && !image) {
      return res.status(400).json({ error: 'Text or image is required' });
    }
    const item = await db.createFeedback(text || '(screenshot)', image);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/os-beta/feedback/:id', async (req, res) => {
  try {
    await db.deleteFeedback(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/os-beta/feedback', async (req, res) => {
  try {
    await db.deleteAllFeedback();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OS Proposals - FIREWALLED: fetches from os_beta_proposals table (separate from live)
app.get('/api/os-beta/proposals', async (req, res) => {
  try {
    const rows = await db.sql`
      SELECT id, data, created_at, updated_at
      FROM os_beta_proposals
      ORDER BY updated_at DESC
    `;
    const proposals = rows.map(row => {
      const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
      return {
        id: row.id,
        projectName: data.projectName,
        clientName: data.clientName || data.clientCompany,
        clientId: data.clientId,
        status: data.status,
        date: data.date,
        phases: data.phases,
        totalLowHrs: data.phases?.reduce((sum, p) => sum + (p.lowHrs || 0), 0) || 0,
        totalHighHrs: data.phases?.reduce((sum, p) => sum + (p.highHrs || 0), 0) || 0,
        updated_at: row.updated_at
      };
    });
    res.json(proposals);
  } catch (err) {
    console.error('Get proposals error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single proposal from OS Beta (firewalled)
app.get('/api/os-beta/proposals/:id', async (req, res) => {
  try {
    const rows = await db.sql`
      SELECT id, data, created_at, updated_at
      FROM os_beta_proposals
      WHERE id = ${req.params.id}
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const row = rows[0];
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    res.json({ id: row.id, ...data });
  } catch (err) {
    console.error('Get proposal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update proposal in OS Beta (now syncs to both tables since merger)
app.put('/api/os-beta/proposals/:id', async (req, res) => {
  try {
    const proposal = req.body;
    // Update both tables to keep them in sync
    await db.sql`
      UPDATE os_beta_proposals
      SET data = ${JSON.stringify(proposal)}::jsonb,
          updated_at = NOW()
      WHERE id = ${req.params.id}
    `;
    await db.sql`
      UPDATE proposals
      SET data = ${JSON.stringify(proposal)}::jsonb,
          updated_at = NOW()
      WHERE id = ${req.params.id}
    `;
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('Update proposal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete proposal from OS Beta (now syncs to both tables since merger)
app.delete('/api/os-beta/proposals/:id', async (req, res) => {
  try {
    await db.sql`DELETE FROM os_beta_proposals WHERE id = ${req.params.id}`;
    await db.sql`DELETE FROM proposals WHERE id = ${req.params.id}`;
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    console.error('Delete proposal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Convert proposal to project with chunks (reads from os_beta_proposals)
app.post('/api/os-beta/proposals/:id/convert', async (req, res) => {
  try {
    // Get the proposal from OS Beta table (firewalled from live)
    const rows = await db.sql`SELECT data FROM os_beta_proposals WHERE id = ${req.params.id}`;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const proposal = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;

    // Create project ID from proposal
    const projectId = db.slugify(`${proposal.clientId}-${proposal.projectName}`).substring(0, 60);

    // Check if project already exists
    const existingProject = await db.getProject(projectId);
    if (existingProject) {
      return res.status(400).json({ error: 'Project already exists', projectId });
    }

    // Calculate budget from phases
    const totalLowHrs = proposal.phases?.reduce((sum, p) => sum + (p.lowHrs || 0), 0) || 0;
    const totalHighHrs = proposal.phases?.reduce((sum, p) => sum + (p.highHrs || 0), 0) || 0;
    const rate = 12000; // $120/hr in cents

    // Create the project
    const project = await db.createProject({
      id: projectId,
      client_id: proposal.clientId,
      proposal_id: req.params.id,
      name: proposal.projectName,
      description: proposal.projectDescription,
      status: 'active',
      priority: 0,
      billing_type: 'fixed',
      billing_platform: 'os',
      budget_low: totalLowHrs * rate,
      budget_high: totalHighHrs * rate,
      rate: rate,
      notes: `Converted from proposal ${req.params.id}`,
      tags: ['from-proposal']
    });

    // Create chunks from phases
    const chunks = [];
    let phaseOrder = 0;
    for (const phase of (proposal.phases || [])) {
      if (phase.optional) continue;

      const avgHours = Math.round((phase.lowHrs + phase.highHrs) / 2);
      const chunkSizes = [];
      let remaining = avgHours;

      // Break into 1-3 hour chunks
      while (remaining > 0) {
        if (remaining >= 6) {
          chunkSizes.push(3);
          remaining -= 3;
        } else if (remaining >= 4) {
          chunkSizes.push(2);
          remaining -= 2;
        } else if (remaining === 3) {
          chunkSizes.push(3);
          remaining = 0;
        } else if (remaining === 2) {
          chunkSizes.push(2);
          remaining = 0;
        } else {
          chunkSizes.push(1);
          remaining = 0;
        }
      }

      // Create chunk entries
      for (let i = 0; i < chunkSizes.length; i++) {
        const chunkName = chunkSizes.length === 1
          ? phase.name
          : `${phase.name} (Part ${i + 1}/${chunkSizes.length})`;

        const chunk = await db.createChunk({
          id: db.generateId('chk'),
          project_id: projectId,
          phase_name: phase.name,
          phase_order: phaseOrder,
          name: chunkName,
          description: i === 0 ? phase.description : `Continuation of ${phase.name}`,
          hours: chunkSizes[i]
        });
        chunks.push(chunk);
      }
      phaseOrder++;
    }

    // NOTE: NOT updating proposal status - maintain firewall between OS-beta and live proposals
    // The project now exists independently in the projects table

    res.json({
      project,
      chunks,
      message: `Created project with ${chunks.length} chunks`
    });
  } catch (err) {
    console.error('Convert proposal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// GOOGLE OAUTH ROUTES
// ============================================================================

// Initiate Google OAuth
app.get('/api/os-beta/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.'
    });
  }

  // SECURITY: Generate random state to prevent CSRF attacks
  const state = crypto.randomBytes(32).toString('hex');
  oauthStateStore.set(state, { createdAt: Date.now() });

  // Clean up expired states
  const now = Date.now();
  for (const [key, value] of oauthStateStore.entries()) {
    if (now - value.createdAt > OAUTH_STATE_TTL) {
      oauthStateStore.delete(key);
    }
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// Google OAuth callback
app.get('/api/os-beta/auth/google/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Authorization Failed</h1><p>Error: ${escapeHtml(error)}</p>
        <a href="${APP_URL}/schedule">Back to OS</a>
      </body></html>
    `);
  }

  // SECURITY: Validate state parameter to prevent CSRF
  if (!state || !oauthStateStore.has(state)) {
    return res.status(400).send(`
      <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Authorization Failed</h1><p>Invalid or expired state parameter. Please try again.</p>
        <a href="${APP_URL}/schedule">Back to OS</a>
      </body></html>
    `);
  }

  // Check if state has expired
  const storedState = oauthStateStore.get(state);
  if (Date.now() - storedState.createdAt > OAUTH_STATE_TTL) {
    oauthStateStore.delete(state);
    return res.status(400).send(`
      <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Authorization Failed</h1><p>Authorization request expired. Please try again.</p>
        <a href="${APP_URL}/schedule">Back to OS</a>
      </body></html>
    `);
  }

  // Delete state after validation (one-time use)
  oauthStateStore.delete(state);

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  try {
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
    });

    const tokens = await tokenResponse.json();
    // SECURITY: Do not log tokens - they contain sensitive credentials
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await db.sql`
      INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope)
      VALUES ('google', ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt.toISOString()}, ${tokens.scope})
      ON CONFLICT (provider) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, oauth_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        updated_at = NOW()
    `;

    res.send(`
      <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1 style="color: #22c55e;">Google Calendar Connected!</h1>
        <p>You can now schedule chunks to your calendar.</p>
        <p style="margin-top: 20px;">
          <a href="${APP_URL}/schedule" style="background: #d72027; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            Back to OS
          </a>
        </p>
      </body></html>
    `);
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send(`
      <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1 style="color: #dc2626;">Authorization Failed</h1>
        <p>${escapeHtml(err.message)}</p>
        <a href="${APP_URL}/schedule">Back to OS</a>
      </body></html>
    `);
  }
});

// Google OAuth status
app.get('/api/os-beta/auth/google/status', async (req, res) => {
  try {
    const rows = await db.sql`
      SELECT expires_at, scope, updated_at
      FROM oauth_tokens
      WHERE provider = 'google'
    `;

    if (rows.length === 0) {
      return res.json({
        connected: false,
        message: 'Google Calendar not connected',
        authUrl: '/api/os-beta/auth/google'
      });
    }

    const token = rows[0];
    const isExpired = new Date(token.expires_at) < new Date();

    res.json({
      connected: true,
      expired: isExpired,
      expiresAt: token.expires_at,
      scope: token.scope,
      lastUpdated: token.updated_at,
      message: isExpired ? 'Token expired, will refresh on next use' : 'Connected and ready'
    });
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Schedule - Get current draft
app.get('/api/os-beta/schedule/draft', async (req, res) => {
  try {
    const rows = await db.sql`
      SELECT * FROM schedule_drafts
      WHERE status = 'draft'
      ORDER BY generated_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No draft schedule found' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule - Get draft chunks
app.get('/api/os-beta/schedule/draft/chunks', async (req, res) => {
  try {
    const rows = await db.sql`
      SELECT c.*, p.name as project_name, p.client_id, p.priority
      FROM chunks c
      JOIN projects p ON c.project_id = p.id
      WHERE c.draft_scheduled_start IS NOT NULL
      ORDER BY c.draft_order ASC
    `;
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule - Generate draft with INTERLEAVED scheduling
// Features:
// - Configurable start date (defaults to today or next Monday)
// - Work hours: 12:00 PM - 7:30 PM
// - 1-hour lunch break at 3:00 PM
// - Calendar "rocks" - avoids existing Google Calendar events
// - Round-robin through all active projects so each gets equal progress
app.post('/api/os-beta/schedule/generate', async (req, res) => {
  try {
    const WORK_START_HOUR = 12  // 12:00 PM
    const WORK_END_HOUR = 20    // 8:00 PM (slot math, actual end ~7:30)
    const MAX_HOURS_PER_DAY = 7 // ~7 schedulable hours per day

    // Get configurable start date from request body
    let startDate
    if (req.body.startDate) {
      startDate = new Date(req.body.startDate)
      startDate.setHours(WORK_START_HOUR, 0, 0, 0)
    } else {
      // Default to today if it's a weekday, otherwise next Monday
      const now = new Date()
      const dayOfWeek = now.getDay()
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Today is a weekday, start today
        startDate = new Date(now)
        startDate.setHours(WORK_START_HOUR, 0, 0, 0)
      } else {
        // Weekend, start next Monday
        const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
        startDate = new Date(now)
        startDate.setDate(now.getDate() + daysUntilMonday)
        startDate.setHours(WORK_START_HOUR, 0, 0, 0)
      }
    }

    // Get pending chunks grouped by project, ordered within each project
    const allChunks = await db.sql`
      SELECT c.*, p.name as project_name, p.client_id, p.priority, p.last_touched_at
      FROM chunks c
      JOIN projects p ON c.project_id = p.id
      WHERE c.status = 'pending' AND p.status = 'active'
      ORDER BY p.priority DESC, p.last_touched_at DESC NULLS LAST, c.phase_order ASC NULLS LAST, c.draft_order ASC NULLS LAST
    `

    if (allChunks.length === 0) {
      return res.status(400).json({ error: 'No pending chunks to schedule' })
    }

    // Calculate total hours and weeks needed
    const totalHoursNeeded = allChunks.reduce((sum, c) => sum + c.hours, 0)
    const hoursPerWeek = MAX_HOURS_PER_DAY * 5
    const weeksNeeded = Math.ceil(totalHoursNeeded / hoursPerWeek) + 1

    // End date for calendar fetch
    const endDateForCalendar = new Date(startDate)
    endDateForCalendar.setDate(startDate.getDate() + (weeksNeeded * 7))
    endDateForCalendar.setHours(23, 59, 59, 999)

    // Fetch calendar rocks (existing events to avoid)
    let rocks = []
    let rocksAvoided = 0
    try {
      const tokenRows = await db.sql`SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = 'google'`
      if (tokenRows.length > 0) {
        let accessToken = tokenRows[0].access_token
        const expiresAt = new Date(tokenRows[0].expires_at)

        // Refresh token if expired
        if (expiresAt < new Date() && tokenRows[0].refresh_token) {
          const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.GOOGLE_CLIENT_SECRET,
              refresh_token: tokenRows[0].refresh_token,
              grant_type: 'refresh_token'
            })
          })
          const refreshed = await refreshRes.json()
          if (refreshed.access_token) {
            accessToken = refreshed.access_token
            const newExpires = new Date(Date.now() + refreshed.expires_in * 1000)
            await db.sql`UPDATE oauth_tokens SET access_token = ${accessToken}, expires_at = ${newExpires.toISOString()}, updated_at = NOW() WHERE provider = 'google'`
          }
        }

        // Fetch events from reference calendar
        const calendarId = process.env.GOOGLE_REFERENCE_CALENDAR_ID || 'primary'
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
        url.searchParams.set('timeMin', startDate.toISOString())
        url.searchParams.set('timeMax', endDateForCalendar.toISOString())
        url.searchParams.set('singleEvents', 'true')
        url.searchParams.set('orderBy', 'startTime')
        url.searchParams.set('maxResults', '500')

        const calRes = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${accessToken}` } })
        if (calRes.ok) {
          const calData = await calRes.json()
          rocks = (calData.items || []).map(event => {
            if (event.start?.dateTime && event.end?.dateTime) {
              return { start: new Date(event.start.dateTime), end: new Date(event.end.dateTime), title: event.summary }
            }
            if (event.start?.date) {
              // All-day event - block the whole work day
              const date = new Date(event.start.date)
              return {
                start: new Date(date.setHours(WORK_START_HOUR, 0, 0, 0)),
                end: new Date(date.setHours(WORK_END_HOUR, 0, 0, 0)),
                title: event.summary || 'All-day'
              }
            }
            return null
          }).filter(Boolean)
        }
      }
    } catch (err) {
      console.error('Calendar fetch error:', err)
    }

    // Generate hourly time slots for scheduling
    const slots = []
    const current = new Date(startDate)
    while (current <= endDateForCalendar) {
      const dow = current.getDay()
      if (dow !== 0 && dow !== 6) { // Skip weekends
        for (let hour = WORK_START_HOUR; hour < WORK_END_HOUR; hour++) {
          const slotStart = new Date(current)
          slotStart.setHours(hour, 0, 0, 0)
          const slotEnd = new Date(slotStart)
          slotEnd.setHours(hour + 1, 0, 0, 0)
          slots.push({ start: slotStart, end: slotEnd, available: true })
        }
      }
      current.setDate(current.getDate() + 1)
    }

    // Mark calendar rocks as unavailable
    for (const slot of slots) {
      for (const rock of rocks) {
        if (slot.start < rock.end && slot.end > rock.start) {
          slot.available = false
          rocksAvoided++
          break
        }
      }
    }

    // Group chunks by project (maintaining order within each project)
    const projectQueues = new Map()
    const projectOrder = []

    for (const chunk of allChunks) {
      if (!projectQueues.has(chunk.project_id)) {
        projectQueues.set(chunk.project_id, {
          id: chunk.project_id,
          name: chunk.project_name,
          priority: chunk.priority,
          chunks: []
        })
        projectOrder.push(chunk.project_id)
      }
      projectQueues.get(chunk.project_id).chunks.push(chunk)
    }

    // Clear existing draft
    await db.sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL`
    await db.sql`UPDATE schedule_drafts SET status = 'expired', updated_at = NOW() WHERE status = 'draft'`

    // Interleaved scheduling - round-robin through projects
    const scheduled = []
    let slotIndex = 0
    let hoursScheduledToday = 0
    let currentDay = null
    let projectIndex = 0
    let activeProjects = projectOrder.filter(id => projectQueues.get(id).chunks.length > 0)

    while (activeProjects.length > 0 && slotIndex < slots.length) {
      // Get next project in round-robin
      const projectId = activeProjects[projectIndex % activeProjects.length]
      const project = projectQueues.get(projectId)

      if (project.chunks.length > 0) {
        const chunk = project.chunks[0] // Peek at next chunk
        const hoursNeeded = chunk.hours
        let hoursAssigned = 0
        const scheduledSlots = []

        // Find consecutive available slots for this chunk
        let tempSlotIndex = slotIndex
        while (hoursAssigned < hoursNeeded && tempSlotIndex < slots.length) {
          const slot = slots[tempSlotIndex]
          const slotDay = slot.start.toDateString()

          // Track hours per day
          if (currentDay !== slotDay) {
            currentDay = slotDay
            hoursScheduledToday = 0
          }

          if (!slot.available || hoursScheduledToday >= MAX_HOURS_PER_DAY) {
            tempSlotIndex++
            continue
          }

          slot.available = false
          scheduledSlots.push(slot)
          hoursAssigned++
          hoursScheduledToday++
          tempSlotIndex++
        }

        if (scheduledSlots.length > 0) {
          project.chunks.shift() // Actually remove the chunk now
          scheduled.push({
            chunk,
            start: scheduledSlots[0].start,
            end: scheduledSlots[scheduledSlots.length - 1].end
          })
          slotIndex = tempSlotIndex
        } else {
          // No slots available for this chunk - move past exhausted slots
          slotIndex = tempSlotIndex
        }
      }

      // Move to next project
      projectIndex++

      // Remove projects that are done
      activeProjects = activeProjects.filter(id => projectQueues.get(id).chunks.length > 0)

      // Safety: if we've exhausted all slots, stop
      if (slotIndex >= slots.length) break
    }

    // Save draft
    const draftId = `draft-${Date.now().toString(36)}`
    const lastScheduled = scheduled[scheduled.length - 1]
    const endDate = lastScheduled ? lastScheduled.end : startDate

    await db.sql`
      INSERT INTO schedule_drafts (id, week_start, week_end, total_hours, chunk_count, rocks_avoided)
      VALUES (${draftId}, ${startDate.toISOString().split('T')[0]}, ${endDate.toISOString().split('T')[0]},
        ${scheduled.reduce((sum, s) => sum + s.chunk.hours, 0)}, ${scheduled.length}, ${rocksAvoided})
    `

    for (const { chunk, start, end } of scheduled) {
      await db.sql`
        UPDATE chunks
        SET draft_scheduled_start = ${start.toISOString()}, draft_scheduled_end = ${end.toISOString()}, updated_at = NOW()
        WHERE id = ${chunk.id}
      `
    }

    // Count projects scheduled
    const projectsScheduled = new Set(scheduled.map(s => s.chunk.project_id)).size

    res.json({
      success: true,
      draftId,
      scheduled: scheduled.length,
      projects: projectsScheduled,
      rocksAvoided,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    })
  } catch (err) {
    console.error('Schedule generate error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Schedule - Publish draft
app.post('/api/os-beta/schedule/publish', async (req, res) => {
  try {
    const chunks = await db.sql`
      SELECT c.*, p.name as project_name, p.client_id
      FROM chunks c
      JOIN projects p ON c.project_id = p.id
      WHERE c.draft_scheduled_start IS NOT NULL
      ORDER BY c.draft_order ASC
    `;

    if (chunks.length === 0) {
      return res.status(400).json({ error: 'No draft to publish' });
    }

    // For now, just mark as scheduled (calendar integration in production)
    for (const chunk of chunks) {
      await db.sql`
        UPDATE chunks
        SET scheduled_start = ${chunk.draft_scheduled_start},
            scheduled_end = ${chunk.draft_scheduled_end},
            status = 'scheduled',
            draft_scheduled_start = NULL,
            draft_scheduled_end = NULL,
            updated_at = NOW()
        WHERE id = ${chunk.id}
      `;
    }

    await db.sql`UPDATE schedule_drafts SET status = 'accepted', accepted_at = NOW() WHERE status = 'draft'`;

    res.json({ success: true, published: chunks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule - Clear draft (preserve draft_order which defines chunk sequence within phases)
app.post('/api/os-beta/schedule/clear', async (req, res) => {
  try {
    await db.sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL`;
    await db.sql`UPDATE schedule_drafts SET status = 'rejected', updated_at = NOW() WHERE status = 'draft'`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schedule - Revenue Forecast
// Calculates projected revenue based on phase completion dates and proposal estimates
app.get('/api/os-beta/schedule/forecast', async (req, res) => {
  try {
    // Get all projects with proposal_id that have scheduled/draft-scheduled chunks
    const projects = await db.sql`
      SELECT DISTINCT p.id, p.name, p.proposal_id, p.rate
      FROM projects p
      JOIN chunks c ON c.project_id = p.id
      WHERE p.proposal_id IS NOT NULL
        AND p.status = 'active'
        AND (c.draft_scheduled_start IS NOT NULL OR c.scheduled_start IS NOT NULL)
    `;

    if (projects.length === 0) {
      return res.json({ weeks: [], total: 0 });
    }

    // Get proposal phase data for each project
    const forecastData = [];

    for (const project of projects) {
      // Get proposal phases from os_beta_proposals (firewalled)
      const proposalRows = await db.sql`
        SELECT data FROM os_beta_proposals WHERE id = ${project.proposal_id}
      `;

      if (proposalRows.length === 0) continue;

      const proposal = typeof proposalRows[0].data === 'string'
        ? JSON.parse(proposalRows[0].data)
        : proposalRows[0].data;

      if (!proposal.phases || proposal.phases.length === 0) continue;

      // Build a map of phase name -> phase cost (using low hours for conservative estimate)
      const defaultRate = project.rate || 12000; // cents per hour, default $120/hr
      const phaseMap = {};
      for (const phase of proposal.phases) {
        if (phase.optional) continue; // Skip optional phases
        // Use phase rate if available, otherwise project rate, converted to cents
        const phaseRate = phase.rate ? phase.rate * 100 : defaultRate;
        phaseMap[phase.name] = {
          lowHrs: phase.lowHrs || 0,
          lowCost: (phase.lowHrs || 0) * phaseRate
        };
      }

      // Get chunks grouped by phase with their completion dates
      const chunks = await db.sql`
        SELECT phase_name, draft_scheduled_end, scheduled_end
        FROM chunks
        WHERE project_id = ${project.id}
          AND (draft_scheduled_start IS NOT NULL OR scheduled_start IS NOT NULL)
        ORDER BY COALESCE(draft_scheduled_end, scheduled_end) DESC
      `;

      // Find the last chunk of each phase (that's when the phase completes)
      const phaseCompletions = {};
      for (const chunk of chunks) {
        const phaseName = chunk.phase_name || 'General';
        const completionDate = chunk.draft_scheduled_end || chunk.scheduled_end;

        if (completionDate && !phaseCompletions[phaseName]) {
          phaseCompletions[phaseName] = new Date(completionDate);
        }
      }

      // Create forecast entries for each phase
      for (const [phaseName, completionDate] of Object.entries(phaseCompletions)) {
        const phaseInfo = phaseMap[phaseName];
        if (!phaseInfo) continue; // Phase not in proposal

        forecastData.push({
          projectId: project.id,
          projectName: project.name,
          phaseName,
          completionDate,
          amount: phaseInfo.lowCost // Conservative estimate
        });
      }
    }

    // Group by week
    const weekMap = new Map();
    for (const entry of forecastData) {
      // Get the Monday of the week
      const date = new Date(entry.completionDate);
      const day = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekStart: monday.toISOString(),
          weekLabel: monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          phases: [],
          total: 0
        });
      }

      const week = weekMap.get(weekKey);
      week.phases.push({
        projectName: entry.projectName,
        phaseName: entry.phaseName,
        amount: entry.amount
      });
      week.total += entry.amount;
    }

    // Sort weeks by date and convert to array
    const weeks = Array.from(weekMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, week]) => week);

    // Calculate grand total
    const grandTotal = weeks.reduce((sum, week) => sum + week.total, 0);

    res.json({
      weeks,
      total: grandTotal
    });
  } catch (err) {
    console.error('Forecast error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Schedule - Get calendar rocks (blocked time from reference calendar)
app.get('/api/os-beta/schedule/rocks', async (req, res) => {
  try {
    // Get date range from query params or use next 14 weeks
    const startDate = req.query.start ? new Date(req.query.start) : new Date();
    const endDate = req.query.end ? new Date(req.query.end) : new Date(startDate.getTime() + 14 * 7 * 24 * 60 * 60 * 1000);

    // Get Google access token
    const tokenRows = await db.sql`
      SELECT access_token, refresh_token, expires_at
      FROM oauth_tokens
      WHERE provider = 'google'
    `;

    if (tokenRows.length === 0) {
      return res.status(401).json({ error: 'Google Calendar not connected' });
    }

    let accessToken = tokenRows[0].access_token;

    // Check if token needs refresh
    const expiresAt = new Date(tokenRows[0].expires_at);
    if (expiresAt < new Date() && tokenRows[0].refresh_token) {
      // Refresh the token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: tokenRows[0].refresh_token,
          grant_type: 'refresh_token'
        })
      });
      const tokens = await refreshResponse.json();
      if (tokens.access_token) {
        accessToken = tokens.access_token;
        const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
        await db.sql`
          UPDATE oauth_tokens
          SET access_token = ${accessToken}, expires_at = ${newExpiresAt.toISOString()}, updated_at = NOW()
          WHERE provider = 'google'
        `;
      }
    }

    // Fetch events from reference calendar
    const calendarId = process.env.GOOGLE_REFERENCE_CALENDAR_ID || 'primary';
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', startDate.toISOString());
    url.searchParams.set('timeMax', endDate.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '500');

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Calendar API error' });
    }

    const data = await response.json();
    const events = data.items || [];

    // Convert to rocks format (blocked time ranges)
    const rocks = events.map(event => {
      if (event.start?.dateTime) {
        // Timed event
        return {
          id: event.id,
          title: event.summary || 'Busy',
          start: event.start.dateTime,
          end: event.end.dateTime,
          allDay: false
        };
      } else if (event.start?.date) {
        // All-day event
        return {
          id: event.id,
          title: event.summary || 'All-day event',
          start: event.start.date,
          end: event.end.date,
          allDay: true
        };
      }
      return null;
    }).filter(Boolean);

    res.json(rocks);
  } catch (err) {
    console.error('Error fetching rocks:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// STRIPE BILLING ENDPOINTS
// =============================================================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create Stripe Checkout Session for saving a card
app.post('/api/os-beta/stripe/checkout-session', async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    // Get client from database
    const client = await db.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const email = client.data?.email || client.email;
    if (!email) {
      return res.status(400).json({ error: 'Client has no email address' });
    }

    // Check if client already has a Stripe customer
    let stripeCustomerId = client.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: email,
        name: client.data?.name || client.name,
        metadata: {
          os_client_id: clientId
        }
      });
      stripeCustomerId = customer.id;

      // Save Stripe customer ID to database
      await db.setClientStripeId(clientId, stripeCustomerId);
    }

    // Create Checkout Session in setup mode (for saving card, no charge)
    // SECURITY: Use APP_URL instead of req.headers.origin to prevent open redirect
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'setup',
      payment_method_types: ['card'],
      success_url: `${APP_URL}/hosting?setup=success&client=${encodeURIComponent(clientId)}`,
      cancel_url: `${APP_URL}/hosting`,
      metadata: {
        os_client_id: clientId
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url,
      customerId: stripeCustomerId
    });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get Stripe customer info for a client
app.get('/api/os-beta/stripe/customer/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const client = await db.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.stripe_customer_id) {
      return res.json({ hasStripeCustomer: false });
    }

    // Get customer from Stripe
    const customer = await stripe.customers.retrieve(client.stripe_customer_id);

    // Get payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: client.stripe_customer_id,
      type: 'card'
    });

    res.json({
      hasStripeCustomer: true,
      customerId: customer.id,
      email: customer.email,
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year
      }))
    });
  } catch (err) {
    console.error('Error getting Stripe customer:', err);
    res.status(500).json({ error: err.message });
  }
});

// Charge a client's saved card
app.post('/api/os-beta/stripe/charge', async (req, res) => {
  try {
    const { clientId, amount, description } = req.body;

    if (!clientId || !amount) {
      return res.status(400).json({ error: 'clientId and amount are required' });
    }

    const client = await db.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.stripe_customer_id) {
      return res.status(400).json({ error: 'Client has no Stripe customer. They need to complete checkout first.' });
    }

    // Get default payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: client.stripe_customer_id,
      type: 'card'
    });

    if (paymentMethods.data.length === 0) {
      return res.status(400).json({ error: 'Client has no saved payment method' });
    }

    const paymentMethodId = paymentMethods.data[0].id;

    // Create payment intent and confirm immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // in cents
      currency: 'usd',
      customer: client.stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description || 'Website hosting',
      metadata: {
        os_client_id: clientId
      }
    });

    res.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount
    });
  } catch (err) {
    console.error('Error charging card:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stripe webhook handler
app.post('/api/os-beta/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // SECURITY: Fail closed - reject webhooks if secret not configured
  if (!webhookSecret) {
    console.error('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET not configured');
    return res.status(403).json({ error: 'Webhook not configured' });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    console.log('Stripe webhook:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout completed for customer:', session.customer);
        // Card is now saved - could trigger notification here
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('Payment succeeded:', paymentIntent.id, paymentIntent.amount);
        // Could update invoice status here
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Payment failed:', failedPayment.id);
        // Could trigger alert here
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// =============================================================================
// RESEND EMAIL ENDPOINTS
// =============================================================================

// Send billing setup email to a client
app.post('/api/os-beta/email/billing-setup', async (req, res) => {
  try {
    const { clientId, preview } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    // Get client from hosting_billing
    const clients = await db.sql`
      SELECT * FROM hosting_billing WHERE client_id = ${clientId} LIMIT 1
    `;

    if (clients.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clients[0];

    if (!client.email) {
      return res.status(400).json({ error: 'Client has no email address' });
    }

    if (!client.checkout_link) {
      return res.status(400).json({ error: 'Client has no checkout link. Generate one first.' });
    }

    // Build email content
    const subject = 'Update Your Payment Method - Adrial Designs';
    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2b303a;">Update Your Payment Method</h2>

        <p>Hi ${client.contact_name || client.client_name},</p>

        <p>We're updating our billing system to serve you better. To continue your website hosting service without interruption, please take a moment to securely save your payment card.</p>

        <p style="margin: 24px 0;">
          <a href="${client.checkout_link}"
             style="background-color: #2b303a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Update Payment Method
          </a>
        </p>

        <p><strong>Your hosting details:</strong></p>
        <ul>
          <li>Service: ${client.project_name}</li>
          <li>Monthly rate: $${(client.rate_cents / 100).toFixed(2)}</li>
          <li>Next billing: ${client.next_billing_date ? new Date(client.next_billing_date).toLocaleDateString() : 'Soon'}</li>
        </ul>

        <p>This secure link will take you to Stripe's payment page. Your card information is never stored on our servers.</p>

        <p>If you have any questions, just reply to this email.</p>

        <p>Thanks,<br>Adrial Dale<br>Adrial Designs</p>
      </div>
    `;

    // If preview mode, return the email content without sending
    if (preview) {
      return res.json({
        preview: true,
        to: client.email,
        subject,
        html
      });
    }

    // Send via Resend
    const { Resend } = require('resend');
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
    }

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: 'Adrial Designs <billing@adrialdesigns.com>',
      to: client.email,
      subject,
      html
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Update hosting_billing to track that email was sent
    await db.sql`
      UPDATE hosting_billing
      SET updated_at = NOW()
      WHERE client_id = ${clientId}
    `;

    res.json({
      success: true,
      messageId: data.id,
      to: client.email
    });
  } catch (err) {
    console.error('Error sending email:', err);
    res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// HOSTING BILLING ENDPOINTS
// =============================================================================

// Get all hosting billing records
app.get('/api/os-beta/hosting', async (req, res) => {
  try {
    const records = await db.sql`
      SELECT * FROM hosting_billing
      ORDER BY client_name ASC
    `;
    res.json(records);
  } catch (err) {
    console.error('Error fetching hosting:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get hosting summary stats
app.get('/api/os-beta/hosting/summary', async (req, res) => {
  try {
    const summary = await db.sql`
      SELECT
        COUNT(*) as total_clients,
        COUNT(CASE WHEN webflow_cost_cents > 0 THEN 1 END) as active_clients,
        SUM(CASE WHEN webflow_cost_cents > 0 THEN rate_cents ELSE 0 END) as total_mrr,
        SUM(CASE WHEN webflow_cost_cents > 0 THEN webflow_cost_cents ELSE 0 END) as total_webflow_cost,
        SUM(CASE WHEN webflow_cost_cents > 0 THEN profit_cents ELSE 0 END) as total_profit
      FROM hosting_billing
    `;
    res.json(summary[0]);
  } catch (err) {
    console.error('Error fetching hosting summary:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

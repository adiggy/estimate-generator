/**
 * Database Utility Module for Adrial Designs OS
 *
 * Shared utilities for all CLI scripts:
 * - Neon connection wrapper
 * - CRUD operations for projects, chunks, time_logs, invoices
 * - Query builders with filters
 */

const { neon } = require('@neondatabase/serverless')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required')
  console.error('Set it in .env file or export it in your shell')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

// ============================================================================
// PROJECTS
// ============================================================================

/**
 * Get all projects with optional filters
 * @param {Object} options - Filter options
 * @param {string} options.status - Filter by status
 * @param {string} options.clientId - Filter by client
 * @param {string} options.billingPlatform - Filter by billing platform ('os' or 'bonsai_legacy')
 * @param {boolean} options.excludeHosting - Exclude bonsai_legacy projects
 * @returns {Promise<Array>}
 */
async function getProjects(options = {}) {
  const { status, clientId, billingPlatform, excludeHosting } = options

  let query = 'SELECT * FROM projects WHERE 1=1'
  const params = []

  if (status) {
    params.push(status)
    query += ` AND status = $${params.length}`
  }
  if (clientId) {
    params.push(clientId)
    query += ` AND client_id = $${params.length}`
  }
  if (billingPlatform) {
    params.push(billingPlatform)
    query += ` AND billing_platform = $${params.length}`
  }
  if (excludeHosting) {
    query += ` AND billing_platform != 'bonsai_legacy'`
  }

  query += ' ORDER BY last_touched_at DESC NULLS LAST'

  return sql(query, params)
}

/**
 * Get a single project by ID
 * @param {string} id - Project ID
 * @returns {Promise<Object|null>}
 */
async function getProject(id) {
  const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
  return rows[0] || null
}

/**
 * Create a new project
 * @param {Object} project - Project data
 * @returns {Promise<Object>}
 */
async function createProject(project) {
  const {
    id, client_id, proposal_id, name, description, status = 'active',
    priority = 0, billing_type = 'hourly', billing_platform = 'os',
    budget_low, budget_high, rate = 12000, due_date, notes,
    external_links = [], people = [], tags = []
  } = project

  await sql`
    INSERT INTO projects (
      id, client_id, proposal_id, name, description, status,
      priority, billing_type, billing_platform, budget_low, budget_high,
      rate, due_date, last_touched_at, notes, external_links, people, tags
    ) VALUES (
      ${id}, ${client_id}, ${proposal_id}, ${name}, ${description}, ${status},
      ${priority}, ${billing_type}, ${billing_platform}, ${budget_low}, ${budget_high},
      ${rate}, ${due_date}, NOW(), ${notes}, ${JSON.stringify(external_links)},
      ${JSON.stringify(people)}, ${JSON.stringify(tags)}
    )
  `
  return getProject(id)
}

/**
 * Update an existing project
 * @param {string} id - Project ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
async function updateProject(id, updates) {
  const allowedFields = [
    'name', 'description', 'status', 'priority', 'billing_type',
    'billing_platform', 'budget_low', 'budget_high', 'rate', 'due_date',
    'last_touched_at', 'notes', 'external_links', 'people', 'tags'
  ]

  const sets = []
  const params = []

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      params.push(key === 'external_links' || key === 'people' || key === 'tags'
        ? JSON.stringify(value)
        : value)
      sets.push(`${key} = $${params.length}`)
    }
  }

  if (sets.length === 0) return getProject(id)

  // Always update updated_at
  sets.push('updated_at = NOW()')

  params.push(id)
  const query = `UPDATE projects SET ${sets.join(', ')} WHERE id = $${params.length}`
  await sql(query, params)

  return getProject(id)
}

/**
 * Touch a project (update last_touched_at)
 * @param {string} id - Project ID
 */
async function touchProject(id) {
  await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${id}`
}

// ============================================================================
// CHUNKS
// ============================================================================

/**
 * Get chunks for a project
 * @param {string} projectId - Project ID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>}
 */
async function getChunks(projectId, options = {}) {
  const { status, phaseName } = options

  let rows
  if (status && phaseName) {
    rows = await sql`
      SELECT * FROM chunks
      WHERE project_id = ${projectId} AND status = ${status} AND phase_name = ${phaseName}
      ORDER BY created_at ASC
    `
  } else if (status) {
    rows = await sql`
      SELECT * FROM chunks
      WHERE project_id = ${projectId} AND status = ${status}
      ORDER BY created_at ASC
    `
  } else if (phaseName) {
    rows = await sql`
      SELECT * FROM chunks
      WHERE project_id = ${projectId} AND phase_name = ${phaseName}
      ORDER BY created_at ASC
    `
  } else {
    rows = await sql`
      SELECT * FROM chunks
      WHERE project_id = ${projectId}
      ORDER BY phase_order ASC NULLS LAST, created_at ASC
    `
  }

  return rows
}

/**
 * Get a single chunk by ID
 * @param {string} id - Chunk ID
 * @returns {Promise<Object|null>}
 */
async function getChunk(id) {
  const rows = await sql`SELECT * FROM chunks WHERE id = ${id}`
  return rows[0] || null
}

/**
 * Create a new chunk
 * @param {Object} chunk - Chunk data
 * @returns {Promise<Object>}
 */
async function createChunk(chunk) {
  const {
    id, project_id, phase_name, name, description, hours, status = 'pending',
    scheduled_start, scheduled_end, notes
  } = chunk

  await sql`
    INSERT INTO chunks (
      id, project_id, phase_name, name, description, hours, status,
      scheduled_start, scheduled_end, notes
    ) VALUES (
      ${id}, ${project_id}, ${phase_name}, ${name}, ${description}, ${hours},
      ${status}, ${scheduled_start}, ${scheduled_end}, ${notes}
    )
  `

  // Touch the project
  await touchProject(project_id)

  return getChunk(id)
}

/**
 * Update an existing chunk
 * @param {string} id - Chunk ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
async function updateChunk(id, updates) {
  const chunk = await getChunk(id)
  if (!chunk) return null

  const allowedFields = [
    'phase_name', 'name', 'description', 'hours', 'status',
    'scheduled_start', 'scheduled_end', 'completed_at', 'calendar_event_id', 'notes'
  ]

  const sets = []
  const params = []

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      params.push(value)
      sets.push(`${key} = $${params.length}`)
    }
  }

  if (sets.length === 0) return chunk

  sets.push('updated_at = NOW()')

  params.push(id)
  const query = `UPDATE chunks SET ${sets.join(', ')} WHERE id = $${params.length}`
  await sql(query, params)

  // Touch the project
  await touchProject(chunk.project_id)

  return getChunk(id)
}

/**
 * Mark a chunk as completed
 * @param {string} id - Chunk ID
 */
async function completeChunk(id) {
  return updateChunk(id, { status: 'done', completed_at: new Date().toISOString() })
}

/**
 * Get all pending chunks (for scheduling)
 * @returns {Promise<Array>}
 */
async function getPendingChunks() {
  return sql`
    SELECT c.*, p.name as project_name, p.priority, p.client_id
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.status = 'pending'
    ORDER BY p.priority DESC, p.last_touched_at DESC
  `
}

// ============================================================================
// TIME LOGS
// ============================================================================

/**
 * Get time logs with optional filters
 * @param {Object} options - Filter options
 * @returns {Promise<Array>}
 */
async function getTimeLogs(options = {}) {
  const { projectId, chunkId, invoiced, billable } = options

  let rows
  if (projectId && invoiced === false) {
    rows = await sql`
      SELECT * FROM time_logs
      WHERE project_id = ${projectId} AND invoiced = false
      ORDER BY started_at DESC
    `
  } else if (projectId) {
    rows = await sql`
      SELECT * FROM time_logs
      WHERE project_id = ${projectId}
      ORDER BY started_at DESC
    `
  } else if (invoiced === false) {
    rows = await sql`
      SELECT * FROM time_logs
      WHERE invoiced = false
      ORDER BY started_at DESC
    `
  } else {
    rows = await sql`SELECT * FROM time_logs ORDER BY started_at DESC`
  }

  return rows
}

/**
 * Get a single time log by ID
 * @param {string} id - Time log ID
 * @returns {Promise<Object|null>}
 */
async function getTimeLog(id) {
  const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
  return rows[0] || null
}

/**
 * Create a new time log (start timer)
 * @param {Object} entry - Time log data
 * @returns {Promise<Object>}
 */
async function createTimeLog(entry) {
  const {
    id, project_id, chunk_id, description, started_at = new Date().toISOString(),
    billable = true, rate, status = 'draft', accumulated_seconds = 0, last_resumed_at
  } = entry

  await sql`
    INSERT INTO time_logs (
      id, project_id, chunk_id, description, started_at, billable, rate,
      status, accumulated_seconds, last_resumed_at
    ) VALUES (
      ${id}, ${project_id}, ${chunk_id}, ${description}, ${started_at}, ${billable}, ${rate},
      ${status}, ${accumulated_seconds}, ${last_resumed_at}
    )
  `

  // Touch the project
  await touchProject(project_id)

  return getTimeLog(id)
}

/**
 * Stop a running time log
 * @param {string} id - Time log ID
 * @param {Date} endedAt - End time (defaults to now)
 * @returns {Promise<Object>}
 */
async function stopTimeLog(id, endedAt = new Date()) {
  const log = await getTimeLog(id)
  if (!log) return null

  const startedAt = new Date(log.started_at)
  const durationMinutes = Math.round((endedAt - startedAt) / 60000)

  await sql`
    UPDATE time_logs
    SET ended_at = ${endedAt.toISOString()},
        duration_minutes = ${durationMinutes},
        updated_at = NOW()
    WHERE id = ${id}
  `

  return getTimeLog(id)
}

/**
 * Log time directly (without start/stop)
 * @param {Object} entry - Time log data with duration
 * @returns {Promise<Object>}
 */
async function logTime(entry) {
  const {
    id, project_id, chunk_id, description, duration_minutes,
    started_at = new Date().toISOString(), billable = true, rate
  } = entry

  const endedAt = new Date(new Date(started_at).getTime() + duration_minutes * 60000)

  await sql`
    INSERT INTO time_logs (
      id, project_id, chunk_id, description, started_at, ended_at,
      duration_minutes, billable, rate
    ) VALUES (
      ${id}, ${project_id}, ${chunk_id}, ${description}, ${started_at},
      ${endedAt.toISOString()}, ${duration_minutes}, ${billable}, ${rate}
    )
  `

  await touchProject(project_id)

  return getTimeLog(id)
}

/**
 * Delete a time log entry
 * @param {string} id - Time log ID
 * @returns {Promise<void>}
 */
async function deleteTimeLog(id) {
  await sql`DELETE FROM time_logs WHERE id = ${id}`
}

/**
 * Get unbilled time for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<{logs: Array, totalMinutes: number, totalAmount: number}>}
 */
async function getUnbilledTime(projectId) {
  const logs = await sql`
    SELECT tl.*, p.rate as project_rate
    FROM time_logs tl
    JOIN projects p ON tl.project_id = p.id
    WHERE tl.project_id = ${projectId}
      AND tl.invoiced = false
      AND tl.billable = true
      AND tl.duration_minutes IS NOT NULL
    ORDER BY tl.started_at ASC
  `

  const totalMinutes = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
  const totalAmount = logs.reduce((sum, l) => {
    const rate = l.rate || l.project_rate || 12000
    return sum + Math.round((l.duration_minutes / 60) * rate)
  }, 0)

  return { logs, totalMinutes, totalAmount }
}

// ============================================================================
// INVOICES
// ============================================================================

/**
 * Get invoices with optional filters
 * @param {Object} options - Filter options
 * @returns {Promise<Array>}
 */
async function getInvoices(options = {}) {
  const { clientId, status } = options

  let rows
  if (clientId && status) {
    rows = await sql`
      SELECT * FROM invoices
      WHERE client_id = ${clientId} AND status = ${status}
      ORDER BY created_at DESC
    `
  } else if (clientId) {
    rows = await sql`
      SELECT * FROM invoices
      WHERE client_id = ${clientId}
      ORDER BY created_at DESC
    `
  } else if (status) {
    rows = await sql`
      SELECT * FROM invoices
      WHERE status = ${status}
      ORDER BY created_at DESC
    `
  } else {
    rows = await sql`SELECT * FROM invoices ORDER BY created_at DESC`
  }

  return rows
}

/**
 * Get a single invoice by ID
 * @param {string} id - Invoice ID
 * @returns {Promise<Object|null>}
 */
async function getInvoice(id) {
  const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
  return rows[0] || null
}

/**
 * Create a new invoice
 * @param {Object} invoice - Invoice data
 * @returns {Promise<Object>}
 */
async function createInvoice(invoice) {
  const {
    id, client_id, status = 'draft', subtotal = 0, discount_percent = 0,
    tax_percent = 0, total = 0, line_items = [], notes, due_date
  } = invoice

  await sql`
    INSERT INTO invoices (
      id, client_id, status, subtotal, discount_percent, tax_percent,
      total, line_items, notes, due_date
    ) VALUES (
      ${id}, ${client_id}, ${status}, ${subtotal}, ${discount_percent},
      ${tax_percent}, ${total}, ${JSON.stringify(line_items)}, ${notes}, ${due_date}
    )
  `

  return getInvoice(id)
}

/**
 * Update an invoice
 * @param {string} id - Invoice ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>}
 */
async function updateInvoice(id, updates) {
  const allowedFields = [
    'stripe_invoice_id', 'stripe_invoice_url', 'status', 'subtotal',
    'discount_percent', 'tax_percent', 'total', 'line_items', 'notes',
    'due_date', 'paid_at', 'sent_at'
  ]

  const sets = []
  const params = []

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      params.push(key === 'line_items' ? JSON.stringify(value) : value)
      sets.push(`${key} = $${params.length}`)
    }
  }

  if (sets.length === 0) return getInvoice(id)

  sets.push('updated_at = NOW()')

  params.push(id)
  const query = `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${params.length}`
  await sql(query, params)

  return getInvoice(id)
}

/**
 * Mark time logs as invoiced
 * @param {Array<string>} timeLogIds - IDs of time logs to mark
 * @param {string} invoiceId - Invoice ID
 */
async function markTimeLogsInvoiced(timeLogIds, invoiceId) {
  for (const id of timeLogIds) {
    await sql`
      UPDATE time_logs
      SET invoiced = true, invoice_id = ${invoiceId}, updated_at = NOW()
      WHERE id = ${id}
    `
  }
}

// ============================================================================
// OAUTH TOKENS
// ============================================================================

/**
 * Get OAuth token for a provider
 * @param {string} provider - Provider name (e.g., 'google')
 * @returns {Promise<Object|null>}
 */
async function getOAuthToken(provider) {
  const rows = await sql`SELECT * FROM oauth_tokens WHERE provider = ${provider}`
  return rows[0] || null
}

/**
 * Save or update OAuth token
 * @param {Object} token - Token data
 * @returns {Promise<Object>}
 */
async function saveOAuthToken(token) {
  const { provider, access_token, refresh_token, expires_at, scope } = token

  await sql`
    INSERT INTO oauth_tokens (provider, access_token, refresh_token, expires_at, scope)
    VALUES (${provider}, ${access_token}, ${refresh_token}, ${expires_at}, ${scope})
    ON CONFLICT (provider) DO UPDATE SET
      access_token = ${access_token},
      refresh_token = COALESCE(${refresh_token}, oauth_tokens.refresh_token),
      expires_at = ${expires_at},
      scope = ${scope},
      updated_at = NOW()
  `

  return getOAuthToken(provider)
}

// ============================================================================
// CLIENTS (extension)
// ============================================================================

/**
 * Get client by ID (from existing clients table)
 * @param {string} id - Client ID
 * @returns {Promise<Object|null>}
 */
async function getClient(id) {
  const rows = await sql`SELECT * FROM clients WHERE id = ${id}`
  if (!rows[0]) return null

  const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
  return { id: rows[0].id, ...data, stripe_customer_id: rows[0].stripe_customer_id }
}

/**
 * Update client's Stripe customer ID
 * @param {string} id - Client ID
 * @param {string} stripeCustomerId - Stripe customer ID
 */
async function setClientStripeId(id, stripeCustomerId) {
  await sql`UPDATE clients SET stripe_customer_id = ${stripeCustomerId} WHERE id = ${id}`
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Get CFO metrics
 * @returns {Promise<Object>}
 */
async function getStats() {
  // Unbilled: work done but not invoiced
  const unbilledResult = await sql`
    SELECT COALESCE(SUM(
      ROUND((duration_minutes::numeric / 60) * COALESCE(tl.rate, p.rate, 12000))
    ), 0) as total
    FROM time_logs tl
    JOIN projects p ON tl.project_id = p.id
    WHERE tl.invoiced = false AND tl.billable = true AND tl.duration_minutes IS NOT NULL
  `

  // Unpaid: invoiced but not paid
  const unpaidResult = await sql`
    SELECT COALESCE(SUM(total), 0) as total
    FROM invoices
    WHERE status = 'sent'
  `

  // Revenue MTD
  const revenueMonthResult = await sql`
    SELECT COALESCE(SUM(total), 0) as total
    FROM invoices
    WHERE status = 'paid'
      AND paid_at >= date_trunc('month', CURRENT_DATE)
  `

  // Revenue YTD
  const revenueYearResult = await sql`
    SELECT COALESCE(SUM(total), 0) as total
    FROM invoices
    WHERE status = 'paid'
      AND paid_at >= date_trunc('year', CURRENT_DATE)
  `

  // MRR (hosting clients) - calculated from actual recurring invoices under $100
  // First get recurring amounts (appear 2+ times) under $100
  const mrrResult = await sql`
    WITH hosting_amounts AS (
      SELECT total
      FROM invoices
      GROUP BY total
      HAVING COUNT(*) >= 2 AND total < 10000
    ),
    active_hosting_clients AS (
      SELECT DISTINCT client_id
      FROM projects
      WHERE billing_platform = 'bonsai_legacy' AND status = 'active'
    ),
    latest_hosting_invoice AS (
      SELECT DISTINCT ON (i.client_id) i.client_id, i.total
      FROM invoices i
      INNER JOIN hosting_amounts ha ON i.total = ha.total
      INNER JOIN active_hosting_clients ahc ON i.client_id = ahc.client_id
      ORDER BY i.client_id, i.created_at DESC
    )
    SELECT COALESCE(SUM(total), 0) as total FROM latest_hosting_invoice
  `

  return {
    unbilled: parseInt(unbilledResult[0]?.total || 0),
    unpaid: parseInt(unpaidResult[0]?.total || 0),
    revenue_mtd: parseInt(revenueMonthResult[0]?.total || 0),
    revenue_ytd: parseInt(revenueYearResult[0]?.total || 0),
    mrr: parseInt(mrrResult[0]?.total || 0)
  }
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Global search across all data
 * @param {string} query - Search query
 * @returns {Promise<Object>}
 */
async function search(query) {
  const searchTerm = `%${query}%`

  const [projects, invoices, clients] = await Promise.all([
    sql`
      SELECT id, name, description, client_id, status, 'project' as type
      FROM projects
      WHERE name ILIKE ${searchTerm}
        OR description ILIKE ${searchTerm}
        OR notes ILIKE ${searchTerm}
      LIMIT 20
    `,
    sql`
      SELECT id, client_id, total, status, line_items, 'invoice' as type
      FROM invoices
      WHERE id ILIKE ${searchTerm}
        OR line_items::text ILIKE ${searchTerm}
        OR client_id ILIKE ${searchTerm}
      LIMIT 20
    `,
    sql`
      SELECT id, data->>'name' as name, data->>'company' as company, data->>'email' as email, 'client' as type
      FROM clients
      WHERE data->>'name' ILIKE ${searchTerm}
        OR data->>'company' ILIKE ${searchTerm}
        OR data->>'email' ILIKE ${searchTerm}
        OR id ILIKE ${searchTerm}
      LIMIT 20
    `
  ])

  return {
    query,
    counts: {
      total: projects.length + invoices.length + clients.length,
      projects: projects.length,
      invoices: invoices.length,
      clients: clients.length
    },
    results: {
      projects,
      invoices,
      clients
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix
 * @returns {string}
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`
}

/**
 * Slugify a string
 * @param {string} str - String to slugify
 * @returns {string}
 */
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50)
}

/**
 * Format cents to dollars
 * @param {number} cents - Amount in cents
 * @returns {string}
 */
function formatMoney(cents) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

/**
 * Parse hours string (e.g., "2 hours") to integer
 * @param {string|number} value - Hours value
 * @returns {number}
 */
function parseHours(value) {
  if (typeof value === 'number') return value
  const match = String(value).match(/(\d+)/)
  return match ? parseInt(match[1]) : 0
}

module.exports = {
  sql,
  // Projects
  getProjects,
  getProject,
  createProject,
  updateProject,
  touchProject,
  // Chunks
  getChunks,
  getChunk,
  createChunk,
  updateChunk,
  completeChunk,
  getPendingChunks,
  // Time Logs
  getTimeLogs,
  getTimeLog,
  createTimeLog,
  stopTimeLog,
  logTime,
  deleteTimeLog,
  getUnbilledTime,
  // Invoices
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  markTimeLogsInvoiced,
  // OAuth
  getOAuthToken,
  saveOAuthToken,
  // Clients
  getClient,
  setClientStripeId,
  // Stats & Search
  getStats,
  search,
  // Utilities
  generateId,
  slugify,
  formatMoney,
  parseHours
}

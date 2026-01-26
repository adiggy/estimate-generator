/**
 * OS Beta API - Consolidated Catch-All Route
 *
 * Handles all /api/os-beta/* endpoints to stay within Vercel Hobby plan limits
 */

import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)

  // Parse path segments from URL: /api/os-beta/projects/abc → ['projects', 'abc']
  // Try multiple methods to get path segments for Vercel compatibility
  let pathSegments = req.query.path || []

  // If path is empty, try parsing from URL directly
  if (!pathSegments.length && req.url) {
    const urlPath = req.url.split('?')[0] // Remove query string
    const match = urlPath.match(/\/api\/os-beta\/(.*)/)
    if (match && match[1]) {
      pathSegments = match[1].split('/').filter(Boolean)
    }
  }

  const [resource, id, subResource] = pathSegments

  try {
    // Route to appropriate handler
    switch (resource) {
      case 'projects':
        return id ? handleProjectById(req, res, sql, id) : handleProjects(req, res, sql)

      case 'chunks':
        return id ? handleChunkById(req, res, sql, id) : handleChunks(req, res, sql)

      case 'time-logs':
        return id ? handleTimeLogById(req, res, sql, id) : handleTimeLogs(req, res, sql)

      case 'invoices':
        return id ? handleInvoiceById(req, res, sql, id) : handleInvoices(req, res, sql)

      case 'stats':
        return handleStats(req, res, sql)

      case 'search':
        return handleSearch(req, res, sql)

      case 'auth':
        if (id === 'google') {
          if (subResource === 'callback') return handleGoogleCallback(req, res, sql)
          if (subResource === 'status') return handleGoogleStatus(req, res, sql)
          return handleGoogleAuth(req, res)
        }
        return res.status(404).json({ error: 'Auth route not found' })

      case 'proposals':
        return id === 'convert' ? res.status(400).json({ error: 'Use /proposals/:id/convert' }) :
               id ? (subResource === 'convert' ? handleProposalConvert(req, res, sql, id) : handleProposalById(req, res, sql, id)) :
               handleProposals(req, res, sql)

      case 'schedule':
        if (id === 'draft') {
          return subResource === 'chunks' ? handleScheduleDraftChunks(req, res, sql) : handleScheduleDraft(req, res, sql)
        }
        if (id === 'generate') return handleScheduleGenerate(req, res, sql)
        if (id === 'publish') return handleSchedulePublish(req, res, sql)
        if (id === 'clear') return handleScheduleClear(req, res, sql)
        return res.status(404).json({ error: 'Schedule route not found' })

      case 'feedback':
        return id ? handleFeedbackById(req, res, sql, id) : handleFeedback(req, res, sql)

      default:
        return res.status(404).json({ error: 'Route not found', path: pathSegments })
    }
  } catch (err) {
    console.error('OS Beta API error:', err)
    return res.status(500).json({ error: 'Server error', details: err.message })
  }
}

// ============ PROJECTS ============

async function handleProjects(req, res, sql) {
  if (req.method === 'GET') {
    const { status, client_id, billing_platform, exclude_hosting } = req.query

    let query = 'SELECT * FROM projects WHERE 1=1'
    const params = []

    if (status) {
      params.push(status)
      query += ` AND status = $${params.length}`
    }
    if (client_id) {
      params.push(client_id)
      query += ` AND client_id = $${params.length}`
    }
    if (billing_platform) {
      params.push(billing_platform)
      query += ` AND billing_platform = $${params.length}`
    }
    if (exclude_hosting === 'true') {
      query += ` AND billing_platform != 'bonsai_legacy'`
    }

    query += ' ORDER BY last_touched_at DESC NULLS LAST'
    const rows = await sql(query, params)
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const project = req.body

    if (!project.id) {
      const timestamp = Date.now().toString(36)
      const slug = (project.name || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 30)
      project.id = `${project.client_id || 'unknown'}-${slug}-${timestamp}`.substring(0, 60)
    }

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

    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
    return res.status(201).json(rows[0])
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleProjectById(req, res, sql, id) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }
    return res.status(200).json(rows[0])
  }

  if (req.method === 'PUT') {
    const updates = req.body
    const allowedFields = [
      'name', 'description', 'status', 'priority', 'billing_type',
      'billing_platform', 'budget_low', 'budget_high', 'rate', 'due_date',
      'last_touched_at', 'notes', 'external_links', 'people', 'tags'
    ]

    const sets = []
    const params = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const serialized = ['external_links', 'people', 'tags'].includes(key)
          ? JSON.stringify(value)
          : value
        params.push(serialized)
        sets.push(`${key} = $${params.length}`)
      }
    }

    if (sets.length === 0) {
      const rows = await sql`SELECT * FROM projects WHERE id = ${id}`
      return res.status(200).json(rows[0] || null)
    }

    sets.push('updated_at = NOW()')
    params.push(id)

    const query = `UPDATE projects SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
    const rows = await sql(query, params)

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }

    return res.status(200).json(rows[0])
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM projects WHERE id = ${id}`
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ============ CHUNKS ============

async function handleChunks(req, res, sql) {
  if (req.method === 'GET') {
    const { project_id, status, phase_name, pending_only } = req.query

    if (pending_only === 'true') {
      const rows = await sql`
        SELECT c.*, p.name as project_name, p.priority, p.client_id
        FROM chunks c
        JOIN projects p ON c.project_id = p.id
        WHERE c.status = 'pending'
        ORDER BY p.priority DESC, p.last_touched_at DESC
      `
      return res.status(200).json(rows)
    }

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' })
    }

    let rows
    if (status && phase_name) {
      rows = await sql`
        SELECT * FROM chunks
        WHERE project_id = ${project_id} AND status = ${status} AND phase_name = ${phase_name}
        ORDER BY created_at ASC
      `
    } else if (status) {
      rows = await sql`
        SELECT * FROM chunks
        WHERE project_id = ${project_id} AND status = ${status}
        ORDER BY created_at ASC
      `
    } else if (phase_name) {
      rows = await sql`
        SELECT * FROM chunks
        WHERE project_id = ${project_id} AND phase_name = ${phase_name}
        ORDER BY created_at ASC
      `
    } else {
      rows = await sql`
        SELECT * FROM chunks
        WHERE project_id = ${project_id}
        ORDER BY phase_name ASC NULLS LAST, created_at ASC
      `
    }

    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const chunk = req.body

    if (!chunk.id) {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      chunk.id = `chk-${timestamp}-${random}`
    }

    const {
      id, project_id, phase_name, name, description, hours, status = 'pending',
      scheduled_start, scheduled_end, notes
    } = chunk

    if (!project_id || !name || !hours) {
      return res.status(400).json({ error: 'project_id, name, and hours are required' })
    }

    if (![1, 2, 3].includes(hours)) {
      return res.status(400).json({ error: 'hours must be 1, 2, or 3' })
    }

    await sql`
      INSERT INTO chunks (
        id, project_id, phase_name, name, description, hours, status,
        scheduled_start, scheduled_end, notes
      ) VALUES (
        ${id}, ${project_id}, ${phase_name}, ${name}, ${description}, ${hours},
        ${status}, ${scheduled_start}, ${scheduled_end}, ${notes}
      )
    `

    await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${project_id}`

    const rows = await sql`SELECT * FROM chunks WHERE id = ${id}`
    return res.status(201).json(rows[0])
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleChunkById(req, res, sql, id) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM chunks WHERE id = ${id}`
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Chunk not found' })
    }
    return res.status(200).json(rows[0])
  }

  if (req.method === 'PUT') {
    const updates = req.body
    const allowedFields = [
      'phase_name', 'name', 'description', 'hours', 'status',
      'scheduled_start', 'scheduled_end', 'completed_at', 'calendar_event_id', 'notes'
    ]

    const current = await sql`SELECT * FROM chunks WHERE id = ${id}`
    if (current.length === 0) {
      return res.status(404).json({ error: 'Chunk not found' })
    }

    const sets = []
    const params = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        params.push(value)
        sets.push(`${key} = $${params.length}`)
      }
    }

    if (updates.status === 'done' && !updates.completed_at) {
      params.push(new Date().toISOString())
      sets.push(`completed_at = $${params.length}`)
    }

    if (sets.length === 0) {
      return res.status(200).json(current[0])
    }

    sets.push('updated_at = NOW()')
    params.push(id)

    const query = `UPDATE chunks SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
    const rows = await sql(query, params)

    await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${current[0].project_id}`

    return res.status(200).json(rows[0])
  }

  if (req.method === 'DELETE') {
    const current = await sql`SELECT project_id FROM chunks WHERE id = ${id}`
    await sql`DELETE FROM chunks WHERE id = ${id}`

    if (current.length > 0) {
      await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${current[0].project_id}`
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ============ TIME LOGS ============

async function handleTimeLogs(req, res, sql) {
  if (req.method === 'GET') {
    const { project_id, invoiced, running } = req.query

    if (running === 'true') {
      const rows = await sql`
        SELECT * FROM time_logs
        WHERE started_at IS NOT NULL AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      `
      return res.status(200).json(rows[0] || null)
    }

    if (project_id && invoiced === 'false') {
      const rows = await sql`
        SELECT tl.*, p.rate as project_rate
        FROM time_logs tl
        JOIN projects p ON tl.project_id = p.id
        WHERE tl.project_id = ${project_id}
          AND tl.invoiced = false
          AND tl.billable = true
          AND tl.duration_minutes IS NOT NULL
        ORDER BY tl.started_at ASC
      `

      const totalMinutes = rows.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
      const totalAmount = rows.reduce((sum, l) => {
        const rate = l.rate || l.project_rate || 12000
        return sum + Math.round((l.duration_minutes / 60) * rate)
      }, 0)

      return res.status(200).json({ logs: rows, totalMinutes, totalAmount })
    }

    let rows
    if (project_id) {
      rows = await sql`
        SELECT * FROM time_logs
        WHERE project_id = ${project_id}
        ORDER BY started_at DESC
      `
    } else if (invoiced === 'false') {
      rows = await sql`
        SELECT * FROM time_logs
        WHERE invoiced = false
        ORDER BY started_at DESC
      `
    } else {
      rows = await sql`SELECT * FROM time_logs ORDER BY started_at DESC LIMIT 100`
    }

    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const entry = req.body

    if (!entry.id) {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      entry.id = `tl-${timestamp}-${random}`
    }

    const {
      id, project_id, chunk_id, description,
      started_at = new Date().toISOString(),
      ended_at, duration_minutes,
      billable = true, rate,
      status = 'active', accumulated_seconds = 0, last_resumed_at
    } = entry

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' })
    }

    if (!ended_at) {
      const running = await sql`
        SELECT * FROM time_logs
        WHERE started_at IS NOT NULL AND ended_at IS NULL
      `
      if (running.length > 0) {
        return res.status(400).json({
          error: 'Timer already running',
          running: running[0]
        })
      }
    }

    await sql`
      INSERT INTO time_logs (
        id, project_id, chunk_id, description, started_at, ended_at,
        duration_minutes, billable, rate, status, accumulated_seconds, last_resumed_at
      ) VALUES (
        ${id}, ${project_id}, ${chunk_id}, ${description || 'Work session'},
        ${started_at}, ${ended_at}, ${duration_minutes}, ${billable}, ${rate},
        ${status}, ${accumulated_seconds}, ${last_resumed_at || started_at}
      )
    `

    await sql`UPDATE projects SET last_touched_at = NOW(), updated_at = NOW() WHERE id = ${project_id}`

    const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
    return res.status(201).json(rows[0])
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleTimeLogById(req, res, sql, id) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Time log not found' })
    }
    return res.status(200).json(rows[0])
  }

  if (req.method === 'PUT') {
    const updates = req.body

    const current = await sql`SELECT * FROM time_logs WHERE id = ${id}`
    if (current.length === 0) {
      return res.status(404).json({ error: 'Time log not found' })
    }

    const log = current[0]

    // Handle pause action
    if (updates.action === 'pause') {
      let accumulated = log.accumulated_seconds || 0
      if (log.last_resumed_at) {
        const sessionSeconds = Math.floor((Date.now() - new Date(log.last_resumed_at).getTime()) / 1000)
        accumulated += sessionSeconds
      }
      await sql`
        UPDATE time_logs
        SET status = 'paused', accumulated_seconds = ${accumulated}, last_resumed_at = NULL, updated_at = NOW()
        WHERE id = ${id}
      `
      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      return res.status(200).json(rows[0])
    }

    // Handle resume action
    if (updates.action === 'resume') {
      const now = new Date().toISOString()
      await sql`
        UPDATE time_logs
        SET status = 'active', last_resumed_at = ${now}, updated_at = NOW()
        WHERE id = ${id}
      `
      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      return res.status(200).json(rows[0])
    }

    // Handle stop action (keeps as draft for review)
    if (updates.action === 'stop') {
      let accumulated = log.accumulated_seconds || 0
      if (log.last_resumed_at) {
        const sessionSeconds = Math.floor((Date.now() - new Date(log.last_resumed_at).getTime()) / 1000)
        accumulated += sessionSeconds
      }
      const durationMinutes = Math.round(accumulated / 60)
      await sql`
        UPDATE time_logs
        SET status = 'draft', accumulated_seconds = ${accumulated}, last_resumed_at = NULL,
            duration_minutes = ${durationMinutes}, updated_at = NOW()
        WHERE id = ${id}
      `
      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      return res.status(200).json(rows[0])
    }

    // Handle finalize action
    if (updates.action === 'finalize') {
      const endedAt = new Date().toISOString()
      const durationMinutes = updates.duration_minutes || log.duration_minutes || Math.round((log.accumulated_seconds || 0) / 60)
      await sql`
        UPDATE time_logs
        SET status = 'finalized', ended_at = ${endedAt}, duration_minutes = ${durationMinutes}, updated_at = NOW()
        WHERE id = ${id}
      `
      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      return res.status(200).json(rows[0])
    }

    // Legacy stop (if using old API)
    if (updates.stop === true && log.started_at && !log.ended_at) {
      const endedAt = new Date()
      const startedAt = new Date(log.started_at)
      const durationMinutes = Math.round((endedAt - startedAt) / 60000)

      await sql`
        UPDATE time_logs
        SET ended_at = ${endedAt.toISOString()},
            duration_minutes = ${durationMinutes},
            updated_at = NOW()
        WHERE id = ${id}
      `

      const rows = await sql`SELECT * FROM time_logs WHERE id = ${id}`
      return res.status(200).json(rows[0])
    }

    // Regular update
    const allowedFields = [
      'description', 'ended_at', 'duration_minutes', 'billable', 'invoiced', 'invoice_id', 'rate',
      'status', 'accumulated_seconds', 'last_resumed_at'
    ]

    const sets = []
    const params = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        params.push(value)
        sets.push(`${key} = $${params.length}`)
      }
    }

    if (sets.length === 0) {
      return res.status(200).json(log)
    }

    sets.push('updated_at = NOW()')
    params.push(id)

    const query = `UPDATE time_logs SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
    const rows = await sql(query, params)

    return res.status(200).json(rows[0])
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM time_logs WHERE id = ${id}`
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ============ INVOICES ============

async function handleInvoices(req, res, sql) {
  if (req.method === 'GET') {
    const { client_id, status } = req.query

    let rows
    if (client_id && status) {
      rows = await sql`
        SELECT * FROM invoices
        WHERE client_id = ${client_id} AND status = ${status}
        ORDER BY created_at DESC
      `
    } else if (client_id) {
      rows = await sql`
        SELECT * FROM invoices
        WHERE client_id = ${client_id}
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

    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const invoice = req.body

    if (!invoice.id) {
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 8)
      invoice.id = `inv-${timestamp}-${random}`
    }

    const {
      id, client_id, status = 'draft', subtotal = 0, discount_percent = 0,
      tax_percent = 0, total = 0, line_items = [], notes, due_date,
      time_log_ids = []
    } = invoice

    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' })
    }

    await sql`
      INSERT INTO invoices (
        id, client_id, status, subtotal, discount_percent, tax_percent,
        total, line_items, notes, due_date
      ) VALUES (
        ${id}, ${client_id}, ${status}, ${subtotal}, ${discount_percent},
        ${tax_percent}, ${total}, ${JSON.stringify(line_items)}, ${notes}, ${due_date}
      )
    `

    if (time_log_ids.length > 0) {
      for (const tlId of time_log_ids) {
        await sql`
          UPDATE time_logs
          SET invoiced = true, invoice_id = ${id}, updated_at = NOW()
          WHERE id = ${tlId}
        `
      }
    }

    const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
    return res.status(201).json(rows[0])
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleInvoiceById(req, res, sql, id) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' })
    }
    return res.status(200).json(rows[0])
  }

  if (req.method === 'PUT') {
    const updates = req.body
    const allowedFields = [
      'stripe_invoice_id', 'stripe_invoice_url', 'status', 'subtotal',
      'discount_percent', 'tax_percent', 'total', 'line_items', 'notes',
      'due_date', 'paid_at', 'sent_at'
    ]

    const sets = []
    const params = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const serialized = key === 'line_items' ? JSON.stringify(value) : value
        params.push(serialized)
        sets.push(`${key} = $${params.length}`)
      }
    }

    if (updates.status === 'sent' && !updates.sent_at) {
      params.push(new Date().toISOString())
      sets.push(`sent_at = $${params.length}`)
    }
    if (updates.status === 'paid' && !updates.paid_at) {
      params.push(new Date().toISOString())
      sets.push(`paid_at = $${params.length}`)
    }

    if (sets.length === 0) {
      const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
      return res.status(200).json(rows[0] || null)
    }

    sets.push('updated_at = NOW()')
    params.push(id)

    const query = `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
    const rows = await sql(query, params)

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' })
    }

    return res.status(200).json(rows[0])
  }

  if (req.method === 'DELETE') {
    await sql`
      UPDATE time_logs
      SET invoiced = false, invoice_id = NULL, updated_at = NOW()
      WHERE invoice_id = ${id}
    `

    await sql`DELETE FROM invoices WHERE id = ${id}`
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ============ STATS ============

async function handleStats(req, res, sql) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const [unbilledResult, unpaidResult, revenueMonthResult, revenueYearResult, mrrResult] = await Promise.all([
    sql`
      SELECT COALESCE(SUM(
        ROUND((duration_minutes::numeric / 60) * COALESCE(tl.rate, p.rate, 12000))
      ), 0) as total
      FROM time_logs tl
      JOIN projects p ON tl.project_id = p.id
      WHERE tl.invoiced = false AND tl.billable = true AND tl.duration_minutes IS NOT NULL
    `,
    sql`
      SELECT COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE status = 'sent'
    `,
    sql`
      SELECT COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE status = 'paid'
        AND paid_at >= date_trunc('month', CURRENT_DATE)
    `,
    sql`
      SELECT COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE status = 'paid'
        AND paid_at >= date_trunc('year', CURRENT_DATE)
    `,
    sql`
      SELECT COUNT(*) * 3900 as total
      FROM projects
      WHERE billing_platform = 'bonsai_legacy' AND status = 'active'
    `
  ])

  return res.status(200).json({
    unbilled: parseInt(unbilledResult[0]?.total || 0),
    unpaid: parseInt(unpaidResult[0]?.total || 0),
    revenue_mtd: parseInt(revenueMonthResult[0]?.total || 0),
    revenue_ytd: parseInt(revenueYearResult[0]?.total || 0),
    mrr: parseInt(mrrResult[0]?.total || 0)
  })
}

// ============ SEARCH ============

async function handleSearch(req, res, sql) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { q } = req.query

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' })
  }

  const searchTerm = `%${q}%`

  const [projects, invoices, clients] = await Promise.all([
    sql`
      SELECT id, name, description, client_id, status, priority, billing_platform
      FROM projects
      WHERE name ILIKE ${searchTerm}
        OR description ILIKE ${searchTerm}
        OR notes ILIKE ${searchTerm}
      ORDER BY last_touched_at DESC NULLS LAST
      LIMIT 20
    `,
    sql`
      SELECT id, client_id, total, status, line_items, created_at
      FROM invoices
      WHERE line_items::text ILIKE ${searchTerm}
      ORDER BY created_at DESC
      LIMIT 20
    `,
    sql`
      SELECT id, data
      FROM clients
      WHERE data::text ILIKE ${searchTerm}
      LIMIT 20
    `
  ])

  const parsedClients = clients.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    return { id: row.id, ...data }
  })

  return res.status(200).json({
    query: q,
    results: {
      projects: projects.map(p => ({
        type: 'project',
        id: p.id,
        name: p.name,
        description: p.description?.substring(0, 100),
        client_id: p.client_id,
        status: p.status,
        priority: p.priority,
        billing_platform: p.billing_platform
      })),
      invoices: invoices.map(i => ({
        type: 'invoice',
        id: i.id,
        client_id: i.client_id,
        total: i.total,
        status: i.status,
        created_at: i.created_at
      })),
      clients: parsedClients.map(c => ({
        type: 'client',
        id: c.id,
        name: c.name,
        company: c.company,
        email: c.email
      }))
    },
    counts: {
      projects: projects.length,
      invoices: invoices.length,
      clients: parsedClients.length,
      total: projects.length + invoices.length + parsedClients.length
    }
  })
}

// ============ GOOGLE AUTH ============

function handleGoogleAuth(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI.'
    })
  }

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

async function handleGoogleCallback(req, res, sql) {
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

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

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

async function handleGoogleStatus(req, res, sql) {
  try {
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

// ============ PROPOSALS (READ-ONLY) ============

async function handleProposals(req, res, sql) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rows = await sql`
    SELECT id, data FROM proposals
    ORDER BY created_at DESC
  `

  const proposals = rows.map(row => {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    return {
      id: row.id,
      projectName: data.projectName,
      clientName: data.clientName,
      clientCompany: data.clientCompany,
      status: data.status,
      projectType: data.projectType,
      createdAt: data.createdAt,
      phases: data.phases
    }
  })

  return res.status(200).json(proposals)
}

async function handleProposalById(req, res, sql, id) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rows = await sql`SELECT id, data FROM proposals WHERE id = ${id}`
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Proposal not found' })
  }

  const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
  return res.status(200).json({ id: rows[0].id, ...data })
}

async function handleProposalConvert(req, res, sql, proposalId) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get proposal (READ-ONLY - we don't modify the original)
  const proposalRows = await sql`SELECT id, data FROM proposals WHERE id = ${proposalId}`
  if (proposalRows.length === 0) {
    return res.status(404).json({ error: 'Proposal not found' })
  }

  const proposalData = typeof proposalRows[0].data === 'string'
    ? JSON.parse(proposalRows[0].data)
    : proposalRows[0].data

  // Create project
  const timestamp = Date.now().toString(36)
  const projectId = `${proposalData.clientId || 'unknown'}-${proposalId}-${timestamp}`.substring(0, 60)

  const budgetLow = proposalData.phases?.reduce((sum, p) => sum + (p.hoursLow || 0) * 12000, 0) || 0
  const budgetHigh = proposalData.phases?.reduce((sum, p) => sum + (p.hoursHigh || 0) * 12000, 0) || 0

  await sql`
    INSERT INTO projects (
      id, client_id, proposal_id, name, description, status,
      priority, billing_type, billing_platform, budget_low, budget_high,
      rate, last_touched_at, notes
    ) VALUES (
      ${projectId}, ${proposalData.clientId}, ${proposalId}, ${proposalData.projectName},
      ${proposalData.projectDescription}, 'active', 0, 'fixed', 'os',
      ${budgetLow}, ${budgetHigh}, 12000, NOW(), ${`Converted from proposal ${proposalId}`}
    )
  `

  // Create chunks from phases
  const chunks = []
  for (const phase of (proposalData.phases || [])) {
    const avgHours = Math.round((phase.hoursLow + phase.hoursHigh) / 2)
    const numChunks = Math.ceil(avgHours / 3)

    for (let i = 0; i < numChunks; i++) {
      const chunkHours = Math.min(3, avgHours - (i * 3))
      if (chunkHours <= 0) continue

      const chunkId = `chk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
      const chunkName = numChunks > 1 ? `${phase.name} (${i + 1}/${numChunks})` : phase.name

      await sql`
        INSERT INTO chunks (id, project_id, phase_name, name, description, hours, status)
        VALUES (${chunkId}, ${projectId}, ${phase.name}, ${chunkName}, ${phase.description}, ${chunkHours}, 'pending')
      `

      chunks.push({ id: chunkId, name: chunkName, hours: chunkHours, phase: phase.name })
    }
  }

  const project = await sql`SELECT * FROM projects WHERE id = ${projectId}`

  return res.status(201).json({
    success: true,
    project: project[0],
    chunks,
    message: `Created project with ${chunks.length} chunks from proposal`
  })
}

// ============ SCHEDULE ============

const WORK_START_HOUR = 9
const WORK_END_HOUR = 17
const MAX_HOURS_PER_DAY = 6

async function handleScheduleDraft(req, res, sql) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rows = await sql`
    SELECT * FROM schedule_drafts
    WHERE status = 'draft'
    ORDER BY generated_at DESC
    LIMIT 1
  `

  if (rows.length === 0) {
    return res.status(404).json({ error: 'No draft schedule found' })
  }

  return res.status(200).json(rows[0])
}

async function handleScheduleDraftChunks(req, res, sql) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rows = await sql`
    SELECT c.*, p.name as project_name, p.client_id, p.priority
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.draft_scheduled_start IS NOT NULL
    ORDER BY c.draft_order ASC
  `

  return res.status(200).json(rows)
}

async function handleScheduleGenerate(req, res, sql) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get pending chunks
  const chunks = await sql`
    SELECT c.*, p.name as project_name, p.client_id, p.priority, p.last_touched_at
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.status = 'pending'
      AND p.status = 'active'
    ORDER BY p.priority DESC, p.last_touched_at DESC NULLS LAST
  `

  if (chunks.length === 0) {
    return res.status(400).json({ error: 'No pending chunks to schedule' })
  }

  // Calculate week bounds (next week)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysUntilMonday)
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  friday.setHours(23, 59, 59, 999)

  // Fetch calendar rocks if Google is connected
  let rocks = []
  try {
    const tokenRows = await sql`SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = 'google'`
    if (tokenRows.length > 0) {
      let accessToken = tokenRows[0].access_token
      const expiresAt = new Date(tokenRows[0].expires_at)

      // Refresh if expired
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
          await sql`UPDATE oauth_tokens SET access_token = ${accessToken}, expires_at = ${newExpires.toISOString()}, updated_at = NOW() WHERE provider = 'google'`
        }
      }

      // Fetch events
      const calendarId = process.env.GOOGLE_REFERENCE_CALENDAR_ID || 'primary'
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
      url.searchParams.set('timeMin', monday.toISOString())
      url.searchParams.set('timeMax', friday.toISOString())
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')

      const calRes = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${accessToken}` } })
      if (calRes.ok) {
        const calData = await calRes.json()
        rocks = (calData.items || []).map(event => {
          if (event.start?.dateTime && event.end?.dateTime) {
            return { start: new Date(event.start.dateTime), end: new Date(event.end.dateTime), title: event.summary }
          }
          if (event.start?.date) {
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

  // Generate time slots
  const slots = []
  const current = new Date(monday)
  while (current <= friday) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
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

  // Mark rocks
  let rocksAvoided = 0
  for (const slot of slots) {
    for (const rock of rocks) {
      if (slot.start < rock.end && slot.end > rock.start) {
        slot.available = false
        rocksAvoided++
        break
      }
    }
  }

  // Schedule chunks
  const scheduled = []
  let slotIndex = 0
  let hoursScheduledToday = 0
  let currentDay = null

  const sortedChunks = [...chunks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return new Date(b.last_touched_at || 0) - new Date(a.last_touched_at || 0)
  })

  for (const chunk of sortedChunks) {
    const hoursNeeded = chunk.hours
    let hoursAssigned = 0
    const scheduledSlots = []

    while (hoursAssigned < hoursNeeded && slotIndex < slots.length) {
      const slot = slots[slotIndex]
      const slotDay = slot.start.toDateString()
      if (currentDay !== slotDay) {
        currentDay = slotDay
        hoursScheduledToday = 0
      }

      if (!slot.available || hoursScheduledToday >= MAX_HOURS_PER_DAY) {
        slotIndex++
        continue
      }

      slot.available = false
      scheduledSlots.push(slot)
      hoursAssigned++
      hoursScheduledToday++
      slotIndex++
    }

    if (scheduledSlots.length > 0) {
      scheduled.push({
        chunk,
        start: scheduledSlots[0].start,
        end: scheduledSlots[scheduledSlots.length - 1].end
      })
    }
  }

  // Save draft
  const draftId = `draft-${Date.now().toString(36)}`

  await sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`
  await sql`UPDATE schedule_drafts SET status = 'expired', updated_at = NOW() WHERE status = 'draft'`

  await sql`
    INSERT INTO schedule_drafts (id, week_start, week_end, total_hours, chunk_count, rocks_avoided)
    VALUES (
      ${draftId},
      ${monday.toISOString().split('T')[0]},
      ${friday.toISOString().split('T')[0]},
      ${scheduled.reduce((sum, s) => sum + s.chunk.hours, 0)},
      ${scheduled.length},
      ${rocksAvoided}
    )
  `

  for (let i = 0; i < scheduled.length; i++) {
    const { chunk, start, end } = scheduled[i]
    await sql`
      UPDATE chunks
      SET draft_scheduled_start = ${start.toISOString()},
          draft_scheduled_end = ${end.toISOString()},
          draft_order = ${i},
          updated_at = NOW()
      WHERE id = ${chunk.id}
    `
  }

  return res.status(200).json({
    success: true,
    draftId,
    scheduled: scheduled.length,
    unscheduled: chunks.length - scheduled.length,
    rocksAvoided,
    weekStart: monday.toISOString(),
    weekEnd: friday.toISOString()
  })
}

async function handleSchedulePublish(req, res, sql) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const chunks = await sql`
    SELECT c.*, p.name as project_name, p.client_id
    FROM chunks c
    JOIN projects p ON c.project_id = p.id
    WHERE c.draft_scheduled_start IS NOT NULL
    ORDER BY c.draft_order ASC
  `

  if (chunks.length === 0) {
    return res.status(400).json({ error: 'No draft schedule to publish' })
  }

  // Get Google token
  const tokenRows = await sql`SELECT access_token, refresh_token, expires_at FROM oauth_tokens WHERE provider = 'google'`
  if (tokenRows.length === 0) {
    return res.status(400).json({ error: 'Google Calendar not connected' })
  }

  let accessToken = tokenRows[0].access_token
  const expiresAt = new Date(tokenRows[0].expires_at)

  // Refresh if expired
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
      await sql`UPDATE oauth_tokens SET access_token = ${accessToken}, expires_at = ${newExpires.toISOString()}, updated_at = NOW() WHERE provider = 'google'`
    }
  }

  const workCalendarId = process.env.GOOGLE_WORK_CALENDAR_ID || 'primary'
  const published = []
  const failed = []

  for (const chunk of chunks) {
    const event = {
      summary: `${chunk.project_name}: ${chunk.name}`,
      description: `Project: ${chunk.project_name}\nClient: ${chunk.client_id}\nChunk ID: ${chunk.id}\n\n${chunk.description || ''}`,
      start: {
        dateTime: chunk.draft_scheduled_start,
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: chunk.draft_scheduled_end,
        timeZone: 'America/New_York'
      },
      colorId: '9'
    }

    try {
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(workCalendarId)}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        }
      )

      if (calRes.ok) {
        const created = await calRes.json()
        await sql`
          UPDATE chunks
          SET scheduled_start = ${chunk.draft_scheduled_start},
              scheduled_end = ${chunk.draft_scheduled_end},
              calendar_event_id = ${created.id},
              status = 'scheduled',
              draft_scheduled_start = NULL,
              draft_scheduled_end = NULL,
              draft_order = NULL,
              updated_at = NOW()
          WHERE id = ${chunk.id}
        `
        published.push(chunk.id)
      } else {
        failed.push({ id: chunk.id, error: (await calRes.json()).error?.message })
      }
    } catch (err) {
      failed.push({ id: chunk.id, error: err.message })
    }
  }

  await sql`UPDATE schedule_drafts SET status = 'accepted', accepted_at = NOW() WHERE status = 'draft'`

  return res.status(200).json({
    success: true,
    published: published.length,
    failed: failed.length,
    failures: failed
  })
}

async function handleScheduleClear(req, res, sql) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  await sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`
  await sql`UPDATE schedule_drafts SET status = 'rejected', updated_at = NOW() WHERE status = 'draft'`

  return res.status(200).json({ success: true })
}

// ============ FEEDBACK ============

function generateFeedbackId() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `fb-${timestamp}-${random}`
}

async function handleFeedback(req, res, sql) {
  if (req.method === 'GET') {
    const rows = await sql`SELECT * FROM feedback ORDER BY created_at DESC`
    return res.status(200).json(rows)
  }

  if (req.method === 'POST') {
    const { text } = req.body
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' })
    }
    const id = generateFeedbackId()
    await sql`INSERT INTO feedback (id, text, created_at) VALUES (${id}, ${text.trim()}, NOW())`
    const rows = await sql`SELECT * FROM feedback WHERE id = ${id}`
    return res.status(200).json(rows[0])
  }

  if (req.method === 'DELETE') {
    await sql`DELETE FROM feedback`
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleFeedbackById(req, res, sql, id) {
  if (req.method === 'DELETE') {
    await sql`DELETE FROM feedback WHERE id = ${id}`
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

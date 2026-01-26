const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// OS database utilities
const db = require('./scripts/lib/db');

const app = express();
const PORT = 3002;

const DATA_DIR = path.join(__dirname, 'data');
const PROPOSALS_DIR = path.join(DATA_DIR, 'proposals');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');

app.use(cors());
app.use(express.json());

// Auth endpoint (matches Vercel serverless function)
app.post('/api/auth', (req, res) => {
  const { pin } = req.body;
  const correctPin = process.env.EDIT_PIN || '6350';

  if (pin === correctPin) {
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid PIN' });
  }
});

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
app.post('/api/clients', (req, res) => {
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
    const filePath = path.join(TEMPLATES_DIR, `${req.params.type}.json`);
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
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
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

    proposal.createdAt = proposal.createdAt || today;
    proposal.updatedAt = today;
    proposal.status = proposal.status || 'draft';

    const filePath = path.join(PROPOSALS_DIR, `${proposal.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2));
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// Update proposal
app.put('/api/proposals/:id', (req, res) => {
  try {
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
    const proposal = req.body;
    proposal.updatedAt = new Date().toISOString().split('T')[0];
    fs.writeFileSync(filePath, JSON.stringify(proposal, null, 2));
    res.json(proposal);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// Delete proposal
app.delete('/api/proposals/:id', (req, res) => {
  try {
    const filePath = path.join(PROPOSALS_DIR, `${req.params.id}.json`);
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
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const item = await db.createFeedback(text.trim());
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

// Update proposal in OS Beta (firewalled - changes do NOT affect live)
app.put('/api/os-beta/proposals/:id', async (req, res) => {
  try {
    const proposal = req.body;
    await db.sql`
      UPDATE os_beta_proposals
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

// Delete proposal from OS Beta (firewalled - does NOT affect live)
app.delete('/api/os-beta/proposals/:id', async (req, res) => {
  try {
    await db.sql`DELETE FROM os_beta_proposals WHERE id = ${req.params.id}`;
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

    // Update proposal status to "accepted" since it's now a project
    proposal.status = 'accepted';
    await db.sql`
      UPDATE proposals
      SET data = ${JSON.stringify(proposal)}::jsonb,
          updated_at = NOW()
      WHERE id = ${req.params.id}
    `;

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

  res.redirect(authUrl.toString());
});

// Google OAuth callback
app.get('/api/os-beta/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1>Authorization Failed</h1><p>Error: ${error}</p>
        <a href="/dashboard/os-beta">Back to OS</a>
      </body></html>
    `);
  }

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
    console.log('Google token response:', JSON.stringify(tokens, null, 2));
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
          <a href="http://localhost:5173/dashboard/os-beta" style="background: #d72027; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
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
        <p>${err.message}</p>
        <a href="/dashboard/os-beta">Back to OS</a>
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

// Schedule - Generate draft (simplified for local dev - use npm run schedule for full generation)
app.post('/api/os-beta/schedule/generate', async (req, res) => {
  try {
    // Get pending chunks
    const chunks = await db.sql`
      SELECT c.*, p.name as project_name, p.client_id, p.priority, p.last_touched_at
      FROM chunks c
      JOIN projects p ON c.project_id = p.id
      WHERE c.status = 'pending' AND p.status = 'active'
      ORDER BY p.priority DESC, p.last_touched_at DESC NULLS LAST
    `;

    if (chunks.length === 0) {
      return res.status(400).json({ error: 'No pending chunks to schedule' });
    }

    // Simple scheduling - next week Mon-Fri, 9-5, max 6 hours/day
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + daysUntilMonday);
    monday.setHours(9, 0, 0, 0);

    // Clear existing draft
    await db.sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`;
    await db.sql`UPDATE schedule_drafts SET status = 'expired', updated_at = NOW() WHERE status = 'draft'`;

    // Generate schedule
    const scheduled = [];
    let currentSlot = new Date(monday);
    let hoursToday = 0;

    for (const chunk of chunks) {
      // Skip weekends
      while (currentSlot.getDay() === 0 || currentSlot.getDay() === 6) {
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(9, 0, 0, 0);
        hoursToday = 0;
      }

      // Check if we've hit daily limit
      if (hoursToday >= 6 || currentSlot.getHours() >= 17) {
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(9, 0, 0, 0);
        hoursToday = 0;
        // Skip weekends again
        while (currentSlot.getDay() === 0 || currentSlot.getDay() === 6) {
          currentSlot.setDate(currentSlot.getDate() + 1);
        }
      }

      const start = new Date(currentSlot);
      const end = new Date(currentSlot);
      end.setHours(start.getHours() + chunk.hours);

      scheduled.push({ chunk, start, end });

      currentSlot.setHours(end.getHours());
      hoursToday += chunk.hours;
    }

    // Save draft
    const draftId = `draft-${Date.now().toString(36)}`;
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    await db.sql`
      INSERT INTO schedule_drafts (id, week_start, week_end, total_hours, chunk_count, rocks_avoided)
      VALUES (${draftId}, ${monday.toISOString().split('T')[0]}, ${friday.toISOString().split('T')[0]},
        ${scheduled.reduce((sum, s) => sum + s.chunk.hours, 0)}, ${scheduled.length}, 0)
    `;

    for (let i = 0; i < scheduled.length; i++) {
      const { chunk, start, end } = scheduled[i];
      await db.sql`
        UPDATE chunks
        SET draft_scheduled_start = ${start.toISOString()}, draft_scheduled_end = ${end.toISOString()}, draft_order = ${i}, updated_at = NOW()
        WHERE id = ${chunk.id}
      `;
    }

    res.json({ success: true, draftId, scheduled: scheduled.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
            draft_order = NULL,
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

// Schedule - Clear draft
app.post('/api/os-beta/schedule/clear', async (req, res) => {
  try {
    await db.sql`UPDATE chunks SET draft_scheduled_start = NULL, draft_scheduled_end = NULL, draft_order = NULL`;
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

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

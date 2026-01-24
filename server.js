const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});

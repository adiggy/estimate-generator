#!/usr/bin/env node
/**
 * Backup a proposal to a versioned JSON file
 * Usage: node scripts/backup-proposal.js <proposal-id> [version-name]
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

const sql = neon(process.env.DATABASE_URL);

async function backupProposal(proposalId, versionName) {
  // Fetch proposal from database
  const result = await sql`
    SELECT id, data FROM proposals WHERE id = ${proposalId}
  `;

  if (result.length === 0) {
    console.error('Proposal not found:', proposalId);
    process.exit(1);
  }

  const proposal = result[0];
  const data = typeof proposal.data === 'string'
    ? JSON.parse(proposal.data)
    : proposal.data;

  // Determine archive path
  const archivePath = data.archivePath || `archive/${proposalId}`;
  const versionsDir = path.join(archivePath, 'versions');

  // Create versions directory if it doesn't exist
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  // Generate filename with timestamp and version name
  const timestamp = new Date().toISOString().split('T')[0];
  const safeName = versionName
    ? versionName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase()
    : 'backup';
  const filename = `${timestamp}_${safeName}.json`;
  const filepath = path.join(versionsDir, filename);

  // Save the proposal data
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

  console.log('Backup saved:', filepath);
  return filepath;
}

// CLI usage
if (require.main === module) {
  const [,, proposalId, ...versionParts] = process.argv;
  const versionName = versionParts.join(' ');

  if (!proposalId) {
    console.log('Usage: node scripts/backup-proposal.js <proposal-id> [version-name]');
    console.log('Example: node scripts/backup-proposal.js 2026-01-23-water-institute-rebrand "before phase updates"');
    process.exit(1);
  }

  backupProposal(proposalId, versionName).catch(console.error);
}

module.exports = { backupProposal };

#!/usr/bin/env node
/**
 * Fix Proposal Status Script
 * Reverts proposals that were incorrectly marked as "accepted" back to "draft"
 * The os-beta code should NOT modify proposal statuses - proposals are independent.
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function fixProposalStatuses() {
  console.log('Checking for proposals with status "accepted"...\n');

  // Find proposals with accepted status
  const proposals = await sql`
    SELECT id, data->>'status' as status, data->>'projectName' as name
    FROM proposals
    WHERE data->>'status' = 'accepted'
  `;

  if (proposals.length === 0) {
    console.log('No proposals with status "accepted" found. Nothing to fix.');
    return;
  }

  console.log(`Found ${proposals.length} proposals to fix:\n`);
  for (const p of proposals) {
    console.log(`  - ${p.id}: ${p.name}`);
  }

  console.log('\nReverting to "draft" status...\n');

  for (const p of proposals) {
    // Get current data
    const [row] = await sql`SELECT data FROM proposals WHERE id = ${p.id}`;
    const data = row.data;

    // Fix the status
    data.status = 'draft';

    // Update
    await sql`
      UPDATE proposals
      SET data = ${JSON.stringify(data)}::jsonb,
          updated_at = NOW()
      WHERE id = ${p.id}
    `;

    console.log(`  ✓ Fixed: ${p.id}`);
  }

  console.log('\nDone! All proposals reverted to "draft" status.');
}

fixProposalStatuses().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

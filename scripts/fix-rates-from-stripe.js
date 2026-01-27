#!/usr/bin/env node
/**
 * Fix hosting rates using actual Stripe charge data
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

// Mapping of Stripe payer names to client_ids and their actual monthly rate
// Based on Stripe API data showing recurring charge amounts
const stripeRates = {
  // Payer name → { clientId, rate in dollars }
  'Aiden Dale': { clientId: 'aiden-dale-art', rate: 22.66 },
  'Burk Uzzle': { clientId: 'burk-uzzle', rate: 27.81 },
  'mary justus': { clientId: 'maryjustus-com', rate: 31.42 },
  'Richard Craig': { clientId: 'international-eco-fuels', rate: 35.74 },
  'Hollis Curtis': { clientId: 'hr-curtis-plumbing', rate: 36.05 },
  'Cynthia Wheaton': { clientId: 'wheaton-group', rate: 36.82 },
  'Cynthia Wheaton (EF)': { clientId: 'entrepreneurs-friend', rate: 36.82 },
  'Robin Whitley': { clientId: 'unc-water-institute', rate: 37.08, project: 'Website hosting' },
  'Robin Whitley (GLFW)': { clientId: 'unc-water-institute', rate: 52.20, project: 'Global Lead-Free Water' },
  'John Coley': { clientId: 'skybrook', rate: 37.60 },
  'Tom Taber': { clientId: 't4-associates', rate: 37.93 },
  'Todd Peterson': { clientId: 'honintser', rate: 37.93 },
  'Kaitlin MacCallum': { clientId: 'davinci-elentra-', rate: 37.93 },
  'Angela': { clientId: 'definian-data', rate: 37.93 },
  'Tony Britt': { clientId: 'spottercharts', rate: 38.11 },
  'Anne C Weston': { clientId: 'green-burial-project', rate: 38.63 },
  'Anne C Weston (Gillings)': { clientId: 'gillings-projects', rate: 79.00 },
  'Donald Whittier': { clientId: 'donald-whittier', rate: 39.15 },
  'Liz Star Winer (HopeStar)': { clientId: 'liz-star-hopestar-', rate: 41.06 },
  'Amy Pancake': { clientId: 'continuum-teachers', rate: 59.48 },
  'Amy Lynn Ullrick': { clientId: 'the-prosecutors-and-politics-p', rate: 66.15 },
  'Branson Moore': { clientId: 'gillings-projects', rate: 79.00 },
  'Rebecca Clewell': { clientId: 'rebecca-clewell', rate: 37.93 },
  'Sabine': { clientId: 'resonant-body', rate: 27.09 },
  'Catherine A Pascal': { clientId: 'life-forward-movement', rate: 37.93 },
};

// Direct client_id → rate mapping (consolidated from above)
const corrections = {
  'aiden-dale-art': 2266,
  'burk-uzzle': 2781,
  'maryjustus-com': 3142,
  'international-eco-fuels': 3574,
  'hr-curtis-plumbing': 3605,
  'wheaton-group': 3682,
  'entrepreneurs-friend': 3682,
  'skybrook': 3760,
  't4-associates': 3793,
  'honintser': 3793,
  'davinci-elentra-': 3793,
  'definian-data': 3793,
  'spottercharts': 3811,
  'green-burial-project': 3863,
  'donald-whittier': 3915,
  'liz-star-hopestar-': 4106,  // Was wrong!
  'continuum-teachers': 5948,
  'the-prosecutors-and-politics-p': 6615,
  'gillings-projects': 7900,
  'rebecca-clewell': 3793,
  'resonant-body': 2709,
  'life-forward-movement': 3793,
};

async function main() {
  console.log('Updating hosting_billing rates from Stripe data...\n');

  // First, show current vs new
  const current = await sql`
    SELECT client_id, client_name, rate_cents, webflow_cost_cents
    FROM hosting_billing
    ORDER BY client_id
  `;

  console.log('Changes to be made:\n');
  console.log('Client ID                         | Current  | New      | Change');
  console.log('-'.repeat(70));

  let changeCount = 0;
  for (const row of current) {
    const newRate = corrections[row.client_id];
    if (newRate && newRate !== row.rate_cents) {
      const diff = newRate - row.rate_cents;
      const sign = diff > 0 ? '+' : '';
      console.log(
        `${row.client_id.padEnd(33)} | $${(row.rate_cents/100).toFixed(2).padStart(6)} | $${(newRate/100).toFixed(2).padStart(6)} | ${sign}$${(diff/100).toFixed(2)}`
      );
      changeCount++;
    }
  }

  if (changeCount === 0) {
    console.log('No changes needed - all rates match Stripe data.');
    return;
  }

  console.log(`\nApplying ${changeCount} rate corrections...`);

  // Apply corrections
  for (const [clientId, rateCents] of Object.entries(corrections)) {
    await sql`
      UPDATE hosting_billing
      SET rate_cents = ${rateCents},
          profit_cents = ${rateCents} - webflow_cost_cents,
          updated_at = NOW()
      WHERE client_id = ${clientId}
    `;

    // Also update projects table
    await sql`
      UPDATE projects
      SET rate = ${rateCents}
      WHERE client_id = ${clientId}
        AND (billing_platform = 'bonsai_legacy' OR billing_type = 'recurring')
    `;
  }

  // Special case: UNC Water Institute has 2 projects with different rates
  await sql`
    UPDATE hosting_billing
    SET rate_cents = 5220, profit_cents = 5220 - webflow_cost_cents
    WHERE client_id = 'unc-water-institute' AND project_name LIKE '%Global%'
  `;
  await sql`
    UPDATE hosting_billing
    SET rate_cents = 3708, profit_cents = 3708 - webflow_cost_cents
    WHERE client_id = 'unc-water-institute' AND project_name = 'Website hosting'
  `;

  // Verify
  console.log('\n=== UPDATED RATES ===\n');
  const updated = await sql`
    SELECT client_id, client_name, rate_cents, webflow_cost_cents, profit_cents
    FROM hosting_billing
    ORDER BY rate_cents DESC
  `;

  let totalMRR = 0;
  let totalProfit = 0;

  for (const row of updated) {
    totalMRR += row.rate_cents;
    totalProfit += row.profit_cents;
    console.log(
      `${row.client_id.padEnd(35)} $${(row.rate_cents/100).toFixed(2).padStart(6)}/mo  profit $${(row.profit_cents/100).toFixed(2).padStart(6)}`
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Total MRR: $${(totalMRR/100).toFixed(2)}`);
  console.log(`Total Monthly Profit: $${(totalProfit/100).toFixed(2)}`);
}

main().catch(console.error);

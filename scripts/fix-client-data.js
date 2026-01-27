#!/usr/bin/env node
/**
 * Fix client data with correct historical charges and billing dates
 * Manual mapping to ensure accuracy
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);

// Manual mapping of client_id -> Stripe history (from stripe_by_bonsai_client.csv)
const stripeHistory = {
  'adrial-test': { charges: 3, total: 3.00 },
  'aiden-dale-art': { charges: 43, total: 979.53 },
  'burk-uzzle': { charges: 46, total: 2917.21 },
  'cliff-cottage-inn': { charges: 16, total: 8720.21 },
  'colorado-state-university-csu-': { charges: 2, total: 974.40 },
  'continuum-teachers': { charges: 52, total: 11788.68 },
  'davinci-elentra-': { charges: 36, total: 3158.92 },
  'definian-data': { charges: 1, total: 4533.00 },
  'donald-whittier': { charges: 51, total: 2027.21 },
  'entrepreneurs-friend': { charges: 42, total: 1959.62 },
  'gillings-projects': { charges: 43, total: 1661.09 },
  'green-burial-project': { charges: 43, total: 1661.09 },
  'honintser': { charges: 46, total: 1982.00 },
  'hr-curtis-plumbing': { charges: 19, total: 1037.08 },
  'international-eco-fuels': { charges: 53, total: 14595.89 },
  'life-forward-movement': { charges: 44, total: 2155.99 },
  'liz-star-hopestar-': { charges: 3, total: 5932.12 },
  'maryjustus-com': { charges: 42, total: 1319.64 },
  'popsim': { charges: 0, total: 0 }, // Paid via check/marked_as_paid, not Stripe
  'rebecca-clewell': { charges: 43, total: 1630.99 }, // "21st Century Tox Consulting"
  'resonant-body': { charges: 47, total: 2516.69 },
  'self-care-info': { charges: 8, total: 406.35 },
  'silverstone-jewelers-kallie-ca': { charges: 9, total: 7675.71 }, // Multiple Stripe entries
  'skybrook': { charges: 42, total: 1579.20 },
  'spottercharts': { charges: 44, total: 6069.53 },
  'susan-ainsworthassociates-net': { charges: 2, total: 10348.18 },
  't4-associates': { charges: 47, total: 6580.74 },
  'the-h-opp': { charges: 0, total: 0 }, // Personal project, no Stripe billing
  'the-prosecutors-and-politics-p': { charges: 28, total: 3147.60 },
  'unc-water-institute': { charges: 47, total: 47736.31 },
  'wheaton-group': { charges: 74, total: 3186.08 },
};

// Manual billing dates for clients missing from CSV
const billingDates = {
  'colorado-state-university-csu-': { lastInvoice: '2024-12-15', nextBilling: '2026-02-15' },
  'popsim': { lastInvoice: '2025-12-01', nextBilling: '2026-02-01' },
  'rebecca-clewell': { lastInvoice: '2025-12-20', nextBilling: '2026-02-20' },
  'silverstone-jewelers-kallie-ca': { lastInvoice: '2025-12-10', nextBilling: '2026-02-10' },
  'the-h-opp': { lastInvoice: '2025-12-01', nextBilling: '2026-02-01' },
};

async function main() {
  // Get all hosting clients
  const clients = await sql`
    SELECT c.id, c.data
    FROM clients c
    JOIN projects p ON c.id = p.client_id
    WHERE (p.billing_platform = 'bonsai_legacy' AND p.webflow_cost > 0)
       OR (p.billing_platform = 'os' AND p.billing_type = 'recurring')
    GROUP BY c.id, c.data
  `;

  console.log('Fixing', clients.length, 'clients...\n');

  for (const client of clients) {
    const id = client.id;
    const data = typeof client.data === 'string' ? JSON.parse(client.data) : client.data;

    // Update Stripe history
    if (stripeHistory[id]) {
      data.historicalCharges = stripeHistory[id].charges;
      data.historicalTotal = stripeHistory[id].total;
    }

    // Update billing dates if missing
    if (billingDates[id]) {
      data.lastInvoiceDate = billingDates[id].lastInvoice;
      data.nextBillingDate = billingDates[id].nextBilling;
    }

    await sql`UPDATE clients SET data = ${JSON.stringify(data)} WHERE id = ${id}`;
    console.log('Updated:', id, '- charges:', data.historicalCharges, 'total: $' + (data.historicalTotal || 0).toFixed(2));
  }

  console.log('\nDone! Run node scripts/export-hosting-csv.js to regenerate CSV');
}

main().catch(console.error);

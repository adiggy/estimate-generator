#!/usr/bin/env node
/**
 * Export hosting clients to CSV from the hosting_billing table (source of truth)
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);

// CSV escape helper
function esc(s) {
  if (!s) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

async function main() {
  // Get all records from hosting_billing table
  const records = await sql`
    SELECT *
    FROM hosting_billing
    ORDER BY billing_frequency DESC, client_name, project_name
  `;

  console.log('Loaded', records.length, 'hosting records from database');

  // Build CSV with billing_frequency column
  const rows = [
    'client_id,client_name,contact_name,email,stripe_customer_id,stripe_status,' +
    'project_id,project_name,rate_cents,webflow_cost_cents,profit_cents,' +
    'last_invoice_date,next_billing_date,billing_platform,billing_frequency,' +
    'historical_charges,historical_total_usd'
  ];

  let totalMonthly = 0;
  let totalProfit = 0;
  let annualCount = 0;

  for (const r of records) {
    totalMonthly += r.rate_cents || 0;
    totalProfit += r.profit_cents || 0;
    if (r.billing_frequency === 'annual') annualCount++;

    rows.push([
      esc(r.client_id),
      esc(r.client_name),
      esc(r.contact_name),
      esc(r.email),
      esc(r.stripe_customer_id),
      r.stripe_status || 'needs_setup',
      esc(r.project_id),
      esc(r.project_name),
      r.rate_cents || 0,
      r.webflow_cost_cents || 0,
      r.profit_cents || 0,
      r.last_invoice_date || '',
      r.next_billing_date || '',
      r.billing_platform || '',
      r.billing_frequency || 'monthly',
      r.historical_charges || 0,
      r.historical_total_usd || '0.00'
    ].join(','));
  }

  fs.writeFileSync('legacy_data/stripe_migration_status.csv', rows.join('\n'));

  console.log('\n=== EXPORT COMPLETE ===');
  console.log('File: legacy_data/stripe_migration_status.csv');
  console.log('Projects:', rows.length - 1);
  console.log('Monthly billing:', records.length - annualCount);
  console.log('Annual billing:', annualCount);
  console.log('Monthly revenue: $' + (totalMonthly / 100).toFixed(2));
  console.log('Monthly profit: $' + (totalProfit / 100).toFixed(2));
}

main().catch(console.error);

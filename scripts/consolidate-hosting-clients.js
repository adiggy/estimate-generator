#!/usr/bin/env node
/**
 * Consolidate all hosting client data from multiple sources:
 * - Bonsai contacts (name, contact, email)
 * - Billing dates CSV (last invoice, next billing)
 * - Stripe history (charges, cardholder)
 * - Current DB records
 *
 * Updates the clients table and exports comprehensive CSV
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);

async function main() {
  // ========================================
  // 1. Load all data sources
  // ========================================

  // Bonsai contacts (name, contact, email)
  const bonsaiCsv = fs.readFileSync('legacy_data/bonsai/adrial_companiescontact_export_2026-01-25_3959ba027e5a1d707d824b9507ad.csv', 'utf8');
  const bonsaiContacts = {};
  bonsaiCsv.split('\n').slice(1).forEach(line => {
    const match = line.match(/^"?([^,"]+)"?,"?([^,"]+)"?,"?([^,"]+)"?/);
    if (match) {
      bonsaiContacts[match[1].trim().toLowerCase()] = {
        bonsaiName: match[1].trim(),
        contactName: match[2].trim(),
        email: match[3].trim()
      };
    }
  });

  // Billing dates (next_billing_date, last_invoice_date)
  const billingCsv = fs.readFileSync('legacy_data/hosting_billing_dates.csv', 'utf8');
  const billingDates = {};
  billingCsv.split('\n').slice(1).forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 8) {
      const clientId = parts[0].trim();
      const projectName = parts[1].trim();
      billingDates[clientId + '|' + projectName] = {
        bonsaiClientName: parts[3].trim(),
        lastInvoiceDate: parts[6].trim(),
        nextBillingDate: parts[7].trim()
      };
    }
  });

  // Stripe history (total charges)
  const stripeCsv = fs.readFileSync('legacy_data/stripe_by_bonsai_client.csv', 'utf8');
  const stripeData = {};
  stripeCsv.split('\n').slice(1).forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 4) {
      const bonsaiClient = parts[0].trim().toLowerCase();
      stripeData[bonsaiClient] = {
        chargeCount: parseInt(parts[1]) || 0,
        totalCharged: parseFloat(parts[2]) || 0,
        cardholderNames: parts[4]?.trim()
      };
    }
  });

  console.log('Data sources loaded:');
  console.log('  Bonsai contacts:', Object.keys(bonsaiContacts).length);
  console.log('  Billing dates:', Object.keys(billingDates).length);
  console.log('  Stripe history:', Object.keys(stripeData).length);

  // ========================================
  // 2. Get all hosting projects from DB
  // ========================================

  const projects = await sql`
    SELECT p.*, c.id as c_id, c.data as client_data, c.stripe_customer_id
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE (p.billing_platform = 'bonsai_legacy' AND p.webflow_cost > 0)
       OR (p.billing_platform = 'os' AND p.billing_type = 'recurring')
    ORDER BY c.data->>'name', p.name
  `;

  console.log('  Hosting projects:', projects.length);

  // ========================================
  // 3. Build consolidated client records
  // ========================================

  const clientUpdates = {};

  for (const p of projects) {
    const clientId = p.client_id;
    if (!clientId) {
      console.log('  WARNING: Project without client_id:', p.id, p.name);
      continue;
    }

    const clientData = typeof p.client_data === 'string'
      ? JSON.parse(p.client_data)
      : (p.client_data || {});
    const clientName = clientData.name || clientId;

    // Find matching Bonsai contact by fuzzy match
    let bonsai = null;
    const searchTerms = [
      clientName.toLowerCase(),
      clientId.replace(/-/g, ' ').toLowerCase()
    ];

    for (const term of searchTerms) {
      for (const [key, val] of Object.entries(bonsaiContacts)) {
        const keyFirst = key.split(' ')[0];
        const termFirst = term.split(' ')[0];
        if (key.includes(termFirst) || term.includes(keyFirst)) {
          bonsai = val;
          break;
        }
      }
      if (bonsai) break;
    }

    // Find billing dates for this specific project
    const billingKey = clientId + '|' + p.name;
    const billing = billingDates[billingKey] || {};

    // Find Stripe history by Bonsai client name match
    let stripe = null;
    const bonsaiName = billing.bonsaiClientName || bonsai?.bonsaiName || clientName;
    for (const [key, val] of Object.entries(stripeData)) {
      if (key.includes(bonsaiName.toLowerCase().split(' ')[0]) ||
          bonsaiName.toLowerCase().includes(key.split(' ')[0])) {
        stripe = val;
        break;
      }
    }

    // Initialize client record if first project
    if (!clientUpdates[clientId]) {
      clientUpdates[clientId] = {
        id: clientId,
        name: bonsai?.bonsaiName || clientData.name || clientId,
        contactName: bonsai?.contactName || clientData.contactName,
        email: bonsai?.email || clientData.email,
        stripeCustomerId: p.stripe_customer_id,
        historicalCharges: stripe?.chargeCount || 0,
        historicalTotal: stripe?.totalCharged || 0,
        cardholderName: stripe?.cardholderNames,
        projects: []
      };
    }

    // Add project details
    clientUpdates[clientId].projects.push({
      projectId: p.id,
      projectName: p.name,
      rate: p.rate,
      webflowCost: p.webflow_cost,
      profit: (p.rate || 0) - (p.webflow_cost || 0),
      billingPlatform: p.billing_platform,
      lastInvoiceDate: billing.lastInvoiceDate || null,
      nextBillingDate: billing.nextBillingDate || null
    });
  }

  console.log('\nUnique clients:', Object.keys(clientUpdates).length);

  // ========================================
  // 4. Update clients table (source of truth)
  // ========================================

  console.log('\nUpdating clients table...');
  let updated = 0;

  for (const [clientId, data] of Object.entries(clientUpdates)) {
    const clientJson = {
      id: data.id,
      name: data.name,
      contactName: data.contactName,
      email: data.email,
      historicalCharges: data.historicalCharges,
      historicalTotal: data.historicalTotal,
      cardholderName: data.cardholderName,
      projectCount: data.projects.length,
      monthlyTotal: data.projects.reduce((sum, p) => sum + (p.rate || 0), 0),
      monthlyProfit: data.projects.reduce((sum, p) => sum + p.profit, 0)
    };

    await sql`
      UPDATE clients
      SET data = ${JSON.stringify(clientJson)}
      WHERE id = ${clientId}
    `;
    updated++;
  }

  console.log('Updated:', updated, 'clients');

  // ========================================
  // 5. Export comprehensive CSV
  // ========================================

  const csvRows = [
    'client_id,client_name,contact_name,email,stripe_customer_id,stripe_status,' +
    'project_id,project_name,rate_cents,webflow_cost_cents,profit_cents,' +
    'last_invoice_date,next_billing_date,billing_platform,' +
    'historical_charges,historical_total_usd'
  ];

  let totalMonthly = 0;
  let totalProfit = 0;
  let readyCount = 0;
  let needsSetupCount = 0;

  for (const [clientId, client] of Object.entries(clientUpdates)) {
    for (const proj of client.projects) {
      const stripeStatus = client.stripeCustomerId ? 'ready' : 'needs_setup';
      if (client.stripeCustomerId) readyCount++; else needsSetupCount++;

      totalMonthly += proj.rate || 0;
      totalProfit += proj.profit;

      // Helper to escape CSV fields with commas
      const esc = (s) => {
        if (!s) return '';
        const str = String(s);
        if (str.includes(',') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      csvRows.push([
        esc(clientId),
        esc(client.name),
        esc(client.contactName),
        esc(client.email),
        esc(client.stripeCustomerId),
        stripeStatus,
        esc(proj.projectId),
        esc(proj.projectName),
        proj.rate || 0,
        proj.webflowCost || 0,
        proj.profit,
        proj.lastInvoiceDate || '',
        proj.nextBillingDate || '',
        proj.billingPlatform,
        client.historicalCharges,
        client.historicalTotal.toFixed(2)
      ].join(','));
    }
  }

  fs.writeFileSync('legacy_data/stripe_migration_status.csv', csvRows.join('\n'));

  console.log('\n=== EXPORT COMPLETE ===');
  console.log('File: legacy_data/stripe_migration_status.csv');
  console.log('Projects:', csvRows.length - 1);
  console.log('Unique clients:', Object.keys(clientUpdates).length);
  console.log('Monthly revenue: $' + (totalMonthly / 100).toFixed(2));
  console.log('Monthly profit: $' + (totalProfit / 100).toFixed(2));
  console.log('Stripe ready:', readyCount);
  console.log('Needs card setup:', needsSetupCount);

  // Show multi-project clients
  console.log('\n=== CLIENTS WITH MULTIPLE PROJECTS ===');
  for (const [clientId, client] of Object.entries(clientUpdates)) {
    if (client.projects.length > 1) {
      console.log(`\n${client.name} (${client.projects.length} projects):`);
      for (const proj of client.projects) {
        console.log(`  - ${proj.projectName}: $${(proj.rate/100).toFixed(2)}/mo`);
      }
    }
  }
}

main().catch(console.error);

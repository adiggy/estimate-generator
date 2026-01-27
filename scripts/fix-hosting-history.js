#!/usr/bin/env node
/**
 * Fix historical charges to only count hosting invoices (not project work)
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const fs = require('fs');

const sql = neon(process.env.DATABASE_URL);

// Proper CSV parsing that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function main() {
  // Read Bonsai invoice export
  const invoiceCsv = fs.readFileSync(
    'legacy_data/bonsai/adrial_invoice_export_2026-01-25_d6659ed2b281da5ab3f077337348.csv',
    'utf8'
  );

  const lines = invoiceCsv.split('\n').slice(1); // Skip header

  // Count hosting-only invoices by client
  // CSV columns: 0=status, 1=total_amount, 15=project_name, 16=client_name
  const hostingByClient = {};

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = parseCSVLine(line);
    const status = parts[0];
    const amount = parseFloat(parts[1]) || 0;
    const projectName = (parts[15] || '').toLowerCase();
    const clientName = parts[16] || '';

    // Only count paid invoices with "hosting" in project name
    if (status === 'paid' && projectName.includes('hosting') && amount > 0) {
      if (!hostingByClient[clientName]) {
        hostingByClient[clientName] = { count: 0, total: 0 };
      }
      hostingByClient[clientName].count++;
      hostingByClient[clientName].total += amount;
    }
  }

  console.log('Hosting invoices by Bonsai client:\n');
  console.log('Client                                    | Count | Total');
  console.log('-'.repeat(65));

  const sorted = Object.entries(hostingByClient).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [client, data] of sorted) {
    console.log(`${client.substring(0, 40).padEnd(40)} | ${String(data.count).padStart(5)} | $${data.total.toFixed(2)}`);
  }

  // Map Bonsai client names to our client_ids
  const clientMapping = {
    '21st Century Tox Consulting': 'rebecca-clewell',
    'Aiden Dale Art': 'aiden-dale-art',
    'Ainsworth & Associates': 'susan-ainsworthassociates-net',
    'Burk Uzzle': 'burk-uzzle',
    'Cliff Cottage Inn': 'cliff-cottage-inn',
    'Colorado State University (CSU)': 'colorado-state-university-csu-',
    'Continuum Teachers': 'continuum-teachers',
    'Davinci': 'davinci-elentra-',
    'Davinci (Elentra)': 'davinci-elentra-',
    'Definian (Premier Intl)': 'definian-data',
    'Definian Data': 'definian-data',
    '"Definian Data': 'definian-data',  // Handle quote issue
    'Donald Whittier': 'donald-whittier',
    'Entrepreneurs Friend': 'entrepreneurs-friend',
    'Gillings Projects': 'gillings-projects',
    'Green Burial Project': 'green-burial-project',
    'Honintser': 'honintser',
    'HR Curtis Plumbing': 'hr-curtis-plumbing',
    'Inner Essence': null,  // Not a current hosting client
    'International Eco Fuels': 'international-eco-fuels',
    'Life Forward Movement': 'life-forward-movement',
    'Liz Star (HopeStar)': 'liz-star-hopestar-',
    'Liz Star Winer (HopeStar)': 'liz-star-hopestar-',
    'maryjustus.com': 'maryjustus-com',
    'maryjustus.com ': 'maryjustus-com',
    'Premier International': 'international-eco-fuels',  // Same client, different name
    'Resonant Body': 'resonant-body',
    'Self-Care Info': 'self-care-info',
    'Self-Healing Options': 'self-care-info',  // Same client
    'Silverstone Jewelers (Kallie Carver)': 'silverstone-jewelers-kallie-ca',
    'Skybrook': 'skybrook',
    'Spottercharts': 'spottercharts',
    'T4 Associates': 't4-associates',
    'The Prosecutors and Politics Project (PPP)': 'the-prosecutors-and-politics-p',
    'UNC Water Institute': 'unc-water-institute',
    'Wheaton Group': 'wheaton-group',
  };

  // Aggregate by client_id
  const byClientId = {};
  for (const [bonsaiName, data] of Object.entries(hostingByClient)) {
    const clientId = clientMapping[bonsaiName];
    if (clientId) {
      if (!byClientId[clientId]) {
        byClientId[clientId] = { count: 0, total: 0 };
      }
      byClientId[clientId].count += data.count;
      byClientId[clientId].total += data.total;
    }
  }

  console.log('\n\n=== UPDATING DATABASE ===\n');

  // Update hosting_billing table
  for (const [clientId, data] of Object.entries(byClientId)) {
    await sql`
      UPDATE hosting_billing
      SET historical_charges = ${data.count},
          historical_total_usd = ${data.total.toFixed(2)}
      WHERE client_id = ${clientId}
    `;
    console.log(`${clientId.padEnd(35)} ${data.count} charges, $${data.total.toFixed(2)}`);
  }

  // Set clients with no hosting history to 0
  const noHistory = [
    'adrial-test',
    'popsim',
    'the-h-opp'
  ];
  for (const clientId of noHistory) {
    await sql`
      UPDATE hosting_billing
      SET historical_charges = 0,
          historical_total_usd = 0
      WHERE client_id = ${clientId}
    `;
  }

  console.log('\nDone! Run `node scripts/export-hosting-csv.js` to regenerate CSV.');
}

main().catch(console.error);

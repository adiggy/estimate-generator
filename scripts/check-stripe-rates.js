#!/usr/bin/env node
/**
 * Query Stripe API directly to get actual charge amounts
 */

require('dotenv').config();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function main() {
  console.log('Fetching charges from Stripe API...\n');

  // Get all charges (paginate through)
  const allCharges = [];
  let hasMore = true;
  let startingAfter = null;

  while (hasMore) {
    const params = { limit: 100 };
    if (startingAfter) params.starting_after = startingAfter;

    const charges = await stripe.charges.list(params);
    allCharges.push(...charges.data);
    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }

    if (allCharges.length > 2000) break;
  }

  console.log(`Fetched ${allCharges.length} total charges\n`);

  // Group by payer name
  const byPayer = {};

  for (const c of allCharges) {
    if (c.status !== 'succeeded') continue;

    const name = c.billing_details?.name || 'Unknown';
    const amount = c.amount / 100;

    if (!byPayer[name]) {
      byPayer[name] = { amounts: {}, total: 0, count: 0 };
    }

    const amtKey = amount.toFixed(2);
    byPayer[name].amounts[amtKey] = (byPayer[name].amounts[amtKey] || 0) + 1;
    byPayer[name].total += amount;
    byPayer[name].count++;
  }

  // Find recurring patterns (amounts charged 3+ times under $100)
  console.log('=== RECURRING CHARGES BY PAYER ===\n');
  console.log('Payer Name                          | Recurring Amount | Count | Total Charged');
  console.log('-'.repeat(85));

  const results = [];

  for (const [name, data] of Object.entries(byPayer)) {
    // Find most common small amount
    let recurringAmt = null;
    let recurringCount = 0;

    for (const [amt, count] of Object.entries(data.amounts)) {
      const amtNum = parseFloat(amt);
      if (count >= 3 && amtNum < 100 && amtNum > 1 && count > recurringCount) {
        recurringAmt = amtNum;
        recurringCount = count;
      }
    }

    if (recurringAmt) {
      results.push({ name, amount: recurringAmt, count: recurringCount, total: data.total });
    }
  }

  // Sort by name
  results.sort((a, b) => a.name.localeCompare(b.name));

  for (const r of results) {
    const namePad = r.name.substring(0, 35).padEnd(35);
    console.log(`${namePad} | $${r.amount.toFixed(2).padStart(10)} | ${String(r.count).padStart(5)} | $${r.total.toFixed(2)}`);
  }

  console.log('\n\n=== ALL UNIQUE SMALL RECURRING AMOUNTS ===\n');

  // Collect all recurring amounts across all payers
  const allAmounts = {};
  for (const [name, data] of Object.entries(byPayer)) {
    for (const [amt, count] of Object.entries(data.amounts)) {
      const amtNum = parseFloat(amt);
      if (count >= 2 && amtNum < 100 && amtNum > 10) {
        if (!allAmounts[amt]) allAmounts[amt] = [];
        allAmounts[amt].push({ name, count });
      }
    }
  }

  // Sort by amount
  const sortedAmounts = Object.entries(allAmounts).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));

  for (const [amt, payers] of sortedAmounts) {
    const totalCount = payers.reduce((sum, p) => sum + p.count, 0);
    const payerList = payers.map(p => `${p.name} (${p.count})`).join(', ');
    console.log(`$${parseFloat(amt).toFixed(2).padStart(7)}: ${totalCount} charges - ${payerList.substring(0, 80)}`);
  }
}

main().catch(console.error);

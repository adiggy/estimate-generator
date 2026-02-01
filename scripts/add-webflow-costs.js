#!/usr/bin/env node
/**
 * Add Webflow hosting costs to projects
 * Maps Webflow site costs to hosting client projects
 */

require('dotenv').config()
const { neon } = require('@neondatabase/serverless')

const sql = neon(process.env.DATABASE_URL)

// Webflow costs mapping (site name pattern → monthly cost in cents)
// $276/year = $23/month, $29/month, $49/month, $18/month
const WEBFLOW_COSTS = [
  // Monthly $29 CMS
  { pattern: 'liz-star-hopestar', cost: 2900, site: 'Nurture NC' },
  { pattern: 'definian-data', cost: 2900, site: 'Definian' },
  { pattern: 'donald-whittier-hosting-i7xk79r', cost: 2900, site: 'Banzai NEW' }, // Banzai specific
  { pattern: 'entrepreneurs-friend', cost: 2900, site: 'Entrepreneurs Friend' },
  { pattern: 'maryjustus-com', cost: 2900, site: 'Mary Justus' },
  { pattern: 'skybrook', cost: 2900, site: 'Skybrook' },
  { pattern: 'gillings-projects', cost: 2900, site: 'Gillings Projects' },
  { pattern: 'davinci-elentra', cost: 2900, site: 'DaVinci' },
  { pattern: 'unc-water-institute', cost: 2900, site: 'The Water Institute' },
  { pattern: 'wheaton-group', cost: 2900, site: 'Wheaton Group' },
  { pattern: 't4-associates', cost: 2900, site: 'T4 Associates' },
  { pattern: 'resonant-body', cost: 2900, site: 'Resonant Body' },
  { pattern: 'burk-uzzle', cost: 2900, site: 'burk uzzle' },
  { pattern: 'aiden-dale-art', cost: 2900, site: 'Aiden' },
  { pattern: 'honintser', cost: 2900, site: 'honintser' },
  { pattern: 'spottercharts', cost: 2900, site: 'Spottercharts' },
  { pattern: 'life-forward-movement', cost: 2900, site: 'Cathy Life Forward Movement' },
  { pattern: 'continuum-teachers', cost: 2900, site: 'continuum' },
  { pattern: 'green-burial-project', cost: 2900, site: 'Green Burial' },

  // Monthly $49 Business
  { pattern: 'the-prosecutors-and-politics-p', cost: 4900, site: 'PPP-UNC' },

  // Monthly $18 Basic
  { pattern: 'international-eco-fuels', cost: 1800, site: 'International Eco Fuels' },

  // Annual $276 = $23/month
  { pattern: 'hr-curtis-plumbing', cost: 2300, site: 'HRCurtis' },
  { pattern: 'self-care-info', cost: 2300, site: 'Self Care Decisions' },
  { pattern: 'susan-ainsworthassociates', cost: 2300, site: 'Ainsworth & Associates' },
  { pattern: 'silverstone-jewelers', cost: 2300, site: 'Silverstone Jewelry' },
  { pattern: 'colorado-state-university', cost: 2300, site: 'CSU OIE ColoState' },
  { pattern: 'donald-whittier-hosting-i7ycisr', cost: 2300, site: 'Cabo Broncos' }, // CaboBroncos specific
  { pattern: 'cliff-cottage-inn', cost: 2300, site: 'Cliff Cottage' },
  { pattern: 'the-h-opp', cost: 2300, site: 'Herpes Opportunity' },
]

async function addWebflowCosts() {
  console.log('Adding Webflow costs to hosting projects...\n')

  // First, add webflow_cost column if it doesn't exist
  try {
    await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS webflow_cost INTEGER DEFAULT 0`
    console.log('✓ webflow_cost column ready\n')
  } catch (err) {
    console.log('Column may already exist:', err.message)
  }

  // Get all hosting projects
  const projects = await sql`
    SELECT id, client_id, name, rate
    FROM projects
    WHERE billing_platform = 'bonsai_legacy'
  `

  console.log(`Found ${projects.length} hosting projects\n`)

  let updated = 0
  let totalWebflowCost = 0
  let totalRevenue = 0

  for (const project of projects) {
    // Find matching Webflow cost
    const match = WEBFLOW_COSTS.find(wf =>
      project.id.includes(wf.pattern) || project.client_id.includes(wf.pattern)
    )

    if (match) {
      await sql`
        UPDATE projects
        SET webflow_cost = ${match.cost}, updated_at = NOW()
        WHERE id = ${project.id}
      `
      const profit = (project.rate || 3900) - match.cost
      console.log(`✓ ${match.site} → ${project.client_id}`)
      console.log(`  Revenue: $${(project.rate || 3900) / 100}/mo, Cost: $${match.cost / 100}/mo, Profit: $${profit / 100}/mo`)
      updated++
      totalWebflowCost += match.cost
      totalRevenue += (project.rate || 3900)
    } else {
      // No Webflow cost (maybe hosted elsewhere or no cost)
      console.log(`- ${project.client_id}: No Webflow match (may be hosted elsewhere)`)
      totalRevenue += (project.rate || 3900)
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Updated ${updated} projects with Webflow costs`)
  console.log(`\nMRR Summary:`)
  console.log(`  Total Revenue: $${totalRevenue / 100}/mo`)
  console.log(`  Total Webflow Costs: $${totalWebflowCost / 100}/mo`)
  console.log(`  Net Profit: $${(totalRevenue - totalWebflowCost) / 100}/mo`)
}

addWebflowCosts().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})

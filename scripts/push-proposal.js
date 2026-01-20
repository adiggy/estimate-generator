#!/usr/bin/env node
const { neon } = require('@neondatabase/serverless')
const fs = require('fs')
const path = require('path')

// Load .env if present
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required')
  console.error('Set it in .env file or export it in your shell')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

async function pushProposal(proposalId) {
  const filePath = path.join(__dirname, '..', 'data', 'proposals', `${proposalId}.json`)

  if (!fs.existsSync(filePath)) {
    console.error(`Error: Proposal file not found: ${filePath}`)
    process.exit(1)
  }

  const proposal = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  console.log(`Pushing proposal: ${proposal.projectName}`)
  console.log(`  Client: ${proposal.clientName}`)
  console.log(`  ID: ${proposal.id}`)

  await sql`
    INSERT INTO proposals (id, data, created_at, updated_at)
    VALUES (${proposal.id}, ${JSON.stringify(proposal)}, ${proposal.createdAt}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      data = ${JSON.stringify(proposal)},
      updated_at = NOW()
  `

  console.log('✓ Pushed to Neon database')
}

async function pushAllProposals() {
  const proposalsDir = path.join(__dirname, '..', 'data', 'proposals')
  const files = fs.readdirSync(proposalsDir).filter(f => f.endsWith('.json'))

  console.log(`Found ${files.length} proposals to push\n`)

  for (const file of files) {
    const proposal = JSON.parse(fs.readFileSync(path.join(proposalsDir, file), 'utf8'))
    console.log(`Pushing: ${proposal.projectName}`)

    await sql`
      INSERT INTO proposals (id, data, created_at, updated_at)
      VALUES (${proposal.id}, ${JSON.stringify(proposal)}, ${proposal.createdAt || new Date().toISOString().split('T')[0]}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        data = ${JSON.stringify(proposal)},
        updated_at = NOW()
    `
    console.log(`  ✓ Done`)
  }

  console.log(`\n✓ All ${files.length} proposals pushed to Neon`)
}

// Main
const arg = process.argv[2]

if (arg === '--all') {
  pushAllProposals().catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else if (arg) {
  pushProposal(arg).catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else {
  console.log('Usage:')
  console.log('  node scripts/push-proposal.js <proposal-id>   Push single proposal')
  console.log('  node scripts/push-proposal.js --all           Push all proposals')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/push-proposal.js 2026-01-08-frerichs-opioid-hub')
  console.log('  npm run push-proposal 2026-01-08-frerichs-opioid-hub')
  console.log('  npm run push-all-proposals')
}

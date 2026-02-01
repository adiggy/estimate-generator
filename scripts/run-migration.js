#!/usr/bin/env node
/**
 * Run a SQL migration file against the Neon database
 * Usage: node run-migration.js migrations/add_hosting_fields.sql
 */

const { neon } = require('@neondatabase/serverless')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required')
  process.exit(1)
}

const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('Usage: node run-migration.js <migration-file>')
  console.error('Example: node run-migration.js migrations/add_hosting_fields.sql')
  process.exit(1)
}

const fullPath = path.resolve(__dirname, migrationFile)

if (!fs.existsSync(fullPath)) {
  console.error(`Migration file not found: ${fullPath}`)
  process.exit(1)
}

async function runMigration() {
  const sql = neon(DATABASE_URL)
  let migrationSql = fs.readFileSync(fullPath, 'utf-8')

  console.log(`Running migration: ${migrationFile}`)
  console.log('---')

  // Remove single-line comments
  migrationSql = migrationSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')

  // Split by semicolons to run each statement
  const statements = migrationSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  console.log(`Found ${statements.length} statements to execute`)

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    // Skip empty statements
    if (!statement) continue

    const preview = statement.replace(/\s+/g, ' ').substring(0, 60)
    console.log(`[${i + 1}/${statements.length}] ${preview}...`)
    try {
      await sql(statement)
      console.log('  ✓ Success')
    } catch (err) {
      // Ignore "already exists" errors
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('  ⚠ Already exists (skipped)')
      } else {
        console.error(`  ✗ Error: ${err.message}`)
      }
    }
  }

  console.log('---')
  console.log('Migration complete!')
}

runMigration().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Legacy Import Script for Adrial Designs OS
 *
 * Imports data from Airtable CSV exports:
 * - legacy_data/airtable/Clients-Grid view.csv (63 clients)
 * - legacy_data/airtable/Projects-EVERYTHING.csv (499 projects)
 * - legacy_data/airtable/People-Grid view.csv (9 people)
 *
 * Usage:
 *   npm run import-legacy --dry-run  # Preview changes
 *   npm run import-legacy            # Execute import
 */

const fs = require('fs')
const path = require('path')
const { neon } = require('@neondatabase/serverless')
require('dotenv').config()

// ============================================================================
// CONFIG
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL
const DRY_RUN = process.argv.includes('--dry-run')

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required')
  process.exit(1)
}

const sql = neon(DATABASE_URL)

const LEGACY_DIR = path.join(__dirname, '..', 'legacy_data', 'airtable')
const CLIENTS_FILE = path.join(LEGACY_DIR, 'Clients-Grid view.csv')
const PROJECTS_FILE = path.join(LEGACY_DIR, 'Projects-EVERYTHING.csv')
const PEOPLE_FILE = path.join(LEGACY_DIR, 'People-Grid view.csv')

// ============================================================================
// STATUS MAPPING
// ============================================================================

/**
 * Map Airtable status to OS status and priority
 * @param {string} airtableStatus
 * @returns {{status: string, priority: number}}
 */
function mapStatus(airtableStatus) {
  const normalized = (airtableStatus || '').trim().toUpperCase()

  switch (normalized) {
    case 'DONE':
      return { status: 'done', priority: 0 }
    case 'INVOICE':
      return { status: 'invoiced', priority: 0 }
    case 'WAITING ON':
      return { status: 'waiting_on', priority: 0 }
    case 'ACTIVE':
      return { status: 'active', priority: 0 }
    case 'PRIORITY':
      return { status: 'active', priority: 1 }
    case 'PAUSED/FUTURE':
      return { status: 'paused', priority: 0 }
    case 'LATER?':
      return { status: 'paused', priority: -1 }
    case 'MAYBE':
      return { status: 'paused', priority: -2 }
    default:
      // Empty or unknown -> paused
      return { status: 'paused', priority: 0 }
  }
}

// ============================================================================
// CSV PARSING
// ============================================================================

/**
 * Parse CSV with proper handling of quoted fields and newlines
 * @param {string} content
 * @returns {Array<Object>}
 */
function parseCSV(content) {
  const lines = []
  let currentLine = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]

    if (char === '"') {
      // Check for escaped quote
      if (content[i + 1] === '"') {
        currentLine += '"'
        i++ // Skip next quote
      } else {
        inQuotes = !inQuotes
        currentLine += char
      }
    } else if (char === '\n' && !inQuotes) {
      if (currentLine.trim()) {
        lines.push(currentLine)
      }
      currentLine = ''
    } else if (char === '\r') {
      // Skip carriage returns
    } else {
      currentLine += char
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine)
  }

  if (lines.length === 0) return []

  // Parse header
  const headers = parseCSVLine(lines[0])

  // Parse rows
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const row = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })
    rows.push(row)
  }

  return rows
}

/**
 * Parse a single CSV line into fields
 * @param {string} line
 * @returns {Array<string>}
 */
function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a URL-friendly slug from a string
 * @param {string} str
 * @returns {string}
 */
function slugify(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50)
}

/**
 * Parse hours string (e.g., "2 hours") to integer
 * @param {string} value
 * @returns {number|null}
 */
function parseHours(value) {
  if (!value) return null
  const match = String(value).match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

/**
 * Parse date string to ISO date
 * @param {string} dateStr - Date in format "M/D/YYYY" or "MM/DD/YYYY"
 * @returns {string|null}
 */
function parseDate(dateStr) {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null

  const month = parseInt(parts[0])
  const day = parseInt(parts[1])
  const year = parseInt(parts[2])

  if (isNaN(month) || isNaN(day) || isNaN(year)) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Extract URLs from text
 * @param {string} text
 * @returns {Array<string>}
 */
function extractUrls(text) {
  if (!text) return []
  const urlRegex = /https?:\/\/[^\s"',]+/g
  return (text.match(urlRegex) || []).map(url => url.replace(/[.,;:!?)\]]+$/, ''))
}

/**
 * Check if a client is a hosting client (based on name patterns)
 * @param {string} clientName
 * @returns {boolean}
 */
function isHostingClient(clientName) {
  // Clients that are known to be on Bonsai hosting
  const hostingPatterns = [
    /hosting/i,
    /monthly/i,
    /retainer/i,
  ]
  return hostingPatterns.some(p => p.test(clientName))
}

/**
 * Generate a unique project ID
 * @param {string} clientSlug
 * @param {string} projectName
 * @param {Set<string>} existingIds
 * @returns {string}
 */
function generateProjectId(clientSlug, projectName, existingIds) {
  const projectSlug = slugify(projectName).substring(0, 30)
  let id = `${clientSlug}-${projectSlug}`.substring(0, 60)
  let counter = 1

  while (existingIds.has(id)) {
    id = `${clientSlug}-${projectSlug}-${counter}`.substring(0, 60)
    counter++
  }

  existingIds.add(id)
  return id
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Import clients from CSV
 * @returns {Promise<Map<string, Object>>}
 */
async function importClients() {
  console.log('\n📋 Importing Clients...')

  const content = fs.readFileSync(CLIENTS_FILE, 'utf8')
  const rows = parseCSV(content)

  console.log(`  Found ${rows.length} clients in CSV`)

  // Load existing clients from database
  const existingClients = await sql`SELECT id, data FROM clients`
  const existingMap = new Map()
  for (const row of existingClients) {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    existingMap.set(row.id, data)
  }

  const clientMap = new Map()
  let created = 0
  let updated = 0

  for (const row of rows) {
    const name = row['Name']
    if (!name) continue

    const slug = slugify(name)
    const peopleStr = row['People'] || ''

    const clientData = {
      id: slug,
      name: name,
      company: name,
      notes: `Legacy Airtable import. People: ${peopleStr || 'None'}`,
      discountPercent: 0
    }

    clientMap.set(name, { id: slug, ...clientData })

    if (!DRY_RUN) {
      if (existingMap.has(slug)) {
        // Client exists, keep existing data but note it was in import
        updated++
      } else {
        // Create new client
        await sql`
          INSERT INTO clients (id, data)
          VALUES (${slug}, ${JSON.stringify(clientData)})
          ON CONFLICT (id) DO NOTHING
        `
        created++
      }
    }
  }

  console.log(`  ${DRY_RUN ? 'Would create' : 'Created'}: ${created} new clients`)
  console.log(`  ${DRY_RUN ? 'Would update' : 'Already exist'}: ${updated} clients`)

  return clientMap
}

/**
 * Import projects from CSV
 * @param {Map<string, Object>} clientMap
 * @returns {Promise<number>}
 */
async function importProjects(clientMap) {
  console.log('\n📁 Importing Projects...')

  const content = fs.readFileSync(PROJECTS_FILE, 'utf8')
  const rows = parseCSV(content)

  console.log(`  Found ${rows.length} projects in CSV`)

  const usedIds = new Set()
  let imported = 0
  let skipped = 0
  const statusCounts = {}

  for (const row of rows) {
    const jobRequest = row['Job request']
    const clientName = row['Clients']
    const airtableStatus = row['Status']

    if (!jobRequest || !clientName) {
      skipped++
      continue
    }

    // Get client info
    let clientData = clientMap.get(clientName)
    if (!clientData) {
      // Create a slug for unknown clients
      const clientSlug = slugify(clientName)
      clientData = { id: clientSlug }

      // Auto-create the client if not in dry run
      if (!DRY_RUN) {
        await sql`
          INSERT INTO clients (id, data)
          VALUES (${clientSlug}, ${JSON.stringify({ id: clientSlug, name: clientName, company: clientName })})
          ON CONFLICT (id) DO NOTHING
        `
      }
      clientMap.set(clientName, clientData)
    }

    // Map status
    const { status, priority } = mapStatus(airtableStatus)
    statusCounts[status] = (statusCounts[status] || 0) + 1

    // Parse dates
    const lastTouched = parseDate(row['Last touched date'])
    const dueDate = parseDate(row['Due date'])

    // Extract URLs from notes
    const notes = row['Notes'] || ''
    const urls = extractUrls(notes)

    // Parse hours
    const hours = parseHours(row['Timechunk'])

    // Generate unique project ID
    const projectId = generateProjectId(clientData.id, jobRequest, usedIds)

    // Determine billing platform
    const billingPlatform = isHostingClient(clientName) ? 'bonsai_legacy' : 'os'

    const project = {
      id: projectId,
      client_id: clientData.id,
      name: jobRequest,
      description: notes.substring(0, 500),
      status,
      priority,
      billing_type: 'hourly',
      billing_platform: billingPlatform,
      rate: 12000, // $120/hr in cents
      due_date: dueDate,
      last_touched_at: lastTouched,
      notes: notes,
      external_links: urls,
      people: row['People'] ? [row['People']] : [],
      tags: hours ? [`${hours}h`] : []
    }

    if (!DRY_RUN) {
      await sql`
        INSERT INTO projects (
          id, client_id, name, description, status, priority,
          billing_type, billing_platform, rate, due_date, last_touched_at,
          notes, external_links, people, tags
        ) VALUES (
          ${project.id}, ${project.client_id}, ${project.name}, ${project.description},
          ${project.status}, ${project.priority}, ${project.billing_type},
          ${project.billing_platform}, ${project.rate}, ${project.due_date},
          ${project.last_touched_at}, ${project.notes},
          ${JSON.stringify(project.external_links)}, ${JSON.stringify(project.people)},
          ${JSON.stringify(project.tags)}
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          notes = EXCLUDED.notes,
          external_links = EXCLUDED.external_links,
          updated_at = NOW()
      `
    }

    imported++

    // Progress output every 25 projects
    if (imported % 25 === 0) {
      process.stdout.write(`  Progress: ${imported}/${rows.length} projects...\r`)
    }
  }

  // Clear progress line
  process.stdout.write(' '.repeat(50) + '\r')

  console.log(`  ${DRY_RUN ? 'Would import' : 'Imported'}: ${imported} projects`)
  console.log(`  Skipped (missing data): ${skipped}`)
  console.log('\n  Status breakdown:')
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${status}: ${count}`)
  }

  return imported
}

/**
 * Import people from CSV (for reference/logging)
 * @returns {Promise<void>}
 */
async function importPeople() {
  console.log('\n👥 Reading People...')

  const content = fs.readFileSync(PEOPLE_FILE, 'utf8')
  const rows = parseCSV(content)

  console.log(`  Found ${rows.length} people in CSV`)

  for (const row of rows) {
    const name = row['Name']
    const company = row['Company']
    if (name) {
      console.log(`    - ${name} (${company || 'No company'})`)
    }
  }

  console.log('  (People are linked via project "People" field)')
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('='.repeat(60))
  console.log('Adrial Designs OS - Legacy Import')
  console.log('='.repeat(60))

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made')
  }

  // Check files exist
  const files = [CLIENTS_FILE, PROJECTS_FILE, PEOPLE_FILE]
  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.error(`\n❌ File not found: ${file}`)
      process.exit(1)
    }
  }
  console.log('\n✅ All CSV files found')

  try {
    // Import clients first
    const clientMap = await importClients()

    // Import projects (using client map for lookups)
    await importProjects(clientMap)

    // Log people (informational only)
    await importPeople()

    console.log('\n' + '='.repeat(60))
    if (DRY_RUN) {
      console.log('✅ Dry run complete. Run without --dry-run to execute.')
    } else {
      console.log('✅ Import complete!')
    }
    console.log('='.repeat(60))
  } catch (err) {
    console.error('\n❌ Import failed:', err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

main()

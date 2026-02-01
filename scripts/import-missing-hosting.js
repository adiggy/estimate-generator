#!/usr/bin/env node
/**
 * Import missing hosting invoices from Bonsai CSV
 * Maps Bonsai client names to OS client IDs and creates invoice records
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

const sql = neon(DATABASE_URL)

// Client name mapping from Bonsai to OS client IDs
const CLIENT_MAPPING = {
  'Silverstone Jewelers (Kallie Carver)': 'silverstone-jewelers-kallie-ca',
  'Liz Star Winer (HopeStar)': 'liz-star-hopestar-',
  'Liz Star (HopeStar)': 'liz-star-hopestar-',
  'Ainsworth & Associates': 'susan-ainsworthassociates-net',
  'Definian Data, LLC': 'definian-data',
  'Definian Data, LLC (formerly Premier International)': 'definian-data',
  'Donald Whittier': 'donald-whittier',
  'Colorado State University (CSU)': 'colorado-state-university-csu-',
  'Colorado State University': 'colorado-state-university-csu-',
  'Davinci': 'davinci-elentra-',
  'Cliff Cottage Inn': 'cliff-cottage-inn',
  'Sunset Grove': 'sunset-grove',
  'Self Care Info': 'self-care-info',
  'The H-opp': 'the-h-opp',
  'Gillings': 'gillings-pgl-'
}

// Detect if an invoice is hosting-related
function isHostingInvoice(projectName, amount) {
  const nameLower = projectName.toLowerCase()
  return nameLower.includes('hosting') ||
         nameLower.includes('web hosting') ||
         (amount > 0 && amount < 100) // Monthly hosting typically under $100
}

// Detect if billing is annual (larger amounts for hosting)
function isAnnualBilling(projectName, amount) {
  const nameLower = projectName.toLowerCase()
  if (nameLower.includes('annual')) return true
  // Hosting invoices over $100 are likely annual
  if (isHostingInvoice(projectName, amount) && amount > 100) return true
  return false
}

// Parse CSV line handling quoted fields
function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

async function importMissingHosting() {
  const csvPath = path.join(__dirname, '../legacy_data/bonsai/adrial_invoice_export_2026-01-25_d6659ed2b281da5ab3f077337348.csv')
  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  const lines = csvContent.split('\n')
  const headers = parseCSVLine(lines[0])

  console.log('=== Importing Missing Hosting Invoices ===\n')

  // Get existing invoice IDs to avoid duplicates
  const existingInvoices = await sql`SELECT id FROM invoices`
  const existingIds = new Set(existingInvoices.map(i => i.id))
  console.log(`Found ${existingIds.size} existing invoices\n`)

  // Get clients without invoices (our target clients)
  const clientsWithoutInvoices = [
    'colorado-state-university-csu-',
    'davinci-elentra-',
    'definian-data',
    'donald-whittier',
    'gillings-pgl-',
    'liz-star-hopestar-',
    'self-care-info',
    'silverstone-jewelers-kallie-ca',
    'sunset-grove',
    'susan-ainsworthassociates-net',
    'the-h-opp',
    'cliff-cottage-inn'
  ]

  const targetClients = new Set(clientsWithoutInvoices)
  let imported = 0
  let skipped = 0
  const importedByClient = {}

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const row = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })

    const status = row.status
    const totalAmount = parseFloat(row.total_amount) || 0
    const projectName = row.contractor_project_name || ''
    const clientName = row.client_or_company_name || ''
    const invoiceNumber = row.invoice_number || ''
    const issuedDate = row.issued_date || ''
    const paidDate = row.paid_date || ''

    // Skip non-paid invoices (except scheduled recurring)
    if (status !== 'paid' && status !== 'scheduled') continue

    // Check if this is a hosting invoice
    if (!isHostingInvoice(projectName, totalAmount)) continue

    // Map client name to OS client ID
    const clientId = CLIENT_MAPPING[clientName]
    if (!clientId) continue

    // Only import for clients we're targeting
    if (!targetClients.has(clientId)) continue

    // Generate invoice ID
    const invoiceId = `bonsai-${invoiceNumber}`

    // Skip if already exists
    if (existingIds.has(invoiceId)) {
      skipped++
      continue
    }

    // Determine billing cycle
    const billingCycle = isAnnualBilling(projectName, totalAmount) ? 'annual' : 'monthly'

    // Create invoice record
    const invoiceData = {
      id: invoiceId,
      client_id: clientId,
      status: status === 'paid' ? 'paid' : 'draft',
      total: Math.round(totalAmount * 100), // Convert to cents
      notes: `Imported from Bonsai - ${projectName}`,
      line_items: JSON.stringify([{ description: projectName, amount: totalAmount }]),
      is_hosting: true,
      billing_cycle: billingCycle,
      created_at: issuedDate ? new Date(issuedDate) : new Date(),
      paid_at: paidDate ? new Date(paidDate) : null
    }

    try {
      await sql`
        INSERT INTO invoices (id, client_id, status, total, notes, line_items, is_hosting, billing_cycle, created_at, paid_at)
        VALUES (${invoiceData.id}, ${invoiceData.client_id}, ${invoiceData.status}, ${invoiceData.total},
                ${invoiceData.notes}, ${invoiceData.line_items}::jsonb, ${invoiceData.is_hosting},
                ${invoiceData.billing_cycle}, ${invoiceData.created_at}, ${invoiceData.paid_at})
      `
      imported++
      importedByClient[clientId] = (importedByClient[clientId] || 0) + 1
      console.log(`  ✓ ${clientId}: $${totalAmount.toFixed(2)} (${billingCycle})`)
    } catch (err) {
      console.error(`  ✗ ${clientId}: ${err.message}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Imported: ${imported} invoices`)
  console.log(`Skipped (duplicates): ${skipped}`)
  console.log('\nBy client:')
  Object.entries(importedByClient).sort().forEach(([client, count]) => {
    console.log(`  ${client}: ${count} invoices`)
  })
}

importMissingHosting().catch(err => {
  console.error('Import failed:', err)
  process.exit(1)
})

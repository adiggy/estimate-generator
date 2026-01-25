#!/usr/bin/env node
/**
 * Invoice Generator CLI for Adrial Designs OS
 *
 * Usage:
 *   npm run invoice --client <client-id>
 *   npm run invoice --project <project-id>
 *   npm run invoice --include chunk-1,chunk-2,chunk-3
 *   npm run invoice --all --dry-run
 */

const {
  sql,
  getProject,
  getClient,
  getUnbilledTime,
  getInvoice,
  createInvoice,
  markTimeLogsInvoiced,
  generateId,
  formatMoney
} = require('./lib/db')

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Parse command line arguments
 * @returns {Object}
 */
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    client: null,
    project: null,
    include: [],
    dryRun: false,
    force: false,
    all: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--client':
        options.client = args[++i]
        break
      case '--project':
        options.project = args[++i]
        break
      case '--include':
        options.include = (args[++i] || '').split(',').filter(Boolean)
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--force':
        options.force = true
        break
      case '--all':
        options.all = true
        break
    }
  }

  return options
}

/**
 * Get projects with unbilled time
 * @param {Object} options
 * @returns {Promise<Array>}
 */
async function getUnbilledProjects(options) {
  let query

  if (options.client) {
    query = sql`
      SELECT DISTINCT p.*
      FROM projects p
      JOIN time_logs tl ON tl.project_id = p.id
      WHERE p.client_id = ${options.client}
        AND tl.invoiced = false
        AND tl.billable = true
        AND tl.duration_minutes IS NOT NULL
    `
  } else if (options.project) {
    query = sql`
      SELECT p.*
      FROM projects p
      WHERE p.id = ${options.project}
    `
  } else {
    query = sql`
      SELECT DISTINCT p.*
      FROM projects p
      JOIN time_logs tl ON tl.project_id = p.id
      WHERE tl.invoiced = false
        AND tl.billable = true
        AND tl.duration_minutes IS NOT NULL
    `
  }

  return query
}

/**
 * Format invoice line items for display
 * @param {Array} lineItems
 */
function displayLineItems(lineItems) {
  console.log('\nLine Items:')
  console.log('-'.repeat(70))

  for (const item of lineItems) {
    const desc = item.description.substring(0, 40).padEnd(40)
    const qty = `${item.quantity}`.padStart(6)
    const rate = formatMoney(item.rate).padStart(10)
    const amount = formatMoney(item.amount).padStart(12)
    console.log(`  ${desc}  ${qty}  ${rate}  ${amount}`)
  }

  console.log('-'.repeat(70))
}

// ============================================================================
// MAIN INVOICE GENERATION
// ============================================================================

/**
 * Generate invoice for a project
 * @param {string} projectId
 * @param {Object} options
 * @returns {Promise<Object|null>}
 */
async function generateInvoiceForProject(projectId, options) {
  const project = await getProject(projectId)
  if (!project) {
    console.error(`Project not found: ${projectId}`)
    return null
  }

  const client = await getClient(project.client_id)
  const { logs, totalMinutes, totalAmount } = await getUnbilledTime(projectId)

  if (logs.length === 0) {
    console.log(`  No unbilled time for project: ${project.name}`)
    return null
  }

  // Filter logs if --include is specified
  let selectedLogs = logs
  if (options.include.length > 0) {
    selectedLogs = logs.filter(l => options.include.includes(l.id))
    if (selectedLogs.length === 0) {
      console.log(`  No matching time logs for specified IDs`)
      return null
    }
  }

  // Calculate selected totals
  const selectedMinutes = selectedLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
  const selectedAmount = selectedLogs.reduce((sum, l) => {
    const rate = l.rate || project.rate || 12000
    return sum + Math.round((l.duration_minutes / 60) * rate)
  }, 0)

  // Budget guardrail
  if (project.budget_high && !options.force) {
    const percentUsed = (selectedAmount / project.budget_high) * 100
    if (percentUsed > 100) {
      console.error(`\n⚠️  Warning: Invoice (${formatMoney(selectedAmount)}) exceeds budget (${formatMoney(project.budget_high)})`)
      console.error('   Use --force to create invoice anyway.')
      return null
    }
    if (percentUsed > 90) {
      console.warn(`\n⚠️  Notice: Invoice is ${percentUsed.toFixed(0)}% of budget`)
    }
  }

  // Create line items
  const lineItems = selectedLogs.map(log => {
    const rate = log.rate || project.rate || 12000
    const hours = log.duration_minutes / 60
    return {
      time_log_id: log.id,
      description: log.description || 'Work session',
      date: new Date(log.started_at).toISOString().split('T')[0],
      quantity: parseFloat(hours.toFixed(2)),
      rate: rate,
      amount: Math.round(hours * rate)
    }
  })

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const discountPercent = client?.discountPercent || 0
  const discountAmount = Math.round(subtotal * discountPercent / 100)
  const total = subtotal - discountAmount

  // Display invoice preview
  console.log(`\n📄 Invoice Preview: ${project.name}`)
  console.log(`   Client: ${client?.name || project.client_id}`)
  console.log(`   Time Entries: ${selectedLogs.length}`)
  console.log(`   Total Hours: ${(selectedMinutes / 60).toFixed(2)}`)

  displayLineItems(lineItems)

  console.log(`  Subtotal:`.padEnd(52) + formatMoney(subtotal).padStart(18))
  if (discountPercent > 0) {
    console.log(`  Discount (${discountPercent}%):`.padEnd(52) + `-${formatMoney(discountAmount)}`.padStart(18))
  }
  console.log('='.repeat(70))
  console.log(`  TOTAL:`.padEnd(52) + formatMoney(total).padStart(18))

  if (options.dryRun) {
    console.log('\n  [DRY RUN - No invoice created]')
    return { lineItems, subtotal, total, project, client }
  }

  // Create invoice in database
  const invoiceId = generateId('inv')
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 30) // Net 30

  const invoice = await createInvoice({
    id: invoiceId,
    client_id: project.client_id,
    status: 'draft',
    subtotal,
    discount_percent: discountPercent,
    total,
    line_items: lineItems,
    due_date: dueDate.toISOString().split('T')[0]
  })

  // Mark time logs as invoiced
  await markTimeLogsInvoiced(selectedLogs.map(l => l.id), invoiceId)

  console.log(`\n✅ Invoice created: ${invoiceId}`)
  console.log(`   Status: draft`)
  console.log(`   Due Date: ${dueDate.toLocaleDateString()}`)

  return invoice
}

/**
 * Generate invoices for all unbilled work
 * @param {Object} options
 */
async function generateAllInvoices(options) {
  console.log('Scanning for unbilled time...\n')

  const projects = await getUnbilledProjects(options)

  if (projects.length === 0) {
    console.log('No projects with unbilled time found.')
    return
  }

  console.log(`Found ${projects.length} project(s) with unbilled time:\n`)

  for (const project of projects) {
    await generateInvoiceForProject(project.id, options)
    console.log('')
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const options = parseArgs()

  console.log('='.repeat(60))
  console.log('Adrial Designs OS - Invoice Generator')
  console.log('='.repeat(60))

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made')
  }

  try {
    if (options.project) {
      await generateInvoiceForProject(options.project, options)
    } else if (options.client) {
      const projects = await getUnbilledProjects(options)
      for (const project of projects) {
        await generateInvoiceForProject(project.id, options)
        console.log('')
      }
    } else if (options.all) {
      await generateAllInvoices(options)
    } else {
      console.log('\nUsage:')
      console.log('  npm run invoice --project <project-id>')
      console.log('  npm run invoice --client <client-id>')
      console.log('  npm run invoice --all')
      console.log('')
      console.log('Options:')
      console.log('  --dry-run    Preview without creating invoice')
      console.log('  --force      Create invoice even if over budget')
      console.log('  --include    Only include specific time log IDs')
      console.log('')
      console.log('Examples:')
      console.log('  npm run invoice --project my-project --dry-run')
      console.log('  npm run invoice --client unc-gillings')
      console.log('  npm run invoice --project my-project --include tl-1,tl-2')
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message)
    process.exit(1)
  }
}

main()

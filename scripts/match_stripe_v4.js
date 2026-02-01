require('dotenv').config()
const fs = require('fs')
const path = require('path')

async function matchByInvoice() {
  // Load Stripe charges
  const charges = JSON.parse(fs.readFileSync('/tmp/stripe_charges_full.json', 'utf8'))

  // Load Bonsai invoices - build lookup by invoice number
  const invoicePath = path.join(__dirname, '../legacy_data/bonsai/adrial_invoice_export_2026-01-25_d6659ed2b281da5ab3f077337348.csv')
  const invoiceCsv = fs.readFileSync(invoicePath, 'utf8')
  const invoiceLines = invoiceCsv.split('\n').slice(1).filter(l => l.trim())

  // Parse CSV properly
  function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  // invoice_number (col 14) → { client, email, project, amount }
  const invoiceLookup = {}
  invoiceLines.forEach(line => {
    const cols = parseCSVLine(line)
    const invoiceNum = cols[14]
    const clientName = cols[16]
    const clientEmail = cols[17]
    const projectName = cols[15]
    const amount = parseFloat(cols[1]) || 0

    if (invoiceNum) {
      invoiceLookup[invoiceNum] = {
        client: clientName,
        email: clientEmail,
        project: projectName,
        amount
      }
    }
  })

  console.log('Bonsai invoices loaded:', Object.keys(invoiceLookup).length)

  // Process each Stripe charge - map to Bonsai client via invoice number
  let matched = 0
  let unmatched = 0
  const unmatchedCharges = []

  // Group by Bonsai client
  const clientCharges = {}

  charges.forEach(charge => {
    const desc = charge.description || ''
    const stripeName = charge.billing_details?.name || 'Unknown'

    // Extract invoice number
    const invMatch = desc.match(/invoice #(\d+)/)
    const invoiceNum = invMatch ? invMatch[1] : null

    // Extract email from description as backup
    const emailMatch = desc.match(/by ([^\s]+@[^\s]+) for/)
    const email = emailMatch ? emailMatch[1] : null

    if (invoiceNum && invoiceLookup[invoiceNum]) {
      matched++
      const inv = invoiceLookup[invoiceNum]
      const clientKey = inv.client

      if (!clientCharges[clientKey]) {
        clientCharges[clientKey] = {
          bonsaiClient: inv.client,
          emails: new Set(),
          stripeNames: new Set(),
          charges: 0,
          total: 0,
          invoiceNums: new Set()
        }
      }

      clientCharges[clientKey].charges++
      clientCharges[clientKey].total += charge.amount
      clientCharges[clientKey].invoiceNums.add(invoiceNum)
      clientCharges[clientKey].stripeNames.add(stripeName)
      if (email) clientCharges[clientKey].emails.add(email)
      if (inv.email) clientCharges[clientKey].emails.add(inv.email)
    } else {
      unmatched++
      unmatchedCharges.push({
        id: charge.id,
        stripeName,
        amount: charge.amount,
        description: desc,
        invoiceNum,
        email
      })
    }
  })

  console.log(`\nCharges matched: ${matched}`)
  console.log(`Charges unmatched: ${unmatched}`)
  console.log(`Unique Bonsai clients: ${Object.keys(clientCharges).length}`)

  // Convert to array and sort by total
  const results = Object.values(clientCharges).map(c => ({
    bonsaiClient: c.bonsaiClient,
    charges: c.charges,
    total: c.total,
    emails: Array.from(c.emails).join('; '),
    stripeNames: Array.from(c.stripeNames).join('; '),
    sampleInvoices: Array.from(c.invoiceNums).slice(0, 5).join('; ')
  })).sort((a, b) => b.total - a.total)

  // Generate CSV - grouped by Bonsai client
  let csv = 'Bonsai Client,Total Charges,Total Amount,Client Emails,Stripe Payer Names,Sample Invoice #s\n'

  results.forEach(r => {
    const escapeCsv = (s) => {
      if (!s) return ''
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }
    csv += `${escapeCsv(r.bonsaiClient)},${r.charges},${(r.total/100).toFixed(2)},${escapeCsv(r.emails)},${escapeCsv(r.stripeNames)},${escapeCsv(r.sampleInvoices)}\n`
  })

  const csvPath = path.join(__dirname, '../legacy_data/stripe_by_bonsai_client.csv')
  fs.writeFileSync(csvPath, csv)
  console.log('\nCreated:', csvPath)

  // Show results
  console.log('\n=== STRIPE CHARGES BY BONSAI CLIENT ===')
  results.slice(0, 20).forEach(r => {
    console.log(`${r.bonsaiClient.padEnd(40)} | ${r.charges} charges | $${(r.total/100).toFixed(2)}`)
  })

  if (results.length > 20) {
    console.log(`... and ${results.length - 20} more clients`)
  }

  // Show unmatched
  if (unmatchedCharges.length > 0) {
    console.log('\n=== UNMATCHED CHARGES ===')
    unmatchedCharges.forEach(c => {
      console.log(`${c.stripeName.padEnd(30)} | $${(c.amount/100).toFixed(2)} | Invoice #${c.invoiceNum || 'N/A'}`)
      console.log(`  Desc: ${c.description.substring(0, 80)}...`)
    })

    // Save unmatched for review
    fs.writeFileSync('/tmp/unmatched_charges.json', JSON.stringify(unmatchedCharges, null, 2))
    console.log('\nUnmatched saved to /tmp/unmatched_charges.json')
  }
}

matchByInvoice().catch(err => console.error('Error:', err))

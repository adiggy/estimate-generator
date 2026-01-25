import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    if (req.method === 'GET') {
      const { client_id, status } = req.query

      let rows
      if (client_id && status) {
        rows = await sql`
          SELECT * FROM invoices
          WHERE client_id = ${client_id} AND status = ${status}
          ORDER BY created_at DESC
        `
      } else if (client_id) {
        rows = await sql`
          SELECT * FROM invoices
          WHERE client_id = ${client_id}
          ORDER BY created_at DESC
        `
      } else if (status) {
        rows = await sql`
          SELECT * FROM invoices
          WHERE status = ${status}
          ORDER BY created_at DESC
        `
      } else {
        rows = await sql`SELECT * FROM invoices ORDER BY created_at DESC`
      }

      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const invoice = req.body

      // Generate ID if not provided
      if (!invoice.id) {
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substring(2, 8)
        invoice.id = `inv-${timestamp}-${random}`
      }

      const {
        id, client_id, status = 'draft', subtotal = 0, discount_percent = 0,
        tax_percent = 0, total = 0, line_items = [], notes, due_date,
        time_log_ids = []
      } = invoice

      if (!client_id) {
        return res.status(400).json({ error: 'client_id is required' })
      }

      await sql`
        INSERT INTO invoices (
          id, client_id, status, subtotal, discount_percent, tax_percent,
          total, line_items, notes, due_date
        ) VALUES (
          ${id}, ${client_id}, ${status}, ${subtotal}, ${discount_percent},
          ${tax_percent}, ${total}, ${JSON.stringify(line_items)}, ${notes}, ${due_date}
        )
      `

      // Mark time logs as invoiced if provided
      if (time_log_ids.length > 0) {
        for (const tlId of time_log_ids) {
          await sql`
            UPDATE time_logs
            SET invoiced = true, invoice_id = ${id}, updated_at = NOW()
            WHERE id = ${tlId}
          `
        }
      }

      const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Invoices API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

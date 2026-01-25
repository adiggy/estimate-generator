import { neon } from '@neondatabase/serverless'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const sql = neon(process.env.DATABASE_URL)
  const { id } = req.query

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' })
      }
      return res.status(200).json(rows[0])
    }

    if (req.method === 'PUT') {
      const updates = req.body
      const allowedFields = [
        'stripe_invoice_id', 'stripe_invoice_url', 'status', 'subtotal',
        'discount_percent', 'tax_percent', 'total', 'line_items', 'notes',
        'due_date', 'paid_at', 'sent_at'
      ]

      const sets = []
      const params = []

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          const serialized = key === 'line_items' ? JSON.stringify(value) : value
          params.push(serialized)
          sets.push(`${key} = $${params.length}`)
        }
      }

      // Handle status transitions
      if (updates.status === 'sent' && !updates.sent_at) {
        params.push(new Date().toISOString())
        sets.push(`sent_at = $${params.length}`)
      }
      if (updates.status === 'paid' && !updates.paid_at) {
        params.push(new Date().toISOString())
        sets.push(`paid_at = $${params.length}`)
      }

      if (sets.length === 0) {
        const rows = await sql`SELECT * FROM invoices WHERE id = ${id}`
        return res.status(200).json(rows[0] || null)
      }

      sets.push('updated_at = NOW()')
      params.push(id)

      const query = `UPDATE invoices SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`
      const rows = await sql(query, params)

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Invoice not found' })
      }

      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      // Unmark time logs before deleting invoice
      await sql`
        UPDATE time_logs
        SET invoiced = false, invoice_id = NULL, updated_at = NOW()
        WHERE invoice_id = ${id}
      `

      await sql`DELETE FROM invoices WHERE id = ${id}`
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('Invoice API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

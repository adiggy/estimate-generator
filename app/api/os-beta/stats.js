import { neon } from '@neondatabase/serverless'

/**
 * CFO Metrics API
 *
 * Returns:
 * - unbilled: Work done but not invoiced (cents)
 * - unpaid: Invoiced but not paid (cents)
 * - revenue_mtd: Paid this month (cents)
 * - revenue_ytd: Paid this year (cents)
 * - mrr: Monthly recurring revenue from hosting (cents)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = neon(process.env.DATABASE_URL)

  try {
    // Run all queries in parallel
    const [unbilledResult, unpaidResult, revenueMonthResult, revenueYearResult, mrrResult] = await Promise.all([
      // Unbilled: work done but not invoiced
      sql`
        SELECT COALESCE(SUM(
          ROUND((duration_minutes::numeric / 60) * COALESCE(tl.rate, p.rate, 12000))
        ), 0) as total
        FROM time_logs tl
        JOIN projects p ON tl.project_id = p.id
        WHERE tl.invoiced = false AND tl.billable = true AND tl.duration_minutes IS NOT NULL
      `,

      // Unpaid: invoiced but not paid
      sql`
        SELECT COALESCE(SUM(total), 0) as total
        FROM invoices
        WHERE status = 'sent'
      `,

      // Revenue MTD
      sql`
        SELECT COALESCE(SUM(total), 0) as total
        FROM invoices
        WHERE status = 'paid'
          AND paid_at >= date_trunc('month', CURRENT_DATE)
      `,

      // Revenue YTD
      sql`
        SELECT COALESCE(SUM(total), 0) as total
        FROM invoices
        WHERE status = 'paid'
          AND paid_at >= date_trunc('year', CURRENT_DATE)
      `,

      // MRR (hosting clients - count * $39/month)
      sql`
        SELECT COUNT(*) * 3900 as total
        FROM projects
        WHERE billing_platform = 'bonsai_legacy' AND status = 'active'
      `
    ])

    return res.status(200).json({
      unbilled: parseInt(unbilledResult[0]?.total || 0),
      unpaid: parseInt(unpaidResult[0]?.total || 0),
      revenue_mtd: parseInt(revenueMonthResult[0]?.total || 0),
      revenue_ytd: parseInt(revenueYearResult[0]?.total || 0),
      mrr: parseInt(mrrResult[0]?.total || 0)
    })
  } catch (err) {
    console.error('Stats API error:', err)
    return res.status(500).json({ error: 'Database error', details: err.message })
  }
}

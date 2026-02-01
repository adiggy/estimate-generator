-- Add hosting fields to invoices table
-- Run this migration to add is_hosting flag and billing_cycle

-- Add is_hosting boolean flag (default false)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_hosting BOOLEAN DEFAULT false;

-- Add billing_cycle for distinguishing monthly vs annual hosting
-- Values: 'monthly', 'annual', null (for non-hosting invoices)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS billing_cycle TEXT;

-- Create index for faster hosting invoice lookups
CREATE INDEX IF NOT EXISTS idx_invoices_is_hosting ON invoices(is_hosting) WHERE is_hosting = true;

-- Auto-detect existing hosting invoices based on criteria:
-- 1. Amount under $100 AND appears at least twice
-- 2. OR description/notes contains 'hosting' (case insensitive)

-- First, mark invoices with "hosting" in description or notes
UPDATE invoices
SET is_hosting = true, billing_cycle = 'monthly'
WHERE (
  LOWER(COALESCE(notes, '')) LIKE '%hosting%'
  OR LOWER(COALESCE(line_items::text, '')) LIKE '%hosting%'
);

-- Then, mark recurring small amounts as monthly hosting
WITH recurring_amounts AS (
  SELECT total, COUNT(*) as cnt
  FROM invoices
  WHERE total < 10000  -- Under $100
  GROUP BY total
  HAVING COUNT(*) >= 2
)
UPDATE invoices i
SET is_hosting = true, billing_cycle = 'monthly'
FROM recurring_amounts ra
WHERE i.total = ra.total
  AND i.is_hosting IS NOT true;  -- Don't overwrite if already set

-- Mark larger hosting invoices (over $100 with "hosting" keyword) as annual
UPDATE invoices
SET billing_cycle = 'annual'
WHERE is_hosting = true
  AND total >= 10000
  AND billing_cycle IS NULL;

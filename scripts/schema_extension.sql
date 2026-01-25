-- Adrial Designs OS - Schema Extension
-- Run this migration AFTER the existing schema is in place
-- Execute with: psql $DATABASE_URL -f scripts/schema_extension.sql

-- ============================================================================
-- PROJECTS TABLE
-- Central hub for all project work (excluding proposals which stay separate)
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  proposal_id TEXT,                     -- Link to proposals table if applicable
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',         -- active, waiting_on, paused, done, invoiced
  priority INTEGER DEFAULT 0,           -- 1=priority, 0=normal, -1=later, -2=maybe
  billing_type TEXT DEFAULT 'hourly',   -- hourly, fixed, retainer
  billing_platform TEXT DEFAULT 'os',   -- os, bonsai_legacy
  budget_low INTEGER,                   -- cents (e.g., 120000 = $1,200)
  budget_high INTEGER,                  -- cents
  rate INTEGER DEFAULT 12000,           -- cents per hour ($120.00)
  due_date DATE,
  last_touched_at TIMESTAMPTZ,
  notes TEXT,
  external_links JSONB DEFAULT '[]',    -- Array of URLs from notes
  people JSONB DEFAULT '[]',            -- Array of contact names
  tags JSONB DEFAULT '[]',              -- Flexible tagging
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CHUNKS TABLE
-- Work broken into 1-3 hour schedulable units, grouped by phase
-- ============================================================================
CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_name TEXT DEFAULT 'General',    -- For Gantt grouping (e.g., "Discovery", "Design", "Development")
  name TEXT NOT NULL,                   -- Short description of the work
  description TEXT,                     -- Detailed notes
  hours INTEGER NOT NULL CHECK (hours IN (1, 2, 3)),  -- Must be 1, 2, or 3 hours
  status TEXT DEFAULT 'pending',        -- pending, scheduled, in_progress, done
  scheduled_start TIMESTAMPTZ,          -- When scheduled on calendar
  scheduled_end TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,             -- When marked done
  calendar_event_id TEXT,               -- Google Calendar event ID
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TIME LOGS TABLE
-- Actual time tracked with pausable timer support
-- ============================================================================
CREATE TABLE IF NOT EXISTS time_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chunk_id TEXT REFERENCES chunks(id) ON DELETE SET NULL,  -- Optional link to chunk
  description TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,                 -- NULL while timer is active/paused
  duration_minutes INTEGER,             -- Final duration when finalized
  -- Pausable timer fields
  status TEXT DEFAULT 'draft',          -- active, paused, draft, finalized
  accumulated_seconds INTEGER DEFAULT 0, -- Total seconds from paused sessions
  last_resumed_at TIMESTAMPTZ,          -- When current active session started
  -- Billing fields
  billable BOOLEAN DEFAULT true,
  invoiced BOOLEAN DEFAULT false,
  invoice_id TEXT,                      -- Links to invoices table when billed
  rate INTEGER,                         -- Rate at time of logging (cents/hour)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INVOICES TABLE
-- Track all invoices with searchable line items
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  stripe_invoice_id TEXT,               -- Stripe invoice ID if synced
  stripe_invoice_url TEXT,              -- Stripe hosted invoice URL
  status TEXT DEFAULT 'draft',          -- draft, sent, paid, void
  subtotal INTEGER DEFAULT 0,           -- cents
  discount_percent INTEGER DEFAULT 0,
  tax_percent INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,              -- cents
  line_items JSONB DEFAULT '[]',        -- Array of {description, quantity, rate, amount, time_log_id}
  notes TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- OAUTH TOKENS TABLE
-- Store OAuth tokens for external services (Google Calendar, Stripe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
  provider TEXT PRIMARY KEY,            -- 'google', 'stripe', etc.
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXTEND EXISTING CLIENTS TABLE
-- Add Stripe customer ID for invoice sync
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_billing_platform ON projects(billing_platform);
CREATE INDEX IF NOT EXISTS idx_projects_last_touched ON projects(last_touched_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority DESC);

-- Chunks indexes
CREATE INDEX IF NOT EXISTS idx_chunks_project_id ON chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_chunks_status ON chunks(status);
CREATE INDEX IF NOT EXISTS idx_chunks_phase ON chunks(phase_name);
CREATE INDEX IF NOT EXISTS idx_chunks_scheduled ON chunks(scheduled_start);

-- Time logs indexes
CREATE INDEX IF NOT EXISTS idx_time_logs_project_id ON time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_chunk_id ON time_logs(chunk_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_invoiced ON time_logs(invoiced);
CREATE INDEX IF NOT EXISTS idx_time_logs_started ON time_logs(started_at DESC);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_line_items ON invoices USING GIN (line_items);  -- For global search

-- ============================================================================
-- HELPFUL VIEWS
-- ============================================================================

-- View: Projects with unbilled totals
CREATE OR REPLACE VIEW projects_with_unbilled AS
SELECT
  p.*,
  COALESCE(SUM(
    CASE WHEN tl.invoiced = false AND tl.billable = true AND tl.duration_minutes IS NOT NULL
    THEN ROUND((tl.duration_minutes::numeric / 60) * COALESCE(tl.rate, p.rate, 12000))
    ELSE 0 END
  ), 0) as unbilled_amount,
  COALESCE(SUM(
    CASE WHEN tl.invoiced = false AND tl.billable = true AND tl.duration_minutes IS NOT NULL
    THEN tl.duration_minutes
    ELSE 0 END
  ), 0) as unbilled_minutes
FROM projects p
LEFT JOIN time_logs tl ON tl.project_id = p.id
GROUP BY p.id;

-- View: CFO Dashboard stats
CREATE OR REPLACE VIEW cfo_stats AS
SELECT
  (SELECT COALESCE(SUM(
    ROUND((tl.duration_minutes::numeric / 60) * COALESCE(tl.rate, 12000))
  ), 0) FROM time_logs tl WHERE tl.invoiced = false AND tl.billable = true AND tl.duration_minutes IS NOT NULL) as unbilled,
  (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'sent') as unpaid,
  (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid' AND paid_at >= date_trunc('month', CURRENT_DATE)) as revenue_mtd,
  (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid' AND paid_at >= date_trunc('year', CURRENT_DATE)) as revenue_ytd,
  (SELECT COUNT(*) * 3900 FROM projects WHERE billing_platform = 'bonsai_legacy' AND status = 'active') as mrr;

-- ============================================================================
-- DONE
-- ============================================================================
-- Run: SELECT * FROM cfo_stats; to verify installation

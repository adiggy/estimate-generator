-- Schedule Draft Support Migration
-- Run this in Neon to add draft scheduling capabilities

-- Add draft schedule fields to chunks
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS draft_scheduled_start TIMESTAMPTZ;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS draft_scheduled_end TIMESTAMPTZ;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS draft_order INTEGER;

-- Schedule drafts table - stores metadata about each draft schedule generation
CREATE TABLE IF NOT EXISTS schedule_drafts (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'draft',          -- draft, accepted, rejected, expired
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_hours INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  rocks_avoided INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick draft lookups
CREATE INDEX IF NOT EXISTS idx_schedule_drafts_status ON schedule_drafts(status);
CREATE INDEX IF NOT EXISTS idx_schedule_drafts_week ON schedule_drafts(week_start);
CREATE INDEX IF NOT EXISTS idx_chunks_draft_scheduled ON chunks(draft_scheduled_start);

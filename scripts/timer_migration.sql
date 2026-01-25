-- Adrial Designs OS - Timer Migration
-- Run this in Neon SQL Editor to enable pausable timers
--
-- This adds columns to the time_logs table for:
-- - status: track timer state (active, paused, draft, finalized)
-- - accumulated_seconds: total time from paused sessions
-- - last_resumed_at: when current active session started

ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS accumulated_seconds INTEGER DEFAULT 0;
ALTER TABLE time_logs ADD COLUMN IF NOT EXISTS last_resumed_at TIMESTAMPTZ;

-- Status values:
-- 'active'    = timer currently running
-- 'paused'    = timer paused, can be resumed
-- 'draft'     = timer stopped but not finalized (can still edit/delete)
-- 'finalized' = ready for invoicing (duration_minutes is set)

-- Database schema for Estimate Generator
-- Run this in your Neon SQL console to set up the tables

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
  type TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Index for faster proposal listing
CREATE INDEX IF NOT EXISTS idx_proposals_updated_at ON proposals(updated_at DESC);

-- Migration 008: Add member archiving support
-- Run this in Supabase SQL Editor

-- 1. Add is_archived column to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- 2. Index for filtering active members
CREATE INDEX IF NOT EXISTS idx_members_active ON members(business_id, is_archived) WHERE is_archived = FALSE;

-- Migration 002: Add addressed/archive support to notifications
-- Run this in Supabase SQL Editor

-- 1. Add is_addressed column for inbox/archive distinction
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_addressed BOOLEAN DEFAULT FALSE;

-- 2. Add index for efficient inbox queries
CREATE INDEX IF NOT EXISTS idx_notifications_addressed ON notifications(member_id, is_addressed) WHERE is_addressed = FALSE;

-- Migration 001: Support members without login + preserve original names + notifications
-- Run this in Supabase SQL Editor

-- 1. Allow members without email (non-users who can be assigned tasks)
ALTER TABLE members ALTER COLUMN email DROP NOT NULL;

-- 2. Store original name from AI extraction (the Fundamental Sheet)
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;

-- 3. Link ai_conversations to created tasks (audit trail)
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id);
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- 4. Update index for better member lookups
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);

-- 5. Notifications table for @mentions
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'mention',
  title TEXT NOT NULL,
  content TEXT,
  link_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  link_step_id UUID REFERENCES pipeline_steps(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(member_id, is_read) WHERE is_read = FALSE;

-- 6. Add attachments support to comments
ALTER TABLE step_comments ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

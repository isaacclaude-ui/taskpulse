-- Migration 003: Add joint/shared task assignment support
-- Run this in Supabase SQL Editor

-- 1. Add columns for multiple assignees (joint tasks)
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS additional_assignees UUID[] DEFAULT '{}';
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS additional_assignee_names TEXT[] DEFAULT '{}';
ALTER TABLE pipeline_steps ADD COLUMN IF NOT EXISTS is_joint BOOLEAN DEFAULT FALSE;

-- 2. Create index for finding steps by additional assignees (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_steps_additional_assignees ON pipeline_steps USING GIN (additional_assignees) WHERE is_joint = TRUE;

-- 3. Comment explaining the joint task logic:
-- When is_joint = TRUE:
--   - Step appears in columns for: assigned_to + all additional_assignees
--   - Any of these members can "claim" the step
--   - Claiming sets assigned_to to claimer, clears additional_assignees, sets is_joint = FALSE

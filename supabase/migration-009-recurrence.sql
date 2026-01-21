-- Migration 009: Add recurring task support
-- Adds recurrence pattern, source task linking, and cycle tracking

-- Add recurrence columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence JSONB DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT 0;

-- Create index for finding recurring tasks
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(team_id) WHERE recurrence IS NOT NULL;

-- Create index for finding task cycles
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source_task_id) WHERE source_task_id IS NOT NULL;

-- Add comment explaining the recurrence JSONB structure
COMMENT ON COLUMN tasks.recurrence IS 'Recurrence pattern: {"type": "daily"|"weekly"|"monthly", "interval": number, "enabled": boolean}';
COMMENT ON COLUMN tasks.source_task_id IS 'References the original task for recurring cycles (null for original/non-recurring)';
COMMENT ON COLUMN tasks.recurrence_count IS 'Which cycle this is (0=original, 1=first repeat, etc.)';

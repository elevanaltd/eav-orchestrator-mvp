-- Migration: Fix Comment Position System
-- Purpose: Add position system tracking and prepare for aggressive migration
-- Phase: 3 of 5-phase comment positioning architecture

-- Add position system tracking columns
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS position_system VARCHAR(20) DEFAULT 'pm_positions',
ADD COLUMN IF NOT EXISTS positions_recovered BOOLEAN DEFAULT FALSE;

-- Mark ALL existing comments as legacy (will be migrated)
-- New comments will have position_system='pm_positions' by default
UPDATE comments
SET position_system = 'string_indices',
    positions_recovered = FALSE
WHERE position_system IS NULL OR position_system = 'pm_positions';

-- Create index for efficient migration queries
CREATE INDEX IF NOT EXISTS idx_comments_position_system
ON comments(position_system, positions_recovered)
WHERE positions_recovered = FALSE;

-- Add comment to track migration history
COMMENT ON COLUMN comments.position_system IS 'Tracks coordinate system: pm_positions (ProseMirror), string_indices (legacy), pm_positions_orphaned (not found in text)';
COMMENT ON COLUMN comments.positions_recovered IS 'TRUE if positions have been migrated from string indices to PM positions';

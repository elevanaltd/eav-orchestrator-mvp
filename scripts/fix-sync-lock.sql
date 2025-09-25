-- Fix stuck sync lock in sync_metadata table
-- Run this in Supabase SQL Editor when you get 409 Conflict errors

-- Check current lock status
SELECT
    id,
    status,
    last_sync_started_at,
    last_sync_completed_at,
    last_error,
    sync_count,
    CASE
        WHEN status = 'running' AND last_sync_started_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (NOW() - last_sync_started_at)) || ' seconds ago'
        ELSE 'N/A'
    END as lock_age
FROM sync_metadata
WHERE id = 'singleton';

-- Release stuck lock if status is 'running'
UPDATE sync_metadata
SET
    status = 'idle',
    last_error = 'Manual lock release - sync was stuck',
    updated_at = NOW()
WHERE id = 'singleton'
AND status = 'running';

-- Verify lock is released
SELECT
    id,
    status,
    last_error,
    updated_at
FROM sync_metadata
WHERE id = 'singleton';

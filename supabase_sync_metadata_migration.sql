-- Migration: Create sync_metadata table for distributed locking
-- Purpose: Prevent concurrent SmartSuite sync operations
-- Created: 2025-09-25 (Server-side sync architecture)

CREATE TABLE IF NOT EXISTS sync_metadata (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'error')),
  last_sync_started_at TIMESTAMPTZ,
  last_sync_completed_at TIMESTAMPTZ,
  last_error TEXT,
  sync_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the singleton row for distributed locking
INSERT INTO sync_metadata (id, status, sync_count)
VALUES ('singleton', 'idle', 0)
ON CONFLICT (id) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_sync_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sync_metadata_updated_at
  BEFORE UPDATE ON sync_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_metadata_updated_at();

-- Enable RLS and create policy for authenticated users to read sync status
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read sync status
CREATE POLICY "Users can read sync metadata" ON sync_metadata
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only service role can modify sync metadata (Edge Functions)
-- This is handled by the service role key in Edge Functions bypassing RLS

-- Grant necessary permissions
GRANT SELECT ON sync_metadata TO authenticated;
GRANT ALL ON sync_metadata TO service_role;

-- Comments for documentation
COMMENT ON TABLE sync_metadata IS 'Singleton table for distributed locking of SmartSuite sync operations';
COMMENT ON COLUMN sync_metadata.id IS 'Always "singleton" - ensures only one sync can run at a time';
COMMENT ON COLUMN sync_metadata.status IS 'Current sync status: idle, running, or error';
COMMENT ON COLUMN sync_metadata.last_sync_started_at IS 'Timestamp when last sync operation began';
COMMENT ON COLUMN sync_metadata.last_sync_completed_at IS 'Timestamp when last sync operation completed successfully';
COMMENT ON COLUMN sync_metadata.last_error IS 'Error message from last failed sync (null if successful)';
COMMENT ON COLUMN sync_metadata.sync_count IS 'Total number of completed sync operations';
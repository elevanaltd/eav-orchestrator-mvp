/**
 * Migration Setup for Testing
 * Manually create sync_metadata table using Supabase client
 */

import { supabase } from '../lib/supabase'

export async function createSyncMetadataTable(): Promise<boolean> {
  try {
    console.log('Creating sync_metadata table...')

    // First, try to create the table using direct SQL execution
    // Since we can't use RPC without proper setup, we'll use the REST API approach

    // Check if table exists first
    const { data: existingData, error: checkError } = await supabase
      .from('sync_metadata')
      .select('id')
      .limit(1)

    if (checkError && !checkError.message.includes('relation "sync_metadata" does not exist')) {
      console.error('Error checking table existence:', checkError)
      return false
    }

    // If table doesn't exist, we need to create it manually
    if (checkError && checkError.message.includes('relation "sync_metadata" does not exist')) {
      console.log('Table does not exist yet - this is expected for first run')
      console.log('Please run the migration SQL manually in Supabase dashboard:')
      console.log('supabase_sync_metadata_migration.sql')
      return false
    }

    // If we reach here, table exists. Try to insert singleton row.
    const { data, error: insertError } = await supabase
      .from('sync_metadata')
      .insert({
        id: 'singleton',
        status: 'idle',
        sync_count: 0
      })
      .select()
      .maybeSingle()

    // If duplicate key error, that's fine - singleton already exists
    if (insertError && insertError.message.includes('duplicate key')) {
      console.log('✅ sync_metadata singleton row already exists')
      return true
    }

    if (insertError) {
      console.error('Error inserting singleton row:', insertError)
      return false
    }

    console.log('✅ sync_metadata table and singleton row created successfully')
    return true
  } catch (error) {
    console.error('Migration failed:', error)
    return false
  }
}

export async function testSyncMetadataTable(): Promise<boolean> {
  try {
    // Test that we can read the sync_metadata table
    const { data, error } = await supabase
      .from('sync_metadata')
      .select('*')
      .single()

    if (error) {
      console.error('Error reading sync_metadata:', error)
      return false
    }

    console.log('✅ sync_metadata table is accessible:', data)

    // Validate the structure
    if (data.id !== 'singleton') {
      console.error('❌ Expected singleton id, got:', data.id)
      return false
    }

    if (!['idle', 'running', 'error'].includes(data.status)) {
      console.error('❌ Invalid status value:', data.status)
      return false
    }

    console.log('✅ sync_metadata table schema validation passed')
    return true
  } catch (error) {
    console.error('Test failed:', error)
    return false
  }
}

// Export SQL for manual execution
export const SYNC_METADATA_SQL = `
-- Migration: Create sync_metadata table for distributed locking
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

-- Enable RLS and create policy for authenticated users to read sync status
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read sync metadata
CREATE POLICY "Users can read sync metadata" ON sync_metadata
  FOR SELECT USING (auth.role() = 'authenticated');

-- Grant necessary permissions
GRANT SELECT ON sync_metadata TO authenticated;
GRANT ALL ON sync_metadata TO service_role;
`
#!/usr/bin/env node

/**
 * Manual sync_metadata table creation script
 * Creates the distributed locking table needed for server-side sync
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env')
  process.exit(1)
}

// Create admin client using service key
const supabase = createClient(supabaseUrl, serviceKey)

const SQL = `
-- Create sync_metadata table for distributed locking
CREATE TABLE IF NOT EXISTS public.sync_metadata (
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
INSERT INTO public.sync_metadata (id, status, sync_count)
VALUES ('singleton', 'idle', 0)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read sync metadata
DROP POLICY IF EXISTS "Users can read sync metadata" ON public.sync_metadata;
CREATE POLICY "Users can read sync metadata" ON public.sync_metadata
  FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT ON public.sync_metadata TO authenticated;
GRANT ALL ON public.sync_metadata TO service_role;
`

async function createTable() {
  try {
    console.log('🔧 Creating sync_metadata table...')

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: SQL
    })

    if (error) {
      console.error('❌ Error executing SQL:', error)

      // Fallback: try creating using individual queries
      console.log('🔄 Trying fallback approach...')

      // First check if table exists by trying to select from it
      const { error: checkError } = await supabase
        .from('sync_metadata')
        .select('id')
        .limit(1)

      if (checkError && checkError.code === 'PGRST205') {
        console.log('📋 Table does not exist, creating manually...')
        console.log('Please execute this SQL manually in Supabase SQL Editor:')
        console.log('\n' + SQL + '\n')
        return false
      }
    }

    // Test that table was created
    const { data: testData, error: testError } = await supabase
      .from('sync_metadata')
      .select('*')
      .single()

    if (testError) {
      console.error('❌ Error testing table:', testError)
      return false
    }

    console.log('✅ sync_metadata table created and tested successfully!')
    console.log('📊 Table data:', testData)
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return false
  }
}

createTable().then(success => {
  console.log(success ? '✅ Migration complete!' : '❌ Migration failed')
  process.exit(success ? 0 : 1)
})
#!/usr/bin/env node

/**
 * Manual table creation using direct HTTP requests
 */

import { readFileSync } from 'fs'

// Load environment variables manually
const envContent = readFileSync('.env', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    env[key.trim()] = value.trim()
  }
})

const supabaseUrl = env.VITE_SUPABASE_URL
const serviceKey = env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env')
  process.exit(1)
}

console.log('🔧 Creating sync_metadata table using Supabase REST API...')

// SQL for table creation
const sql = `
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

INSERT INTO public.sync_metadata (id, status, sync_count)
VALUES ('singleton', 'idle', 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read sync metadata" ON public.sync_metadata
  FOR SELECT USING (auth.role() = 'authenticated');

GRANT SELECT ON public.sync_metadata TO authenticated;
GRANT ALL ON public.sync_metadata TO service_role;
`

try {
  // Try to execute SQL using rpc endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql })
  })

  if (!response.ok) {
    console.error('❌ RPC call failed:', response.status, await response.text())

    // Manual approach: Output SQL for manual execution
    console.log('\n📋 Please execute this SQL manually in Supabase SQL Editor:')
    console.log('\n' + sql)
    console.log('\n🔗 Access SQL Editor at: https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0] + '/sql')
    process.exit(1)
  }

  const result = await response.json()
  console.log('✅ Table creation SQL executed successfully!')

  // Test the table by reading from it
  const testResponse = await fetch(`${supabaseUrl}/rest/v1/sync_metadata?select=*&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  })

  if (testResponse.ok) {
    const testData = await testResponse.json()
    console.log('✅ Table test successful:', testData)
  } else {
    console.warn('⚠️  Table created but test failed:', testResponse.status)
  }

} catch (error) {
  console.error('❌ Error:', error.message)

  console.log('\n📋 Please execute this SQL manually in Supabase SQL Editor:')
  console.log('\n' + sql)
  console.log('\n🔗 Access SQL Editor at: https://supabase.com/dashboard')
  process.exit(1)
}
#!/usr/bin/env node
// Test script for Edge Function

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

console.log('Creating Supabase client...')
console.log('URL:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('\nInvoking Edge Function...')

try {
  const { data, error } = await supabase.functions.invoke('smartsuite-sync', {
    body: {}
  })

  if (error) {
    console.error('\n❌ Edge Function Error:')
    console.error('Message:', error.message)
    console.error('Full error:', error)

    // Try to get more details about what happened
    console.log('\nChecking sync_metadata for error details...')
    const { data: metadata } = await supabase
      .from('sync_metadata')
      .select('*')
      .eq('id', 'singleton')
      .single()

    if (metadata) {
      console.log('Sync status:', metadata.status)
      console.log('Last error:', metadata.last_error)
    }
  } else {
    console.log('\n✅ Success!')
    console.log('Data:', JSON.stringify(data, null, 2))
  }
} catch (err) {
  console.error('\n❌ Unexpected error:', err)
}
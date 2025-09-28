#!/usr/bin/env node

// Simple script to verify Supabase auth is working
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

console.log('Testing Supabase connection...')
console.log('URL:', supabaseUrl)
console.log('Key present:', !!supabaseKey)
console.log('Key length:', supabaseKey?.length)

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\nAttempting to get session...')
supabase.auth.getSession()
  .then(({ data, error }) => {
    if (error) {
      console.error('Error:', error)
    } else {
      console.log('Success!')
      console.log('Session exists:', !!data.session)
      if (data.session) {
        console.log('User ID:', data.session.user.id)
        console.log('User email:', data.session.user.email)
      } else {
        console.log('No active session (user not logged in)')
      }
    }
    process.exit(0)
  })
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })

// Timeout after 5 seconds
setTimeout(() => {
  console.error('Timeout: getSession took longer than 5 seconds!')
  process.exit(1)
}, 5000)
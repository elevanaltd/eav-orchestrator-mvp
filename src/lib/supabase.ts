import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// Support both new and old environment variable names for backward compatibility
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL environment variable')
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) environment variable')
  console.error('Available env vars:', Object.keys(import.meta.env))
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY environment variable')
}

// Log initialization for debugging (remove in production)
console.log('Supabase client initializing with:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keySource: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'publishable' : 'anon'
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
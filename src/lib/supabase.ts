import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          role: string
          created_at: string
          updated_at: string
        }
      }
      projects: {
        Row: {
          id: string
          title: string
          due_date: string | null
          created_at: string
          updated_at: string
        }
      }
      videos: {
        Row: {
          id: string
          project_id: string
          title: string
          main_stream_status: string | null
          vo_stream_status: string | null
          production_type: string | null
          created_at: string
          updated_at: string
        }
      }
      scripts: {
        Row: {
          id: string
          video_id: string
          yjs_state: Record<string, unknown> | null
          plain_text: string | null
          component_count: number
          created_at: string
          updated_at: string
        }
      }
    }
  }
}
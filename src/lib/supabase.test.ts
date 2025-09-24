import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should create supabase client with correct configuration', async () => {
    // Set up environment variables
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-key')

    const mockClient = { auth: {}, from: vi.fn() }
    vi.mocked(createClient).mockReturnValue(mockClient as any)

    // Dynamic import to test module initialization
    const { supabase } = await import('./supabase')

    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-key',
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      }
    )
    expect(supabase).toBe(mockClient)
  })

  it('should throw error when environment variables are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')

    await expect(import('./supabase')).rejects.toThrow(
      'Missing Supabase environment variables'
    )
  })
})
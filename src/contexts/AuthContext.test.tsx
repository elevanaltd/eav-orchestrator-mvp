import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

// Mock Supabase with factory function to avoid hoisting issues
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn()
    }))
  }
}))

// Get a typed reference to the mocked supabase
import { supabase } from '../lib/supabase'
const mockSupabase = vi.mocked(supabase)

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide auth context to children', () => {
    (mockSupabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null })

    render(
      <AuthProvider>
        <div>Test Child</div>
      </AuthProvider>
    )

    expect(screen.getByText('Test Child')).toBeInTheDocument()
  })

  it('should handle login', async () => {
    const mockSession = {
      user: { id: '123', email: 'test@example.com' },
      access_token: 'token'
    }

    ;(mockSupabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null })
    ;(mockSupabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { session: mockSession, user: mockSession.user },
      error: null
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })

    await act(async () => {
      const response = await result.current.signIn('test@example.com', 'password')
      expect(response.error).toBeNull()
    })

    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password'
    })
  })

  it('should handle signup', async () => {
    const mockUser = { id: '123', email: 'new@example.com' }

    ;(mockSupabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null })
    ;(mockSupabase.auth.signUp as any).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })

    await act(async () => {
      const response = await result.current.signUp('new@example.com', 'password', 'New User')
      expect(response.error).toBeNull()
    })

    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password',
      options: {
        data: {
          display_name: 'New User'
        }
      }
    })
  })

  it('should handle logout', async () => {
    (mockSupabase.auth.getSession as any).mockResolvedValue({ data: { session: null }, error: null })
    ;(mockSupabase.auth.signOut as any).mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })

    await act(async () => {
      await result.current.signOut()
    })

    expect(mockSupabase.auth.signOut).toHaveBeenCalled()
  })

  it('should show loading state initially', () => {
    (mockSupabase.auth.getSession as any).mockImplementation(() => new Promise(() => {})) // Never resolves

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('should handle RLS infinite recursion error gracefully', async () => {
    const mockUser = { id: 'test-user-id', email: 'test@example.com' }
    const mockSession = { user: mockUser }

    // Mock successful auth session
    ;(mockSupabase.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null
    })

    // **RED STATE: Mock RLS infinite recursion error**
    ;(mockSupabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(
            new Error('infinite recursion detected in policy for relation "user_profiles"')
          )
        })
      })
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })

    // Wait for auth initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Should have user but no profile due to RLS error
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.profile).toBeNull()
    expect(result.current.loading).toBe(false)

    // Verify the problematic query was attempted
    expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
  })

  it('should successfully fetch user profile when RLS policy is fixed', async () => {
    // **GREEN STATE: Test that the RLS policy fix works**
    const mockUser = { id: 'test-user-id', email: 'test@example.com' }
    const mockSession = { user: mockUser }

    const mockProfile = {
      id: 'test-user-id',
      email: 'test@example.com',
      display_name: 'Test User',
      role: 'user',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }

    // Mock successful auth session
    ;(mockSupabase.auth.getSession as any).mockResolvedValue({
      data: { session: mockSession },
      error: null
    })

    // **GREEN STATE: Mock successful profile fetch (no RLS recursion)**
    ;(mockSupabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockProfile,
            error: null
          })
        })
      })
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider
    })

    // Wait for auth initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    // Should have both user and profile successfully loaded
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.profile).toEqual(mockProfile)
    expect(result.current.loading).toBe(false)

    // Verify the successful query was made
    expect(mockSupabase.from).toHaveBeenCalledWith('user_profiles')
  })
})
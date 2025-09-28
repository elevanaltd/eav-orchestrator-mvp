import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'client' | null
  created_at: string
  client_filter?: string | null
}

interface AuthContextType {
  currentUser: User | null
  userProfile: UserProfile | null
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('[AuthProvider] Component rendering...')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  console.log('[AuthProvider] Current loading state:', loading)

  // Function to load user profile - simplified
  const loadUserProfile = useCallback(async (userId: string, userEmail?: string, userName?: string) => {
    console.log('[AuthContext] loadUserProfile called with:', { userId, userEmail, userName })
    try {
      // First try to get existing profile
      console.log('[AuthContext] Fetching user profile from database...')
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()  // Use maybeSingle to avoid 406 errors

      console.log('[AuthContext] Profile fetch result:', { data, fetchError })

      if (data) {
        console.log('[AuthContext] Setting existing profile:', data)
        setUserProfile(data)
      } else if (userEmail) {
        // Create profile if it doesn't exist
        console.log('[AuthContext] No existing profile, creating new one for:', userEmail)
        const { data: newProfile, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail,
            display_name: userName || userEmail,
            role: 'client' // Default to client for security
          })
          .select()
          .single()

        console.log('[AuthContext] Profile creation result:', { newProfile, insertError })

        if (insertError) {
          console.error('[AuthContext] Error creating user profile:', insertError)
        } else {
          console.log('[AuthContext] Setting new profile:', newProfile)
          setUserProfile(newProfile)
        }
      } else {
        console.log('[AuthContext] No email provided, cannot create profile')
      }
    } catch (err) {
      console.error('[AuthContext] Exception in loadUserProfile:', err)
    }
    console.log('[AuthContext] loadUserProfile completed')
  }, [])

  useEffect(() => {
    console.log('[AuthContext] useEffect starting - initializing auth')
    let mounted = true

    // Check session with proper error handling and timeout
    console.log('[AuthContext] Checking for existing session...')

    // Create a proper timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Session check timeout after 2s')), 2000)
    })

    // Race between session check and timeout
    Promise.race([
      supabase.auth.getSession(),
      timeoutPromise
    ])
      .then((result) => {
        if (!mounted) {
          console.log('[AuthContext] Component unmounted, ignoring session result')
          return
        }

        // Type assertion since we know this is the getSession result
        const sessionResult = result as Awaited<ReturnType<typeof supabase.auth.getSession>>
        const { data: { session }, error } = sessionResult

        console.log('[AuthContext] Session check complete:', {
          hasSession: !!session,
          error: error?.message
        })

        if (error) {
          console.error('[AuthContext] Session check error:', error)
          setLoading(false)
          return
        }

        setCurrentUser(session?.user ?? null)

        // If we have a user, try to load profile (but don't block on it)
        if (session?.user) {
          console.log('[AuthContext] User found, loading profile async...')
          // Don't await - just fire and forget the profile load
          loadUserProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name
          ).then(() => {
            console.log('[AuthContext] Profile load complete')
          }).catch((err) => {
            console.error('[AuthContext] Profile load failed:', err)
          })
        }

        // Set loading to false immediately after getting session
        console.log('[AuthContext] Setting loading to false - session check complete')
        if (mounted) {
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('[AuthContext] Session check failed or timed out:', err)
        if (mounted) {
          console.log('[AuthContext] Forcing loading=false due to session check failure')
          setLoading(false)
        }
      })

    // Listen for auth changes
    console.log('[AuthContext] Setting up auth state change listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return

        console.log('[AuthContext] Auth state changed - NOT resetting loading state')
        setCurrentUser(session?.user ?? null)

        if (session?.user) {
          // Fire and forget profile load - don't block
          loadUserProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name
          ).catch((err) => {
            console.error('[AuthContext] Profile load failed on auth change:', err)
          })
        } else {
          setUserProfile(null)
        }

        // Don't touch loading state on auth changes - only on initial load
      }
    )

    return () => {
      console.log('[AuthContext] Cleaning up')
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadUserProfile])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      })
      return { error }
    } catch (err) {
      return { error: err as Error }
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
  }

  const value: AuthContextType = {
    currentUser,
    userProfile,
    signIn,
    signUp,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
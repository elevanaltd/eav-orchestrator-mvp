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
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Function to load user profile
  const loadUserProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to load user profile:', error)
      // If profile doesn't exist, create one with admin role for development
      if (error.code === 'PGRST116') {
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: currentUser?.email || '',
            display_name: currentUser?.user_metadata?.full_name || currentUser?.email || '',
            role: 'admin' // Default to admin for development
          })
          .select()
          .single()

        setUserProfile(newProfile)
      }
    } else {
      setUserProfile(data)
    }
  }, [currentUser?.email, currentUser?.user_metadata])

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setCurrentUser(session?.user ?? null)

      // Load user profile if we have a user
      if (session?.user) {
        await loadUserProfile(session.user.id)
      }

      setLoading(false)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setCurrentUser(session?.user ?? null)

        // Load user profile when user signs in
        if (session?.user) {
          await loadUserProfile(session.user.id)
        } else {
          setUserProfile(null)
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
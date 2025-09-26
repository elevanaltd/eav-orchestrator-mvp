/**
 * Authentication utilities for SmartSuite Sync Edge Function
 * Proper JWT validation using Supabase client
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=deno'

/**
 * Validate JWT token and extract user information
 */
export async function validateJWT(authHeader: string): Promise<{ success: true, user: any } | { success: false, error: string }> {
  try {
    // Extract token from Authorization header
    if (!authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Invalid Authorization header format' }
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Create Supabase client with service role for JWT validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration:', {
        url_available: !!supabaseUrl,
        service_key_available: !!supabaseServiceKey
      })
      return { success: false, error: 'Server configuration error' }
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate the JWT token
    const { data: user, error } = await supabase.auth.getUser(token)

    if (error) {
      console.log('JWT validation failed:', error.message)
      return { success: false, error: 'Invalid or expired token' }
    }

    if (!user.user) {
      console.log('JWT validation failed: No user found')
      return { success: false, error: 'Invalid token: no user found' }
    }

    console.log('JWT validated successfully for user:', user.user.id)
    return { success: true, user: user.user }

  } catch (error) {
    console.error('JWT validation error:', error)
    return { success: false, error: 'Authentication service error' }
  }
}

/**
 * Check if user has required role for SmartSuite operations
 * For now, we just check that they're authenticated
 * TODO: Add role-based access control when needed
 */
export function checkPermissions(user: any, action: string): { success: true } | { success: false, error: string } {
  // For MVP, all authenticated users can perform SmartSuite operations
  // This can be expanded later with role checks

  console.log(`Permission check for user ${user.id} performing action: ${action}`)

  return { success: true }
}
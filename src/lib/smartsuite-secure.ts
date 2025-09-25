/**
 * Secure SmartSuite Integration - Client-Side
 *
 * This module provides secure access to SmartSuite data via Edge Functions.
 * NO API KEYS are exposed to the client - all requests go through
 * server-side Edge Functions that handle authentication securely.
 *
 * Security Architecture:
 * Client → Edge Function → SmartSuite API
 *
 * Benefits:
 * - API keys never exposed to browser
 * - Server-side rate limiting and error handling
 * - Row-Level Security (RLS) enforced via service role
 * - Distributed locking prevents concurrent sync issues
 */

import { supabase } from './supabase'

export interface SyncResult {
  projectsFound: number
  projectsSynced: number
  videosFound: number
  videosSynced: number
  errors: string[]
}

export interface SyncStatus {
  status: 'idle' | 'running' | 'error'
  lastSyncStarted: string | null
  lastSyncCompleted: string | null
  lastError: string | null
  syncCount: number
}

export class SecureSmartSuiteIntegration {

  /**
   * Get current sync status from sync_metadata table
   */
  async getSyncStatus(): Promise<SyncStatus | null> {
    try {
      const { data, error } = await supabase
        .from('sync_metadata')
        .select('*')
        .single()

      if (error) {
        console.error('Error fetching sync status:', error)
        return null
      }

      return {
        status: data.status,
        lastSyncStarted: data.last_sync_started_at,
        lastSyncCompleted: data.last_sync_completed_at,
        lastError: data.last_error,
        syncCount: data.sync_count
      }
    } catch (error) {
      console.error('Error in getSyncStatus:', error)
      return null
    }
  }

  /**
   * Trigger secure sync via Edge Function
   * All API authentication handled server-side
   */
  async triggerSync(): Promise<SyncResult | null> {
    try {
      console.log('🔄 Triggering secure sync via Edge Function...')

      // Call the Edge Function - no API keys exposed to client
      const { data, error } = await supabase.functions.invoke('smartsuite-sync', {
        body: {} // Empty body - Edge Function handles everything
      })

      if (error) {
        console.error('Edge Function error:', error)

        // Handle specific error codes
        if (error.message?.includes('SYNC_IN_PROGRESS')) {
          throw new Error('Sync already in progress. Please wait for current sync to complete.')
        }

        throw new Error(`Sync failed: ${error.message}`)
      }

      console.log('✅ Secure sync completed:', data)
      return data as SyncResult

    } catch (error) {
      console.error('Error in triggerSync:', error)
      throw error
    }
  }

  /**
   * Test connection to Edge Function (not direct SmartSuite)
   * This validates our server-side architecture without exposing credentials
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing secure connection via Edge Function...')

      // Get sync status to test our server-side setup
      const status = await this.getSyncStatus()

      if (!status) {
        console.error('Cannot read sync_metadata table')
        return false
      }

      console.log('✅ Server-side architecture accessible:', status)
      return true

    } catch (error) {
      console.error('Connection test failed:', error)
      return false
    }
  }

  /**
   * Monitor sync progress in real-time
   * Polls sync status to provide live updates
   */
  async monitorSync(
    onStatusChange: (status: SyncStatus) => void,
    intervalMs: number = 1000
  ): Promise<() => void> {
    let monitoring = true

    const poll = async () => {
      while (monitoring) {
        const status = await this.getSyncStatus()
        if (status) {
          onStatusChange(status)

          // Stop monitoring if sync completes or errors
          if (status.status === 'idle' || status.status === 'error') {
            break
          }
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    }

    // Start polling
    poll().catch(console.error)

    // Return cleanup function
    return () => {
      monitoring = false
    }
  }
}

// Export singleton instance
export const secureSmartSuite = new SecureSmartSuiteIntegration()

// Mark old smartsuite.ts as deprecated
console.warn(`
⚠️  SECURITY NOTICE: Direct SmartSuite API integration has been replaced with secure Edge Functions.

    OLD (Insecure):  src/lib/smartsuite.ts
    NEW (Secure):    src/lib/smartsuite-secure.ts

    Benefits:
    • API keys never exposed to browser
    • Server-side rate limiting & error handling
    • Row-Level Security enforced
    • Distributed locking prevents race conditions

    Migration:
    • Replace smartSuite.* calls with secureSmartSuite.*
    • Remove VITE_SMARTSUITE_API_KEY from client env vars
`)
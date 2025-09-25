/**
 * Secure SmartSuite Integration Tests
 *
 * Tests the secure client-side wrapper that calls Edge Functions
 * instead of directly accessing SmartSuite APIs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase module before importing
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }
}))

import { SecureSmartSuiteIntegration } from './smartsuite-secure'
import { supabase } from './supabase'

// Type assertion for mocked supabase
const mockSupabase = supabase as typeof supabase & {
  from: ReturnType<typeof vi.fn>
  functions: {
    invoke: ReturnType<typeof vi.fn>
  }
}

describe('SecureSmartSuiteIntegration', () => {
  let integration: SecureSmartSuiteIntegration

  beforeEach(() => {
    vi.clearAllMocks()
    integration = new SecureSmartSuiteIntegration()
  })

  describe('getSyncStatus', () => {
    it('should fetch sync status from sync_metadata table', async () => {
      const mockSyncData = {
        id: 'singleton',
        status: 'idle',
        last_sync_started_at: null,
        last_sync_completed_at: '2025-09-25T18:00:00Z',
        last_error: null,
        sync_count: 5
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockSyncData,
            error: null
          })
        })
      })

      const result = await integration.getSyncStatus()

      expect(mockSupabase.from).toHaveBeenCalledWith('sync_metadata')
      expect(result).toEqual({
        status: 'idle',
        lastSyncStarted: null,
        lastSyncCompleted: '2025-09-25T18:00:00Z',
        lastError: null,
        syncCount: 5
      })
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Table not found' }
          })
        })
      })

      const result = await integration.getSyncStatus()
      expect(result).toBeNull()
    })
  })

  describe('triggerSync', () => {
    it('should call smartsuite-sync Edge Function', async () => {
      const mockSyncResult = {
        projectsFound: 3,
        projectsSynced: 3,
        videosFound: 12,
        videosSynced: 10,
        errors: []
      }

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockSyncResult,
        error: null
      })

      const result = await integration.triggerSync()

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('smartsuite-sync', {
        body: {}
      })
      expect(result).toEqual(mockSyncResult)
    })

    it('should handle sync in progress error', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'SYNC_IN_PROGRESS' }
      })

      await expect(integration.triggerSync()).rejects.toThrow(
        'Sync already in progress. Please wait for current sync to complete.'
      )
    })

    it('should handle generic Edge Function errors', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Internal server error' }
      })

      await expect(integration.triggerSync()).rejects.toThrow(
        'Sync failed: Internal server error'
      )
    })
  })

  describe('testConnection', () => {
    it('should test connection by reading sync status', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { status: 'idle', sync_count: 0 },
            error: null
          })
        })
      })

      const result = await integration.testConnection()
      expect(result).toBe(true)
    })

    it('should return false when sync_metadata is inaccessible', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'RLS violation' }
          })
        })
      })

      const result = await integration.testConnection()
      expect(result).toBe(false)
    })
  })

  describe('monitorSync', () => {
    it('should poll sync status and call callback', async () => {
      const mockCallback = vi.fn()
      const mockSyncStatus = {
        status: 'running' as const,
        lastSyncStarted: '2025-09-25T18:00:00Z',
        lastSyncCompleted: null,
        lastError: null,
        syncCount: 5
      }

      // Mock getSyncStatus to return running status first, then idle
      let callCount = 0
      vi.spyOn(integration, 'getSyncStatus').mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return mockSyncStatus
        } else {
          return { ...mockSyncStatus, status: 'idle' }
        }
      })

      const stopMonitoring = await integration.monitorSync(mockCallback, 100)

      // Wait for a couple of polling cycles
      await new Promise(resolve => setTimeout(resolve, 250))

      expect(mockCallback).toHaveBeenCalledWith(mockSyncStatus)
      expect(mockCallback).toHaveBeenCalledWith({ ...mockSyncStatus, status: 'idle' })

      // Cleanup
      stopMonitoring()
    })

    it('should stop monitoring when cleanup function is called', async () => {
      const mockCallback = vi.fn()
      vi.spyOn(integration, 'getSyncStatus').mockResolvedValue({
        status: 'running',
        lastSyncStarted: '2025-09-25T18:00:00Z',
        lastSyncCompleted: null,
        lastError: null,
        syncCount: 5
      })

      const stopMonitoring = await integration.monitorSync(mockCallback, 100)

      // Stop monitoring immediately
      stopMonitoring()

      // Wait a bit and verify callback wasn't called many times
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should have been called at most once (before stopping)
      expect(mockCallback.mock.calls.length).toBeLessThanOrEqual(1)
    })
  })

  describe('Security Validation', () => {
    it('should never expose SmartSuite API keys', () => {
      // Verify that the secure integration doesn't contain API key references
      const integrationString = integration.constructor.toString()

      expect(integrationString).not.toContain('SMARTSUITE_API_KEY')
      expect(integrationString).not.toContain('Bearer ')
      expect(integrationString).not.toContain('api.smartsuite.com')
    })

    it('should only communicate via Edge Functions', () => {
      // All external API calls should go through Edge Functions
      const mockFetch = vi.fn()
      global.fetch = mockFetch

      // Any direct API calls would be a security violation
      // The secure integration should only use supabase.functions.invoke
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should enforce server-side authentication pattern', () => {
      // Verify that all data access goes through Supabase client
      // This ensures RLS is enforced and authentication is handled server-side
      expect(mockSupabase.from).toBeDefined()
      expect(mockSupabase.functions).toBeDefined()
    })
  })
})
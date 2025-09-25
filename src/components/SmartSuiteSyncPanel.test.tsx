/**
 * SmartSuiteSyncPanel Tests
 *
 * Tests for the secure sync panel component that uses Edge Functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SmartSuiteSyncPanel } from './SmartSuiteSyncPanel'

// Mock the secure SmartSuite integration
const mockSecureSmartSuite = {
  getSyncStatus: vi.fn(),
  triggerSync: vi.fn(),
  testConnection: vi.fn(),
  monitorSync: vi.fn()
}

vi.mock('../lib/smartsuite-secure', () => ({
  secureSmartSuite: mockSecureSmartSuite
}))

describe('SmartSuiteSyncPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render sync panel with secure architecture notice', () => {
    render(<SmartSuiteSyncPanel />)

    expect(screen.getByText(/SmartSuite Sync/)).toBeInTheDocument()
    expect(screen.getByText(/🔄 Secure Sync/)).toBeInTheDocument()
  })

  it('should test connection via Edge Function', async () => {
    mockSecureSmartSuite.testConnection.mockResolvedValue(true)

    render(<SmartSuiteSyncPanel />)

    const testButton = screen.getByText('🧪 Test Connection')
    fireEvent.click(testButton)

    await waitFor(() => {
      expect(mockSecureSmartSuite.testConnection).toHaveBeenCalled()
    })
  })

  it('should trigger sync via Edge Function', async () => {
    const mockSyncResult = {
      projectsFound: 2,
      projectsSynced: 2,
      videosFound: 8,
      videosSynced: 6,
      errors: []
    }

    mockSecureSmartSuite.triggerSync.mockResolvedValue(mockSyncResult)
    mockSecureSmartSuite.monitorSync.mockImplementation(async (callback) => {
      // Simulate monitoring
      callback({
        status: 'running',
        lastSyncStarted: new Date().toISOString(),
        lastSyncCompleted: null,
        lastError: null,
        syncCount: 1
      })

      setTimeout(() => {
        callback({
          status: 'idle',
          lastSyncStarted: null,
          lastSyncCompleted: new Date().toISOString(),
          lastError: null,
          syncCount: 2
        })
      }, 100)

      return () => {} // Cleanup function
    })

    render(<SmartSuiteSyncPanel />)

    const syncButton = screen.getByText('🔄 Sync Now')
    fireEvent.click(syncButton)

    await waitFor(() => {
      expect(mockSecureSmartSuite.triggerSync).toHaveBeenCalled()
    })

    // Should show sync results
    await waitFor(() => {
      expect(screen.getByText(/Projects: 2\/2/)).toBeInTheDocument()
      expect(screen.getByText(/Videos: 6\/8/)).toBeInTheDocument()
    })
  })

  it('should handle sync errors gracefully', async () => {
    mockSecureSmartSuite.triggerSync.mockRejectedValue(
      new Error('Sync already in progress')
    )

    render(<SmartSuiteSyncPanel />)

    const syncButton = screen.getByText('🔄 Sync Now')
    fireEvent.click(syncButton)

    await waitFor(() => {
      expect(screen.getByText(/Sync already in progress/)).toBeInTheDocument()
    })
  })

  it('should display security architecture information', () => {
    render(<SmartSuiteSyncPanel />)

    expect(screen.getByText(/Security:/)).toBeInTheDocument()
    expect(screen.getByText(/Server-side only/)).toBeInTheDocument()
    expect(screen.getByText(/Edge Functions/)).toBeInTheDocument()
  })

  it('should show sync status information', async () => {
    mockSecureSmartSuite.getSyncStatus.mockResolvedValue({
      status: 'idle',
      lastSyncStarted: null,
      lastSyncCompleted: '2025-09-25T18:00:00Z',
      lastError: null,
      syncCount: 5
    })

    render(<SmartSuiteSyncPanel />)

    await waitFor(() => {
      expect(screen.getByText(/Last completed: 6:00 PM/)).toBeInTheDocument()
      expect(screen.getByText(/Total syncs: 5/)).toBeInTheDocument()
    })
  })

  describe('Security Validation', () => {
    it('should not contain any direct SmartSuite API references', () => {
      const { container } = render(<SmartSuiteSyncPanel />)
      const componentHTML = container.innerHTML

      // Should not contain insecure API patterns
      expect(componentHTML).not.toContain('SMARTSUITE_API_KEY')
      expect(componentHTML).not.toContain('api.smartsuite.com')
      expect(componentHTML).not.toContain('Bearer ')
    })

    it('should only reference Edge Functions for data access', () => {
      render(<SmartSuiteSyncPanel />)

      // Should show Edge Function architecture
      expect(screen.getByText(/Edge Functions/)).toBeInTheDocument()
      expect(screen.getByText(/Server-side only/)).toBeInTheDocument()
    })
  })
})
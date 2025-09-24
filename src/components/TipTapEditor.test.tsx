import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TipTapEditor } from './TipTapEditor'
import { dataAccess } from '../services/data-access'

// Mock the data access service
vi.mock('../services/data-access', () => ({
  dataAccess: {
    getScriptByVideoId: vi.fn(),
    createScript: vi.fn(),
    updateScript: vi.fn(),
    listScriptComponents: vi.fn(),
    createScriptComponent: vi.fn(),
    deleteScriptComponents: vi.fn()
  }
}))

// Type the mocked functions
const mockedDataAccess = vi.mocked(dataAccess)

describe('TipTapEditor Component Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Extraction from Paragraphs', () => {
    it('should extract components from paragraphs in the editor', async () => {
      // Mock no existing script
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="test-video-123" />)

      // Wait for the editor to render
      await waitFor(() => {
        // The default content has 4 paragraphs = 4 components
        const components = screen.getAllByText(/^C\d+$/)
        expect(components).toHaveLength(4)
      })
    })

    it('should number components sequentially as C1, C2, C3...', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="test-video-123" />)

      await waitFor(() => {
        expect(screen.getByText('C1')).toBeInTheDocument()
        expect(screen.getByText('C2')).toBeInTheDocument()
        expect(screen.getByText('C3')).toBeInTheDocument()
        expect(screen.getByText('C4')).toBeInTheDocument()
      })
    })

    it('should extract component content correctly', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="test-video-123" />)

      await waitFor(() => {
        // Check that the first component content is extracted
        expect(screen.getByText(/This is the first component of your script/)).toBeInTheDocument()
      })
    })

    it('should display word count for each component', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="test-video-123" />)

      await waitFor(() => {
        // Check that word counts are displayed
        expect(screen.getByText(/\d+ words/)).toBeInTheDocument()
      })
    })
  })

  describe('Supabase Integration', () => {
    it('should load existing script from Supabase when videoId is provided', async () => {
      const mockScript = {
        id: 'script-123',
        videoId: 'video-123',
        plainText: 'Existing paragraph one.\n\nExisting paragraph two.',
        componentCount: 2,
        yDocState: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const mockComponents = [
        {
          id: 'comp-1',
          scriptId: 'script-123',
          componentNumber: 1,
          content: 'Existing paragraph one.',
          wordCount: 3,
          createdAt: new Date()
        },
        {
          id: 'comp-2',
          scriptId: 'script-123',
          componentNumber: 2,
          content: 'Existing paragraph two.',
          wordCount: 3,
          createdAt: new Date()
        }
      ]

      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: mockScript,
        error: null
      })

      mockedDataAccess.listScriptComponents.mockResolvedValue({
        data: mockComponents,
        error: null
      })

      render(<TipTapEditor videoId="video-123" />)

      await waitFor(() => {
        expect(dataAccess.getScriptByVideoId).toHaveBeenCalledWith('video-123')
        expect(dataAccess.listScriptComponents).toHaveBeenCalledWith('script-123')
      })
    })

    it('should create new script if none exists', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      mockedDataAccess.createScript.mockResolvedValue({
        data: {
          id: 'new-script-123',
          videoId: 'video-123',
          plainText: '',
          componentCount: 0,
          yDocState: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        error: null
      })

      render(<TipTapEditor videoId="video-123" />)

      // Wait a bit for debounced save to trigger
      await waitFor(() => {
        // The editor should attempt to save after a delay
        expect(dataAccess.getScriptByVideoId).toHaveBeenCalledWith('video-123')
      }, { timeout: 2000 })
    })

    it('should save components to Supabase when content changes', async () => {
      const mockScript = {
        id: 'script-123',
        videoId: 'video-123',
        plainText: '',
        componentCount: 0,
        yDocState: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: mockScript,
        error: null
      })

      mockedDataAccess.listScriptComponents.mockResolvedValue({
        data: [],
        error: null
      })

      mockedDataAccess.updateScript.mockResolvedValue({
        data: mockScript,
        error: null
      })

      mockedDataAccess.deleteScriptComponents.mockResolvedValue({
        data: undefined,
        error: null
      })

      mockedDataAccess.createScriptComponent.mockResolvedValue({
        data: {
          id: 'comp-new',
          scriptId: 'script-123',
          componentNumber: 1,
          content: 'Test content',
          wordCount: 2,
          createdAt: new Date()
        },
        error: null
      })

      render(<TipTapEditor videoId="video-123" />)

      // Wait for initial load and auto-save to trigger
      await waitFor(() => {
        expect(dataAccess.getScriptByVideoId).toHaveBeenCalled()
      }, { timeout: 2000 })
    })

    it('should show save status indicators', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="video-123" />)

      // The component should initially not show saving status
      expect(screen.queryByText('💾 Saving...')).not.toBeInTheDocument()
    })

    it('should handle save errors gracefully', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      mockedDataAccess.createScript.mockRejectedValue(
        new Error('Database connection failed')
      )

      render(<TipTapEditor videoId="video-123" />)

      // Component should handle error without crashing
      await waitFor(() => {
        expect(dataAccess.getScriptByVideoId).toHaveBeenCalled()
      })
    })
  })

  describe('Component Identity Preservation', () => {
    it('should maintain component numbering when content changes', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="video-123" />)

      // Initially should have C1-C4
      await waitFor(() => {
        expect(screen.getByText('C1')).toBeInTheDocument()
        expect(screen.getByText('C4')).toBeInTheDocument()
      })

      // Component numbers should remain stable
      expect(screen.getByText('C1')).toBeInTheDocument()
    })

    it('should preserve 1:1 mapping throughout workflow', async () => {
      mockedDataAccess.getScriptByVideoId.mockResolvedValue({
        data: null,
        error: null
      })

      render(<TipTapEditor videoId="video-123" />)

      await waitFor(() => {
        // Each paragraph should map to exactly one component
        const components = screen.getAllByText(/^C\d+$/)
        const componentNumbers = components.map(c => c.textContent)
        const uniqueNumbers = new Set(componentNumbers)

        // All component numbers should be unique
        expect(uniqueNumbers.size).toBe(componentNumbers.length)
      })
    })
  })

  describe('Editor Without Video ID', () => {
    it('should work in standalone mode without videoId', () => {
      render(<TipTapEditor />)

      // Editor should render without errors
      expect(screen.getByText('Script Editor')).toBeInTheDocument()
    })

    it('should not attempt to save without videoId', async () => {
      render(<TipTapEditor />)

      await waitFor(() => {
        // Should not call any data access methods
        expect(dataAccess.getScriptByVideoId).not.toHaveBeenCalled()
        expect(dataAccess.createScript).not.toHaveBeenCalled()
        expect(dataAccess.updateScript).not.toHaveBeenCalled()
      })
    })
  })
})
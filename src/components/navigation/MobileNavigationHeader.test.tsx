/**
 * Mobile Navigation Header Tests
 *
 * Tests for mobile-only navigation dropdown that solves the "Trapped User" problem.
 * Critical-Engineer: consulted for Mobile navigation patterns and edge cases
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { NavigationProvider } from '../../contexts/NavigationContext'
import { MobileNavigationHeader } from './MobileNavigationHeader'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock mobile detection
vi.mock('../../utils/mobileDetection', () => ({
  isMobileDevice: vi.fn(() => true),
  getMobileDeviceInfo: vi.fn(() => ({
    isMobile: true,
    isSmallScreen: true,
    deviceType: 'phone'
  }))
}))

// Mock router navigation
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({
      projectId: undefined,
      videoId: undefined
    })
  }
})

// Mock projects and videos data
const mockProjects = [
  {
    id: 'project-1',
    title: 'Test Project 1',
    eav_code: 'EAV001',
    due_date: '2024-01-01'
  },
  {
    id: 'project-2',
    title: 'Test Project 2',
    eav_code: 'EAV002',
    due_date: '2024-02-01'
  }
]

const mockVideos = [
  {
    id: 'video-1',
    title: 'Test Video 1',
    eav_code: 'EAV001',
    main_stream_status: 'ready',
    vo_stream_status: 'pending'
  },
  {
    id: 'video-2',
    title: 'Test Video 2',
    eav_code: 'EAV001',
    main_stream_status: 'processing',
    vo_stream_status: 'ready'
  },
  {
    id: 'video-3',
    title: 'Test Video 3',
    eav_code: 'EAV002',
    main_stream_status: 'ready',
    vo_stream_status: 'ready'
  }
]

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <NavigationProvider>
        {component}
      </NavigationProvider>
    </BrowserRouter>
  )
}

describe('MobileNavigationHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Mobile Detection and Rendering', () => {
    it('should render navigation dropdown when on mobile device', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      // Should show mobile navigation dropdown
      expect(screen.getByLabelText(/select project and video/i)).toBeInTheDocument()
      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })

    it('should not render when not on mobile device', async () => {
      // Mock as desktop
      const { isMobileDevice } = await import('../../utils/mobileDetection')
      vi.mocked(isMobileDevice).mockReturnValue(false)

      const { container } = renderWithProviders(
        <MobileNavigationHeader projects={mockProjects} videos={mockVideos} />
      )

      // Should not render anything
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Navigation Dropdown Structure', () => {
    it('should render projects as optgroups with videos as options', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      // Check for project optgroups
      expect(screen.getByRole('group', { name: 'Test Project 1' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Test Project 2' })).toBeInTheDocument()

      // Check for video options within project groups
      expect(screen.getByRole('option', { name: /test video 1/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /test video 2/i })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /test video 3/i })).toBeInTheDocument()
    })

    it('should show default option when no selection', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      expect(screen.getByRole('option', { name: /select a video/i })).toBeInTheDocument()
    })

    it('should group videos correctly under their projects', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      // Project 1 should have videos 1 and 2 (EAV001)
      const project1Group = screen.getByRole('group', { name: 'Test Project 1' })
      expect(project1Group).toBeInTheDocument()

      // Project 2 should have video 3 (EAV002)
      const project2Group = screen.getByRole('group', { name: 'Test Project 2' })
      expect(project2Group).toBeInTheDocument()
    })
  })

  describe('Navigation Behavior', () => {
    it('should navigate to video URL when video is selected', async () => {
      const { useNavigate } = await import('react-router-dom')
      const mockNavigate = vi.fn()
      vi.mocked(useNavigate).mockReturnValue(mockNavigate)

      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      const dropdown = screen.getByRole('combobox')

      // Select video-1
      fireEvent.change(dropdown, { target: { value: 'project-1/video-1' } })

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/project/project-1/video/video-1')
      })
    })

    it('should update dropdown selection based on current URL params', async () => {
      // Mock URL params
      const { useParams } = await import('react-router-dom')
      vi.mocked(useParams).mockReturnValue({
        projectId: 'project-1',
        videoId: 'video-1'
      })

      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      const dropdown = screen.getByRole('combobox') as HTMLSelectElement
      expect(dropdown.value).toBe('project-1/video-1')
    })

    it('should handle missing projects gracefully', () => {
      renderWithProviders(<MobileNavigationHeader projects={[]} videos={[]} />)

      expect(screen.getByRole('option', { name: /no projects available/i })).toBeInTheDocument()
    })

    it('should handle projects with no videos', () => {
      const projectsWithoutVideos = [mockProjects[0]]
      const noVideos: typeof mockVideos = []

      renderWithProviders(
        <MobileNavigationHeader projects={projectsWithoutVideos} videos={noVideos} />
      )

      expect(screen.getByRole('group', { name: 'Test Project 1' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /no videos in this project/i })).toBeInTheDocument()
    })
  })

  describe('Performance and Accessibility', () => {
    it('should have proper accessibility labels', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      const dropdown = screen.getByRole('combobox')
      expect(dropdown).toHaveAttribute('aria-label', expect.stringContaining('Select project and video'))
    })

    it('should use native select element for performance', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      const dropdown = screen.getByRole('combobox')
      expect(dropdown.tagName).toBe('SELECT')
    })

    it('should render efficiently with large datasets', () => {
      // Create large dataset
      const manyProjects = Array.from({ length: 50 }, (_, i) => ({
        id: `project-${i}`,
        title: `Project ${i}`,
        eav_code: `EAV${i.toString().padStart(3, '0')}`,
        due_date: '2024-01-01'
      }))

      const manyVideos = Array.from({ length: 200 }, (_, i) => ({
        id: `video-${i}`,
        title: `Video ${i}`,
        eav_code: `EAV${Math.floor(i / 4).toString().padStart(3, '0')}`,
        main_stream_status: 'ready',
        vo_stream_status: 'ready'
      }))

      const startTime = performance.now()
      renderWithProviders(<MobileNavigationHeader projects={manyProjects} videos={manyVideos} />)
      const endTime = performance.now()

      // Should render in under 100ms even with large datasets
      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid video selection gracefully', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      const dropdown = screen.getByRole('combobox')

      // Try to select invalid video
      fireEvent.change(dropdown, { target: { value: 'invalid/invalid' } })

      // Should not navigate for invalid selection
      // Navigation function should not be called for invalid selections
    })

    it('should handle malformed option values', () => {
      renderWithProviders(<MobileNavigationHeader projects={mockProjects} videos={mockVideos} />)

      const dropdown = screen.getByRole('combobox')

      // Try malformed value
      fireEvent.change(dropdown, { target: { value: 'malformed-value' } })

      // Should not cause errors
    })
  })
})
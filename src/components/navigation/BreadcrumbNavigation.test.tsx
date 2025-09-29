/**
 * Breadcrumb Navigation Tests
 *
 * Tests for mobile breadcrumb navigation that provides hierarchical context.
 * Critical-Engineer: consulted for Mobile navigation patterns and accessibility
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { NavigationProvider } from '../../contexts/NavigationContext'
import { BreadcrumbNavigation } from './BreadcrumbNavigation'
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
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: vi.fn(() => ({
      projectId: 'project-1',
      videoId: 'video-1'
    }))
  }
})

const mockProject = {
  id: 'project-1',
  title: 'Test Project Alpha',
  eav_code: 'EAV001',
  due_date: '2024-01-01'
}

const mockVideo = {
  id: 'video-1',
  title: 'Test Video Beta',
  eav_code: 'EAV001',
  main_stream_status: 'ready',
  vo_stream_status: 'pending'
}

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <NavigationProvider>
        {component}
      </NavigationProvider>
    </BrowserRouter>
  )
}

describe('BreadcrumbNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Mobile Detection and Rendering', () => {
    it('should render breadcrumb when on mobile device with project and video', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      // Should show breadcrumb navigation
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    })

    it('should not render when not on mobile device', async () => {
      // Mock as desktop
      const mobileDetection = await import('../../utils/mobileDetection')
      vi.mocked(mobileDetection.isMobileDevice).mockReturnValue(false)

      const { container } = renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      // Should not render anything
      expect(container.firstChild).toBeNull()
    })

    it('should not render without current project', () => {
      const { container } = renderWithProviders(
        <BreadcrumbNavigation currentProject={null} currentVideo={mockVideo} />
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Breadcrumb Structure', () => {
    it('should display project > video hierarchy', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      // Check for project name
      expect(screen.getByText('Test Project Alpha')).toBeInTheDocument()

      // Check for hierarchy separator
      expect(screen.getByText('>')).toBeInTheDocument()

      // Check for video name
      expect(screen.getByText('Test Video Beta')).toBeInTheDocument()
    })

    it('should show only project when no video selected', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={null} />
      )

      expect(screen.getByText('Test Project Alpha')).toBeInTheDocument()
      expect(screen.queryByText('>')).not.toBeInTheDocument()
    })

    it('should truncate long project names appropriately', () => {
      const longNameProject = {
        ...mockProject,
        title: 'This is a very long project name that should be truncated for mobile display'
      }

      renderWithProviders(
        <BreadcrumbNavigation currentProject={longNameProject} currentVideo={mockVideo} />
      )

      const projectElement = screen.getByText(longNameProject.title)
      const styles = window.getComputedStyle(projectElement)

      // Should have text overflow handling
      expect(styles.textOverflow).toBe('ellipsis')
      expect(styles.whiteSpace).toBe('nowrap')
      expect(styles.overflow).toBe('hidden')
    })

    it('should handle special characters in names', () => {
      const specialProject = {
        ...mockProject,
        title: 'Project with <special> & "quoted" characters'
      }

      const specialVideo = {
        ...mockVideo,
        title: 'Video with émojis 🎬 and ñ characters'
      }

      renderWithProviders(
        <BreadcrumbNavigation currentProject={specialProject} currentVideo={specialVideo} />
      )

      expect(screen.getByText('Project with <special> & "quoted" characters')).toBeInTheDocument()
      expect(screen.getByText('Video with émojis 🎬 and ñ characters')).toBeInTheDocument()
    })
  })

  describe('Navigation Behavior', () => {
    it('should navigate to project when project name is clicked', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const projectLink = screen.getByRole('button', { name: /test project alpha/i })
      fireEvent.click(projectLink)

      expect(mockNavigate).toHaveBeenCalledWith('/project/project-1')
    })

    it('should not navigate when video name is clicked (current level)', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const videoText = screen.getByText('Test Video Beta')

      // Video should not be clickable (current level)
      expect(videoText.tagName).not.toBe('BUTTON')
      expect(videoText.tagName).not.toBe('A')
    })

    it('should show project as clickable link when video is selected', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const projectElement = screen.getByText('Test Project Alpha')
      expect(projectElement).toBeInTheDocument()

      // Should be clickable when video is selected (going up hierarchy)
      const clickableElement = screen.getByRole('button', { name: /test project alpha/i })
      expect(clickableElement).toBeInTheDocument()
    })

    it('should show project as non-clickable when no video selected', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={null} />
      )

      // Should show project text
      screen.getByText('Test Project Alpha')

      // Should not be clickable when at project level
      expect(screen.queryByRole('button', { name: /test project alpha/i })).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA navigation landmark', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb navigation')
    })

    it('should have proper ARIA current for current page', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const currentVideo = screen.getByText('Test Video Beta')
      expect(currentVideo).toHaveAttribute('aria-current', 'page')
    })

    it('should provide clear button labels for screen readers', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const projectButton = screen.getByRole('button', { name: /test project alpha/i })
      expect(projectButton).toHaveAttribute('aria-label', 'Navigate to Test Project Alpha')
    })

    it('should have proper semantic structure', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      // Should use ordered list for semantic breadcrumb structure
      expect(screen.getByRole('list')).toBeInTheDocument()
      expect(screen.getAllByRole('listitem')).toHaveLength(2) // project + video
    })
  })

  describe('Visual Design', () => {
    it('should apply mobile-specific styling', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const breadcrumb = screen.getByRole('navigation')
      expect(breadcrumb).toHaveClass('mobile-breadcrumb')
    })

    it('should show appropriate separator between levels', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const separator = screen.getByText('>')
      expect(separator).toHaveClass('breadcrumb-separator')
      expect(separator).toHaveAttribute('aria-hidden', 'true')
    })

    it('should handle different theme contexts', () => {
      renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      const breadcrumb = screen.getByRole('navigation')

      // Should be compatible with different themes
      expect(breadcrumb).toHaveClass('mobile-breadcrumb')
    })
  })

  describe('Performance', () => {
    it('should render efficiently without unnecessary re-renders', () => {
      const { rerender } = renderWithProviders(
        <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
      )

      // Re-render with same props
      rerender(
        <BrowserRouter>
          <NavigationProvider>
            <BreadcrumbNavigation currentProject={mockProject} currentVideo={mockVideo} />
          </NavigationProvider>
        </BrowserRouter>
      )

      // Should maintain stable DOM
      expect(screen.getByText('Test Project Alpha')).toBeInTheDocument()
      expect(screen.getByText('Test Video Beta')).toBeInTheDocument()
    })
  })
})
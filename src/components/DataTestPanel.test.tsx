import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DataTestPanel } from './DataTestPanel'
import { dataAccess } from '../services/data-access'

// Mock the data access service
vi.mock('../services/data-access', () => ({
  dataAccess: {
    listProjects: vi.fn(),
    listVideosForProject: vi.fn()
  }
}))

describe('DataTestPanel', () => {
  it('should render the test panel', () => {
    (dataAccess.listProjects as any).mockResolvedValue({
      data: [],
      error: null
    })

    render(<DataTestPanel />)
    expect(screen.getByText(/Data Access Layer Test/i)).toBeInTheDocument()
  })

  it('should display projects from database', async () => {
    (dataAccess.listProjects as any).mockResolvedValue({
      data: [
        {
          id: 'test-id',
          eavCode: 'EAV011',
          title: 'EAV011 - Test Project',
          dueDate: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      error: null
    })

    render(<DataTestPanel />)

    await waitFor(() => {
      expect(screen.getByText('EAV011 - Test Project')).toBeInTheDocument()
    })
  })

  it('should display videos when project is selected', async () => {
    (dataAccess.listProjects as any).mockResolvedValue({
      data: [{
        id: 'test-id',
        eavCode: 'EAV011',
        title: 'EAV011 - Test Project',
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }],
      error: null
    })

    ;(dataAccess.listVideosForProject as any).mockResolvedValue({
      data: [
        {
          id: 'video-1',
          projectId: 'test-id',
          title: '0-Introduction',
          mainStreamStatus: 'draft',
          voStreamStatus: null,
          productionType: 'new',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      error: null
    })

    render(<DataTestPanel />)

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('EAV011 - Test Project')).toBeInTheDocument()
    })
  })

  it('should handle errors gracefully', async () => {
    (dataAccess.listProjects as any).mockResolvedValue({
      data: null,
      error: new Error('Database error')
    })

    render(<DataTestPanel />)

    await waitFor(() => {
      expect(screen.getByText(/Error loading projects/i)).toBeInTheDocument()
    })
  })
})
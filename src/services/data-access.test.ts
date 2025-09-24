import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataAccessService } from './data-access'
import type { Project, Video } from '../types/data'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis()
    }))
  }
}))

describe('DataAccessService', () => {
  let service: DataAccessService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DataAccessService()
  })

  describe('Projects', () => {
    it('should fetch all projects for a user', async () => {
      const { supabase } = require('../lib/supabase')
      const mockProjects = [
        {
          id: '68aa9add9bedb640d0a3bc0c',
          eav_code: 'EAV002',
          title: 'EAV002 - Berkeley Homes',
          due_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      supabase.from().select().mockResolvedValue({
        data: mockProjects,
        error: null
      })

      const result = await service.listProjects()

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].title).toBe('EAV002 - Berkeley Homes')
      expect(supabase.from).toHaveBeenCalledWith('projects')
    })

    it('should handle project fetch errors', async () => {
      const { supabase } = require('../lib/supabase')
      supabase.from().select().mockResolvedValue({
        data: null,
        error: new Error('Database error')
      })

      const result = await service.listProjects()

      expect(result.error).toBeDefined()
      expect(result.data).toBeNull()
    })

    it('should upsert a project', async () => {
      const { supabase } = require('../lib/supabase')
      const project: Project = {
        id: 'test-id',
        eavCode: 'TEST01',
        title: 'Test Project',
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      supabase.from().upsert().select().single().mockResolvedValue({
        data: {
          id: 'test-id',
          eav_code: 'TEST01',
          title: 'Test Project',
          due_date: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        error: null
      })

      const result = await service.upsertProject(project)

      expect(result.error).toBeNull()
      expect(result.data?.id).toBe('test-id')
      expect(supabase.from).toHaveBeenCalledWith('projects')
    })
  })

  describe('Videos', () => {
    it('should fetch videos for a project', async () => {
      const { supabase } = require('../lib/supabase')
      const mockVideos = [
        {
          id: 'video-1',
          project_id: 'project-1',
          title: '0-Introduction',
          main_stream_status: 'draft',
          vo_stream_status: null,
          production_type: 'new',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ]

      supabase.from().select().eq().order().mockResolvedValue({
        data: mockVideos,
        error: null
      })

      const result = await service.listVideosForProject('project-1')

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
      expect(result.data?.[0].title).toBe('0-Introduction')
    })

    it('should upsert multiple videos', async () => {
      const { supabase } = require('../lib/supabase')
      const videos: Video[] = [
        {
          id: 'video-1',
          projectId: 'project-1',
          title: '0-Introduction',
          mainStreamStatus: 'draft',
          voStreamStatus: null,
          productionType: 'new',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]

      supabase.from().upsert().select().mockResolvedValue({
        data: [{
          id: 'video-1',
          project_id: 'project-1',
          title: '0-Introduction',
          main_stream_status: 'draft',
          vo_stream_status: null,
          production_type: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        error: null
      })

      const result = await service.upsertVideos(videos)

      expect(result.error).toBeNull()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('Scripts', () => {
    it('should get or create a script for a video', async () => {
      const { supabase } = require('../lib/supabase')

      // First call - check if exists
      supabase.from().select().eq().single().mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // Not found
      })

      // Second call - create new
      supabase.from().insert().select().single().mockResolvedValueOnce({
        data: {
          id: 'new-script-id',
          video_id: 'video-1',
          yjs_state: null,
          plain_text: '',
          component_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        error: null
      })

      const result = await service.getOrCreateScript('video-1')

      expect(result.error).toBeNull()
      expect(result.data?.id).toBe('new-script-id')
      expect(result.data?.videoId).toBe('video-1')
    })

    it('should update script content', async () => {
      const { supabase } = require('../lib/supabase')

      supabase.from().update().eq().select().single().mockResolvedValue({
        data: {
          id: 'script-1',
          video_id: 'video-1',
          plain_text: 'Updated content',
          component_count: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        error: null
      })

      const result = await service.updateScript('script-1', {
        plainText: 'Updated content',
        componentCount: 3
      })

      expect(result.error).toBeNull()
      expect(result.data?.plainText).toBe('Updated content')
      expect(result.data?.componentCount).toBe(3)
    })
  })
})
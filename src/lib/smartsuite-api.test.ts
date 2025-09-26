/**
 * SmartSuite API Integration Tests
 *
 * Technical Architect: Following TRACED methodology
 * Test-first development for Phase 1 SmartSuite integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SmartSuiteAPI } from './smartsuite-api';
import type { Tables } from '../types/database.types';

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SMARTSUITE_API_KEY: 'test-api-key',
    VITE_SMARTSUITE_WORKSPACE_ID: 's3qnmox1',
    VITE_SMARTSUITE_PROJECTS_TABLE: '68a8ff5237fde0bf797c05b3',
    VITE_SMARTSUITE_VIDEOS_TABLE: '68b2437a8f1755b055e0a124'
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('SmartSuiteAPI', () => {
  let api: SmartSuiteAPI;

  beforeEach(() => {
    api = new SmartSuiteAPI();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('testConnection', () => {
    it('should return success when API is accessible', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await api.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected to SmartSuite workspace');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.smartsuite.com/api/v1/applications/68a8ff5237fde0bf797c05b3',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Token test-api-key',
            'Account-Id': 's3qnmox1'
          })
        })
      );
    });

    it('should return failure when API is not accessible', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await api.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('401 Unauthorized');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await api.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
    });
  });

  describe('fetchProjects', () => {
    it('should fetch and map projects correctly', async () => {
      const mockProjects = {
        items: [
          {
            id: 'proj123456789012345678901',
            title: 'Test Project',
            eav_code: 'EAV001',
            client_filter: 'client-a',
            due_date: '2025-12-31',
            created_at: '2025-01-01',
            updated_at: '2025-01-15'
          },
          {
            id: 'proj223456789012345678901',
            title: 'Another Project',
            eav_code: 'EAV002',
            client_filter: 'client-b',
            due_date: null,
            created_at: '2025-01-02',
            updated_at: '2025-01-16'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects
      });

      const projects = await api.fetchProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0]).toMatchObject({
        id: 'proj123456789012345678901',
        title: 'Test Project',
        eav_code: 'EAV001',
        client_filter: 'client-a'
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.smartsuite.com/api/v1/applications/68a8ff5237fde0bf797c05b3/records/list/',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sort: [{ field_id: 'title', direction: 'asc' }]
          })
        })
      );
    });

    it('should return empty array on fetch error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error'
      });

      const projects = await api.fetchProjects();

      expect(projects).toEqual([]);
    });

    it('should handle missing fields gracefully', async () => {
      const mockProjects = {
        items: [
          {
            id: 'proj123456789012345678901',
            // Missing most fields
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects
      });

      const projects = await api.fetchProjects();

      expect(projects).toHaveLength(1);
      expect(projects[0]).toMatchObject({
        id: 'proj123456789012345678901',
        title: '',
        eav_code: '',
        client_filter: null
      });
    });
  });

  describe('fetchVideosForProject', () => {
    const projectId = 'proj123456789012345678901';

    it('should fetch videos for a specific project', async () => {
      const mockVideos = {
        items: [
          {
            id: 'vid1234567890123456789012',
            title: 'Video 1',
            production_type: 'interview',
            main_stream_status: 'editing',
            vo_stream_status: 'pending'
          },
          {
            id: 'vid2234567890123456789012',
            title: 'Video 2',
            production_type: 'documentary',
            main_stream_status: 'complete',
            vo_stream_status: 'complete'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockVideos
      });

      const videos = await api.fetchVideosForProject(projectId);

      expect(videos).toHaveLength(2);
      expect(videos[0]).toMatchObject({
        id: 'vid1234567890123456789012',
        title: 'Video 1',
        project_id: projectId,
        production_type: 'interview'
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.smartsuite.com/api/v1/applications/68b2437a8f1755b055e0a124/records/list/',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            filter: {
              field_id: 'project_id',
              operator: 'is',
              value: projectId
            },
            sort: [{ field_id: 'title', direction: 'asc' }]
          })
        })
      );
    });

    it('should return empty array on error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API Error'));

      const videos = await api.fetchVideosForProject(projectId);

      expect(videos).toEqual([]);
    });
  });

  describe('syncComponentsToSmartSuite', () => {
    const videoId = 'vid1234567890123456789012';
    const mockComponents: Tables<'script_components'>[] = [
      {
        id: 'comp1',
        component_number: 1,
        content: 'First component',
        word_count: 2,
        script_id: 'script1',
        created_at: null
      },
      {
        id: 'comp2',
        component_number: 2,
        content: 'Second component',
        word_count: 2,
        script_id: 'script1',
        created_at: null
      }
    ];

    it('should successfully sync components to SmartSuite', async () => {
      // Mock video fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: videoId })
      });

      // Mock update
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      });

      const result = await api.syncComponentsToSmartSuite(videoId, mockComponents);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Synced 2 components to SmartSuite');

      // Verify the update call
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(2,
        `https://api.smartsuite.com/api/v1/applications/68b2437a8f1755b055e0a124/records/${videoId}/`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            script_components: [
              {
                component_id: 'C1',
                component_number: 1,
                content: 'First component',
                word_count: 2
              },
              {
                component_id: 'C2',
                component_number: 2,
                content: 'Second component',
                word_count: 2
              }
            ]
          })
        })
      );
    });

    it('should handle video not found error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      const result = await api.syncComponentsToSmartSuite(videoId, mockComponents);

      expect(result.success).toBe(false);
      expect(result.message).toContain(`Video ${videoId} not found`);
    });

    it('should handle sync failure', async () => {
      // Mock video fetch success
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: videoId })
      });

      // Mock update failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request'
      });

      const result = await api.syncComponentsToSmartSuite(videoId, mockComponents);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Sync failed: Bad Request');
    });
  });

  describe('getSyncStatus', () => {
    const videoId = 'vid1234567890123456789012';

    it('should return sync status for a video', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: videoId,
          script_components: [
            { component_id: 'C1', content: 'Component 1' },
            { component_id: 'C2', content: 'Component 2' }
          ],
          last_component_sync: '2025-01-01T12:00:00Z'
        })
      });

      const status = await api.getSyncStatus(videoId);

      expect(status).toMatchObject({
        synced: true,
        lastSync: '2025-01-01T12:00:00Z',
        componentCount: 2
      });
    });

    it('should return unsynced status when video not found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      });

      const status = await api.getSyncStatus(videoId);

      expect(status).toMatchObject({
        synced: false,
        lastSync: null,
        componentCount: 0
      });
    });

    it('should handle missing component data', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: videoId,
          // No script_components field
        })
      });

      const status = await api.getSyncStatus(videoId);

      expect(status).toMatchObject({
        synced: false,
        lastSync: null,
        componentCount: 0
      });
    });
  });

  describe('Rate Limiting and Error Handling', () => {
    it('should handle rate limit errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      const result = await api.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('429');
    });

    it('should handle malformed JSON responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const projects = await api.fetchProjects();

      expect(projects).toEqual([]);
    });
  });
});
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
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => [{ name: 'Test Solution', id: 'solution123' }]
      });

      const result = await api.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected to SmartSuite workspace - Found 1 solutions');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/smartsuite/api/v1/solutions/', // CORRECTED: use proxy URL for testConnection
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should return failure when API is not accessible', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => 'Unauthorized access'
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
            eavcode: 'EAV001', // CORRECTED: use "eavcode" field
            client_filter: 'client-a',
            projdue456: { date: '2025-12-31' }, // CORRECTED: use "projdue456" object field
            first_created: { date: '2025-01-01' }, // CORRECTED: use "first_created" object field
            last_updated: { date: '2025-01-15' } // CORRECTED: use "last_updated" object field
          },
          {
            id: 'proj223456789012345678901',
            title: 'Another Project',
            eavcode: 'EAV002', // CORRECTED: use "eavcode" field
            client_filter: 'client-b',
            projdue456: null, // CORRECTED: use "projdue456" field
            first_created: { date: '2025-01-02' }, // CORRECTED: use "first_created" object field
            last_updated: { date: '2025-01-16' } // CORRECTED: use "last_updated" object field
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
        '/api/smartsuite/api/v1/applications/68a8ff5237fde0bf797c05b3/records/list/',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sort: [{ field: 'title', direction: 'asc' }]
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
            prodtype01: 'interview', // CORRECTED: use "prodtype01" field
            main_status: { value: 'editing' }, // CORRECTED: use "main_status" object field
            vo_status: { value: 'pending' }, // CORRECTED: use "vo_status" object field
            first_created: { date: '2025-01-01' },
            last_updated: { date: '2025-01-01' }
          },
          {
            id: 'vid2234567890123456789012',
            title: 'Video 2',
            prodtype01: 'documentary', // CORRECTED: use "prodtype01" field
            main_status: { value: 'complete' }, // CORRECTED: use "main_status" object field
            vo_status: { value: 'complete' }, // CORRECTED: use "vo_status" object field
            first_created: { date: '2025-01-01' },
            last_updated: { date: '2025-01-01' }
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
        '/api/smartsuite/api/v1/applications/68b2437a8f1755b055e0a124/records/list/',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            filter: {
              field_id: 'projects_link', // CORRECTED: use "projects_link" field
              operator: 'has_any_of', // CORRECTED: use "has_any_of" for array field
              value: [projectId]
            },
            sort: [{ field: 'title', direction: 'asc' }]
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
        `/api/smartsuite/api/v1/applications/68b2437a8f1755b055e0a124/records/${videoId}/`,
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
        statusText: 'Too Many Requests',
        headers: new Map([['content-type', 'application/json']]),
        text: async () => 'Rate limit exceeded'
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
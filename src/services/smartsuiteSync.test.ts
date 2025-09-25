/**
 * SmartSuite Sync Service Tests
 *
 * Tests for SmartSuite to Supabase synchronization functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartSuiteSync, FieldMapper } from './smartsuiteSync';

// Mock types for SmartSuite
interface SmartSuiteStatusValue {
  value: string;
  color?: string;
}

// Mock Supabase client type - simplified for testing
interface MockSupabaseClient {
  from: unknown;
}

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      select: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }))
  }
}));

describe('FieldMapper', () => {
  describe('extractStatusValue', () => {
    it('should extract value from status object', () => {
      const statusObj = { value: 'processing', color: '#ff0000' };
      expect(FieldMapper.extractStatusValue(statusObj)).toBe('processing');
    });

    it('should return string value as-is', () => {
      expect(FieldMapper.extractStatusValue('ready')).toBe('ready');
    });

    it('should return undefined for null or undefined', () => {
      expect(FieldMapper.extractStatusValue(null)).toBeUndefined();
      expect(FieldMapper.extractStatusValue(undefined)).toBeUndefined();
    });

    it('should return undefined for empty object', () => {
      expect(FieldMapper.extractStatusValue({} as SmartSuiteStatusValue)).toBeUndefined();
    });
  });

  describe('extractLinkedRecordId', () => {
    it('should extract first ID from array of linked records', () => {
      const linkedRecords = [
        { id: 'project-1', title: 'Project 1' },
        { id: 'project-2', title: 'Project 2' }
      ];
      expect(FieldMapper.extractLinkedRecordId(linkedRecords)).toBe('project-1');
    });

    it('should extract ID from single linked record object', () => {
      const linkedRecord = { id: 'project-1', title: 'Project 1' };
      expect(FieldMapper.extractLinkedRecordId(linkedRecord)).toBe('project-1');
    });

    it('should return undefined for null or undefined', () => {
      expect(FieldMapper.extractLinkedRecordId(null)).toBeUndefined();
      expect(FieldMapper.extractLinkedRecordId(undefined)).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      expect(FieldMapper.extractLinkedRecordId([])).toBeUndefined();
    });
  });

  describe('formatDate', () => {
    it('should format valid date to YYYY-MM-DD', () => {
      expect(FieldMapper.formatDate('2024-12-15T10:30:00Z')).toBe('2024-12-15');
      expect(FieldMapper.formatDate('2024-01-01')).toBe('2024-01-01');
    });

    it('should return undefined for invalid dates', () => {
      expect(FieldMapper.formatDate('invalid-date')).toBeUndefined();
      expect(FieldMapper.formatDate('')).toBeUndefined();
      expect(FieldMapper.formatDate(null)).toBeUndefined();
    });
  });

  describe('buildProjectTitle', () => {
    it('should combine title with EAV code when provided', () => {
      expect(FieldMapper.buildProjectTitle('My Project', 'EAV123')).toBe('My Project (EAV123)');
    });

    it('should return title only when EAV code is empty', () => {
      expect(FieldMapper.buildProjectTitle('My Project', '')).toBe('My Project');
      expect(FieldMapper.buildProjectTitle('My Project', undefined)).toBe('My Project');
    });

    it('should trim whitespace from EAV code', () => {
      expect(FieldMapper.buildProjectTitle('My Project', '  EAV123  ')).toBe('My Project (EAV123)');
    });
  });

  describe('filterProductionType', () => {
    it('should return undefined for "reuse" production type', () => {
      expect(FieldMapper.filterProductionType('reuse')).toBeUndefined();
      expect(FieldMapper.filterProductionType('REUSE')).toBeUndefined();
      expect(FieldMapper.filterProductionType('Reuse')).toBeUndefined();
    });

    it('should return other production types unchanged', () => {
      expect(FieldMapper.filterProductionType('new')).toBe('new');
      expect(FieldMapper.filterProductionType('amend')).toBe('amend');
    });

    it('should return undefined for null or undefined', () => {
      expect(FieldMapper.filterProductionType(null)).toBeUndefined();
      expect(FieldMapper.filterProductionType(undefined)).toBeUndefined();
    });
  });
});

describe('SmartSuiteSync', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock to default successful behavior
    const { supabase } = await import('../lib/supabase');
    const mockUpsert = vi.fn(() => Promise.resolve({ error: null }));
    const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
    (supabase as MockSupabaseClient).from = mockFrom;
  });

  describe('mapProjectRecord', () => {
    it('should map SmartSuite project record to local Project', () => {
      const smartsuiteRecord = {
        id: 'project-123',
        project_name_actual: 'Test Project',
        eavcode: 'EAV456',
        projdue456: '2024-12-31T23:59:59Z'
      };

      const result = SmartSuiteSync.mapProjectRecord(smartsuiteRecord);

      expect(result).toEqual({
        id: 'project-123',
        title: 'Test Project (EAV456)',
        due_date: '2024-12-31'
      });
    });

    it('should fallback to title field if project_name_actual is missing', () => {
      const smartsuiteRecord = {
        id: 'project-123',
        title: 'Fallback Title',
        eavcode: 'EAV456'
      };

      const result = SmartSuiteSync.mapProjectRecord(smartsuiteRecord);

      expect(result.title).toBe('Fallback Title (EAV456)');
    });

    it('should use default title if both names are missing', () => {
      const smartsuiteRecord = {
        id: 'project-123'
      };

      const result = SmartSuiteSync.mapProjectRecord(smartsuiteRecord);

      expect(result.title).toBe('Untitled Project');
    });
  });

  describe('mapVideoRecord', () => {
    it('should map SmartSuite video record to local Video', () => {
      const smartsuiteRecord = {
        id: 'video-123',
        video_name: 'Test Video',
        projects_link: [{ id: 'project-456', title: 'Parent Project' }],
        main_status: { value: 'processing', color: '#ff0000' },
        vo_status: { value: 'ready', color: '#00ff00' },
        prodtype01: 'new'
      };

      const result = SmartSuiteSync.mapVideoRecord(smartsuiteRecord);

      expect(result).toEqual({
        id: 'video-123',
        project_id: 'project-456',
        title: 'Test Video',
        main_stream_status: 'processing',
        vo_stream_status: 'ready',
        production_type: 'new'
      });
    });

    it('should return null if no project link exists', () => {
      const smartsuiteRecord = {
        id: 'video-123',
        video_name: 'Orphan Video'
      };

      const result = SmartSuiteSync.mapVideoRecord(smartsuiteRecord);

      expect(result).toBeNull();
    });

    it('should filter out "reuse" production type', () => {
      const smartsuiteRecord = {
        id: 'video-123',
        video_name: 'Test Video',
        projects_link: [{ id: 'project-456' }],
        prodtype01: 'reuse'
      };

      const result = SmartSuiteSync.mapVideoRecord(smartsuiteRecord);

      expect(result?.production_type).toBeUndefined();
    });
  });

  describe('upsertProjects', () => {
    it('should successfully upsert projects to Supabase', async () => {
      const { supabase } = await import('../lib/supabase');

      const projects = [
        { id: 'p1', title: 'Project 1', due_date: '2024-12-31' },
        { id: 'p2', title: 'Project 2' }
      ];

      const result = await SmartSuiteSync.upsertProjects(projects);

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('projects');
    });

    it('should handle upsert errors', async () => {
      const { supabase } = await import('../lib/supabase');
      const mockError = { message: 'Database error' };

      // Mock the chain for this specific test
      const mockUpsert = vi.fn(() => Promise.resolve({ error: mockError }));
      const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
      (supabase as MockSupabaseClient).from = mockFrom;

      const projects = [{ id: 'p1', title: 'Project 1' }];
      const result = await SmartSuiteSync.upsertProjects(projects);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('upsertVideos', () => {
    it('should successfully upsert videos to Supabase', async () => {
      const { supabase } = await import('../lib/supabase');

      const videos = [
        {
          id: 'v1',
          project_id: 'p1',
          title: 'Video 1',
          main_stream_status: 'ready'
        }
      ];

      const result = await SmartSuiteSync.upsertVideos(videos);

      expect(result.success).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('videos');
    });

    it('should handle upsert errors', async () => {
      const { supabase } = await import('../lib/supabase');
      const mockError = { message: 'Database error' };

      // Mock the chain for this specific test
      const mockUpsert = vi.fn(() => Promise.resolve({ error: mockError }));
      const mockFrom = vi.fn(() => ({ upsert: mockUpsert }));
      (supabase as MockSupabaseClient).from = mockFrom;

      const videos = [{ id: 'v1', project_id: 'p1', title: 'Video 1' }];
      const result = await SmartSuiteSync.upsertVideos(videos);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('sync methods (placeholders)', () => {
    it('should return error indicating MCP tool integration needed for project sync', async () => {
      const result = await SmartSuiteSync.syncAllProjects();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Sync method needs MCP tool integration - use from component context');
    });

    it('should return error indicating MCP tool integration needed for video sync', async () => {
      const result = await SmartSuiteSync.syncProjectVideos('project-123');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Sync method needs MCP tool integration - use from component context');
    });
  });
});
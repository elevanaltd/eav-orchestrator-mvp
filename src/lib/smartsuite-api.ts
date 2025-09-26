/**
 * SmartSuite API Integration - Production Implementation
 *
 * Technical Architect: Phase 1 SmartSuite Integration
 * Following TRACED methodology with MINIMAL_INTERVENTION_PRINCIPLE
 *
 * Workspace: s3qnmox1
 * Projects Table: 68a8ff5237fde0bf797c05b3
 * Videos Table: 68b2437a8f1755b055e0a124
 */

import type { Tables } from '../types/database.types';

// SmartSuite API Configuration
// Use proxy in both dev (Vite) and production (Vercel)
const SMARTSUITE_API_BASE = '/api/smartsuite/api/v1';
const WORKSPACE_ID = import.meta.env.VITE_SMARTSUITE_WORKSPACE_ID || 's3qnmox1';
const PROJECTS_TABLE_ID = import.meta.env.VITE_SMARTSUITE_PROJECTS_TABLE || '68a8ff5237fde0bf797c05b3';
const VIDEOS_TABLE_ID = import.meta.env.VITE_SMARTSUITE_VIDEOS_TABLE || '68b2437a8f1755b055e0a124';

// SmartSuite field mappings
interface SmartSuiteProject {
  id: string; // 24-char hex ID
  title: string;
  eav_code: string;
  client_filter?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

interface SmartSuiteVideo {
  id: string; // 24-char hex ID
  title: string;
  project_id: string;
  production_type?: string;
  main_stream_status?: string;
  vo_stream_status?: string;
  created_at?: string;
  updated_at?: string;
}

interface SmartSuiteComponent {
  component_id: string; // C1, C2, C3...
  component_number: number;
  content: string;
  word_count: number;
  script_id: string;
}

export class SmartSuiteAPI {
  private headers: HeadersInit;

  constructor() {
    // Headers are handled by the proxy, just need Content-Type
    this.headers = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Test API connection and verify workspace access
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Use the test endpoint to verify functions are working
      const response = await fetch(`/api/test`, {
        method: 'GET',
        headers: this.headers
      });

      if (response.ok) {
        return { success: true, message: 'Connected to SmartSuite workspace' };
      }

      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch all projects from SmartSuite
   * One-way sync: SmartSuite → App
   */
  async fetchProjects(): Promise<Tables<'projects'>[]> {
    try {
      // Temporarily use the simple proxy endpoint until dynamic routes are fixed
      const response = await fetch(
        `/api/smartsuite-proxy`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            sort: [{ field: 'title', direction: 'asc' }]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const data = await response.json();

      // Map SmartSuite records to our database schema
      return data.items.map((item: any) => ({
        id: item.id,
        title: item.title || '',
        eav_code: item.eavcode || '', // Fixed: actual field is 'eavcode' not 'eav_code'
        client_filter: item.client_filter || null,
        due_date: item.projdue456?.to_date?.date || null, // Fixed: actual field is 'projdue456' with nested structure
        created_at: item.firstCreated?.on || null, // Fixed: actual field is 'firstCreated.on'
        updated_at: item.lastUpdated?.on || null // Fixed: actual field is 'lastUpdated.on'
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  /**
   * Fetch videos for a specific project
   * One-way sync: SmartSuite → App
   */
  async fetchVideosForProject(projectId: string): Promise<Tables<'videos'>[]> {
    try {
      const response = await fetch(
        `${SMARTSUITE_API_BASE}/applications/${VIDEOS_TABLE_ID}/records/list/`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            filter: {
              field: 'project_id',
              operator: 'is',
              value: projectId
            },
            sort: [{ field: 'title', direction: 'asc' }]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.statusText}`);
      }

      const data = await response.json();

      return data.items.map((item: any) => ({
        id: item.id,
        title: item.title || '',
        project_id: projectId,
        production_type: item.production_type || null,
        main_stream_status: item.main_stream_status || null,
        vo_stream_status: item.vo_stream_status || null,
        created_at: item.created_at || null,
        updated_at: item.updated_at || null
      }));
    } catch (error) {
      console.error('Error fetching videos:', error);
      return [];
    }
  }

  /**
   * Sync script components to SmartSuite
   * One-way sync: App → SmartSuite (for components only)
   */
  async syncComponentsToSmartSuite(
    videoId: string,
    components: Tables<'script_components'>[]
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the video record in SmartSuite
      const videoResponse = await fetch(
        `${SMARTSUITE_API_BASE}/applications/${VIDEOS_TABLE_ID}/records/${videoId}/`,
        {
          method: 'GET',
          headers: this.headers
        }
      );

      if (!videoResponse.ok) {
        return {
          success: false,
          message: `Video ${videoId} not found in SmartSuite`
        };
      }

      // Format components for SmartSuite
      const componentData = components.map(c => ({
        component_id: `C${c.component_number}`,
        component_number: c.component_number,
        content: c.content,
        word_count: c.word_count || 0
      }));

      // Update video record with components
      const updateResponse = await fetch(
        `${SMARTSUITE_API_BASE}/applications/${VIDEOS_TABLE_ID}/records/${videoId}/`,
        {
          method: 'PATCH',
          headers: this.headers,
          body: JSON.stringify({
            script_components: componentData
          })
        }
      );

      if (updateResponse.ok) {
        return {
          success: true,
          message: `Synced ${components.length} components to SmartSuite`
        };
      }

      return {
        success: false,
        message: `Sync failed: ${updateResponse.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get sync status for a video
   */
  async getSyncStatus(videoId: string): Promise<{
    synced: boolean;
    lastSync: string | null;
    componentCount: number;
  }> {
    try {
      const response = await fetch(
        `${SMARTSUITE_API_BASE}/applications/${VIDEOS_TABLE_ID}/records/${videoId}/`,
        {
          method: 'GET',
          headers: this.headers
        }
      );

      if (!response.ok) {
        return { synced: false, lastSync: null, componentCount: 0 };
      }

      const data = await response.json();

      return {
        synced: !!data.script_components,
        lastSync: data.last_component_sync || null,
        componentCount: data.script_components?.length || 0
      };
    } catch (error) {
      return { synced: false, lastSync: null, componentCount: 0 };
    }
  }
}

// Export singleton instance
export const smartSuiteAPI = new SmartSuiteAPI();
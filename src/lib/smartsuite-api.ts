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
const SMARTSUITE_API_BASE = '/api/smartsuite/api/v1'; // Use Vite proxy
const WORKSPACE_ID = import.meta.env.VITE_SMARTSUITE_WORKSPACE_ID || 's3qnmox1';
const PROJECTS_TABLE_ID = import.meta.env.VITE_SMARTSUITE_PROJECTS_TABLE || '68a8ff5237fde0bf797c05b3';
const VIDEOS_TABLE_ID = import.meta.env.VITE_SMARTSUITE_VIDEOS_TABLE || '68b2437a8f1755b055e0a124';

// SmartSuite field mappings - VALIDATED from production data
interface SmartSuiteProject {
  id: string; // 24-char hex ID
  title: string; // "title" field
  eavcode: string; // "eavcode" field - EAV project code (e.g., "EAV002")
  client_filter?: string; // "client_filter" field - client identifier
  projdue456?: object; // "projdue456" field - due date object
  project_name_actual?: string; // "project_name_actual" field - clean project name
  project_manager?: any[]; // "project_manager" array field
  primary_contact?: any[]; // "primary_contact" array field
  project_lifecycle?: object; // "project_lifecycle" status object
  first_created?: object; // "first_created" timestamp object
  last_updated?: object; // "last_updated" timestamp object
}

interface SmartSuiteVideo {
  id: string; // 24-char hex ID
  title: string; // "title" field - full video title (e.g., "0-Introduction")
  video_name: string; // "video_name" field - clean video name (e.g., "Introduction")
  projects_link: any[]; // "projects_link" array - link to projects table
  main_status?: object; // "main_status" status object - main stream status
  vo_status?: object; // "vo_status" status object - VO stream status
  prodtype01?: string; // "prodtype01" field - production type (e.g., "new_prod")
  vidtype123?: string; // "vidtype123" field - video type (e.g., "bespoke_opt")
  video_seq01?: string; // "video_seq01" field - sequence number
  duedate123?: object; // "duedate123" field - video due date object
  eav_code?: any[]; // "eav_code" array - inherited from project
  project_client?: any[]; // "project_client" array - client info
  first_created?: object; // "first_created" timestamp object
  last_updated?: object; // "last_updated" timestamp object
}

interface SmartSuiteComponent {
  component_id: string; // C1, C2, C3...
  component_number: number;
  content: string;
  word_count: number;
  script_id: string;
}

export class SmartSuiteAPI {
  private apiKey: string;
  private headers: HeadersInit;

  constructor() {
    this.apiKey = import.meta.env.VITE_SMARTSUITE_API_KEY || '';
    // Headers are handled by Vite proxy, but keep this for fallback
    this.headers = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Extract date string from SmartSuite date object
   */
  private extractDateFromObject(dateObj: any): string | null {
    if (!dateObj || typeof dateObj !== 'object') return null;

    // SmartSuite date objects often have 'date' or 'value' properties
    if (dateObj.date) return dateObj.date;
    if (dateObj.value) return dateObj.value;
    if (dateObj.raw_value) return dateObj.raw_value;

    return null;
  }

  /**
   * Extract status string from SmartSuite status object
   */
  private extractStatusFromObject(statusObj: any): string | null {
    if (!statusObj || typeof statusObj !== 'object') return null;

    // SmartSuite status objects often have 'value', 'label', or 'display_value' properties
    if (statusObj.value) return statusObj.value;
    if (statusObj.label) return statusObj.label;
    if (statusObj.display_value) return statusObj.display_value;

    return null;
  }

  /**
   * Test API connection and verify workspace access
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test with simplest endpoint first - list solutions
      const response = await fetch(`${SMARTSUITE_API_BASE}/solutions/`, {
        method: 'GET',
        headers: this.headers
      });

      console.log('SmartSuite API Response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        const data = await response.json();
        console.log('SmartSuite Solutions:', data);
        return {
          success: true,
          message: `Connected to SmartSuite workspace - Found ${data.length} solutions`
        };
      }

      const errorText = await response.text();
      console.error('SmartSuite Error:', errorText);
      return {
        success: false,
        message: `Connection failed: ${response.status} ${response.statusText} - ${errorText}`
      };
    } catch (error) {
      console.error('SmartSuite API Error:', error);
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
      const response = await fetch(
        `${SMARTSUITE_API_BASE}/applications/${PROJECTS_TABLE_ID}/records/list/`,
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
      return data.items.map((item: SmartSuiteProject) => ({
        id: item.id,
        title: item.title || '',
        eav_code: item.eavcode || '', // CORRECTED: use "eavcode" field
        client_filter: item.client_filter || null,
        due_date: item.projdue456 ? this.extractDateFromObject(item.projdue456) : null, // CORRECTED: use "projdue456" field
        created_at: item.first_created ? this.extractDateFromObject(item.first_created) : null, // CORRECTED: use "first_created" field
        updated_at: item.last_updated ? this.extractDateFromObject(item.last_updated) : null // CORRECTED: use "last_updated" field
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
              field_id: 'projects_link', // CORRECTED: use "projects_link" field
              operator: 'has_any_of', // CORRECTED: use "has_any_of" for array field
              value: [projectId]
            },
            sort: [{ field: 'title', direction: 'asc' }]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch videos: ${response.statusText}`);
      }

      const data = await response.json();

      return data.items.map((item: SmartSuiteVideo) => ({
        id: item.id,
        title: item.title || '',
        project_id: projectId, // Keep this for our database relationship
        production_type: item.prodtype01 || null, // CORRECTED: use "prodtype01" field
        main_stream_status: item.main_status ? this.extractStatusFromObject(item.main_status) : null, // CORRECTED: use "main_status" field
        vo_stream_status: item.vo_status ? this.extractStatusFromObject(item.vo_status) : null, // CORRECTED: use "vo_status" field
        created_at: item.first_created ? this.extractDateFromObject(item.first_created) : null, // CORRECTED: use "first_created" field
        updated_at: item.last_updated ? this.extractDateFromObject(item.last_updated) : null // CORRECTED: use "last_updated" field
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
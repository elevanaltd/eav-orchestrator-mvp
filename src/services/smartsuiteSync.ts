/**
 * SmartSuite Sync Service
 *
 * Handles one-way synchronization from SmartSuite to Supabase
 * Maps SmartSuite field structures to local database schema
 */

import { supabase } from '../lib/supabase';

// Type definitions for SmartSuite data structures
interface SmartSuiteRecord {
  id: string;
  [key: string]: unknown;
}

interface SmartSuiteStatusValue {
  value: string;
  color?: string;
}

interface SmartSuiteLinkedRecord {
  id: string;
  title?: string;
}

// Local database interfaces (matching NavigationContext types)
interface Project {
  id: string;
  title: string;
  due_date?: string;
}

interface Video {
  id: string;
  project_id: string;
  title: string;
  main_stream_status?: string;
  vo_stream_status?: string;
  production_type?: string;
}

// Sync result interface
interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  errors: string[];
}

// SmartSuite field mapping utilities
export class FieldMapper {
  /**
   * Extract status value from SmartSuite status field
   */
  static extractStatusValue(statusField: SmartSuiteStatusValue | string | null | undefined): string | undefined {
    if (!statusField) return undefined;

    if (typeof statusField === 'string') {
      return statusField;
    }

    if (typeof statusField === 'object' && statusField.value) {
      return statusField.value;
    }

    return undefined;
  }

  /**
   * Extract first linked record ID from SmartSuite linked record field
   */
  static extractLinkedRecordId(linkedField: SmartSuiteLinkedRecord[] | SmartSuiteLinkedRecord | null | undefined): string | undefined {
    if (!linkedField) return undefined;

    if (Array.isArray(linkedField) && linkedField.length > 0) {
      return linkedField[0].id;
    }

    if (typeof linkedField === 'object' && !Array.isArray(linkedField) && linkedField.id) {
      return linkedField.id;
    }

    return undefined;
  }

  /**
   * Format date from SmartSuite to local format
   */
  static formatDate(dateValue: string | null | undefined): string | undefined {
    if (!dateValue) return undefined;

    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch {
      console.warn('SmartSuite Sync: Invalid date format:', dateValue);
      return undefined;
    }
  }

  /**
   * Combine project title with EAV code if available
   */
  static buildProjectTitle(title: string, eavCode?: string): string {
    if (eavCode && eavCode.trim()) {
      return `${title} (${eavCode.trim()})`;
    }
    return title;
  }

  /**
   * Filter out "reuse" production types as specified in requirements
   */
  static filterProductionType(prodType: string | null | undefined): string | undefined {
    if (!prodType) return undefined;

    const type = prodType.toLowerCase().trim();
    if (type === 'reuse') {
      return undefined; // Filter out reuse types
    }

    return prodType;
  }
}

/**
 * SmartSuite Sync Service
 *
 * Handles synchronization operations between SmartSuite and Supabase
 */
export class SmartSuiteSync {
  /**
   * Sync all projects from SmartSuite to Supabase
   * NOTE: This method requires MCP tool integration from component context
   */
  static async syncAllProjects(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      recordsProcessed: 0,
      recordsUpdated: 0,
      errors: []
    };

    try {
      console.log('SmartSuite Sync: Starting project sync...');

      // This will need to be called from component context with MCP tools
      // For now, we'll structure it as a placeholder that can be completed
      // when integrated with the NavigationSidebar

      result.success = false;
      result.errors.push('Sync method needs MCP tool integration - use from component context');
      return result;

    } catch (error) {
      console.error('SmartSuite Sync: Project sync failed:', error);
      result.errors.push(`Project sync failed: ${error}`);
      return result;
    }
  }

  /**
   * Sync videos for a specific project from SmartSuite to Supabase
   * NOTE: This method requires MCP tool integration from component context
   */
  static async syncProjectVideos(projectId: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      recordsProcessed: 0,
      recordsUpdated: 0,
      errors: []
    };

    try {
      console.log('SmartSuite Sync: Starting video sync for project:', projectId);

      // This will need to be called from component context with MCP tools
      // For now, we'll structure it as a placeholder that can be completed
      // when integrated with the NavigationSidebar

      result.success = false;
      result.errors.push('Sync method needs MCP tool integration - use from component context');
      return result;

    } catch (error) {
      console.error('SmartSuite Sync: Video sync failed:', error);
      result.errors.push(`Video sync failed: ${error}`);
      return result;
    }
  }

  /**
   * Map SmartSuite project record to local Project interface
   */
  static mapProjectRecord(record: SmartSuiteRecord): Project {
    const title = (record.project_name_actual as string) || (record.title as string) || 'Untitled Project';
    const eavCode = record.eavcode as string;
    const dueDate = FieldMapper.formatDate(record.projdue456 as string);

    return {
      id: record.id,
      title: FieldMapper.buildProjectTitle(title, eavCode),
      due_date: dueDate
    };
  }

  /**
   * Map SmartSuite video record to local Video interface
   */
  static mapVideoRecord(record: SmartSuiteRecord): Video | null {
    // Extract project ID from linked record
    const projectId = FieldMapper.extractLinkedRecordId(record.projects_link as SmartSuiteLinkedRecord[] | SmartSuiteLinkedRecord);
    if (!projectId) {
      console.warn('SmartSuite Sync: Video without project link, skipping:', record.id);
      return null;
    }

    // Extract status values
    const mainStatus = FieldMapper.extractStatusValue(record.main_status as SmartSuiteStatusValue);
    const voStatus = FieldMapper.extractStatusValue(record.vo_status as SmartSuiteStatusValue);

    // Filter production type
    const productionType = FieldMapper.filterProductionType(record.prodtype01 as string);

    const title = (record.video_name as string) || (record.title as string) || 'Untitled Video';

    return {
      id: record.id,
      project_id: projectId,
      title: title,
      main_stream_status: mainStatus,
      vo_stream_status: voStatus,
      production_type: productionType
    };
  }

  /**
   * Upsert projects to Supabase database
   */
  static async upsertProjects(projects: Project[]): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`SmartSuite Sync: Upserting ${projects.length} projects...`);

      const { error } = await supabase
        .from('projects')
        .upsert(projects, { onConflict: 'id' });

      if (error) {
        console.error('SmartSuite Sync: Project upsert failed:', error);
        return { success: false, error: error.message };
      }

      console.log(`SmartSuite Sync: Successfully upserted ${projects.length} projects`);
      return { success: true };

    } catch (err) {
      console.error('SmartSuite Sync: Project upsert exception:', err);
      return { success: false, error: `Upsert failed: ${err}` };
    }
  }

  /**
   * Upsert videos to Supabase database
   */
  static async upsertVideos(videos: Video[]): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`SmartSuite Sync: Upserting ${videos.length} videos...`);

      const { error } = await supabase
        .from('videos')
        .upsert(videos, { onConflict: 'id' });

      if (error) {
        console.error('SmartSuite Sync: Video upsert failed:', error);
        return { success: false, error: error.message };
      }

      console.log(`SmartSuite Sync: Successfully upserted ${videos.length} videos`);
      return { success: true };

    } catch (err) {
      console.error('SmartSuite Sync: Video upsert exception:', err);
      return { success: false, error: `Upsert failed: ${err}` };
    }
  }
}

// Export types for use in components
export type { Project, Video, SyncResult };
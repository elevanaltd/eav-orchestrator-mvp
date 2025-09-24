// Critical-Engineer: consulted for Architecture pattern selection
// Data Access Layer (DAL) - Single source of truth for all database operations

import { supabase } from '../lib/supabase'
import type {
  Project,
  Video,
  Script,
  ScriptComponent,
  UserProfile,
  Database,
  ApiResponse
} from '../types/data'

/**
 * DataAccessService encapsulates all Supabase operations
 * This is the ONLY place in the app that talks to Supabase directly
 */
export class DataAccessService {
  // ============================================
  // PROJECTS
  // ============================================

  /**
   * List all projects (for navigation)
   */
  async listProjects(): Promise<ApiResponse<Project[]>> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const projects = this.mapProjects(data || [])
      return { data: projects, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<ApiResponse<Project>> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      const project = this.mapProject(data)
      return { data: project, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Upsert a project (for sync service)
   * Uses SmartSuite ID as primary key
   */
  async upsertProject(project: Project): Promise<ApiResponse<Project>> {
    try {
      const row = this.projectToRow(project)

      const { data, error } = await supabase
        .from('projects')
        .upsert(row, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()
        .single()

      if (error) throw error

      const result = this.mapProject(data)
      return { data: result, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  // ============================================
  // VIDEOS
  // ============================================

  /**
   * List videos for a project
   */
  async listVideosForProject(projectId: string): Promise<ApiResponse<Video[]>> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('project_id', projectId)
        .order('title', { ascending: true }) // Orders by sequence number in title

      if (error) throw error

      const videos = this.mapVideos(data || [])
      return { data: videos, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Get a single video by ID
   */
  async getVideo(id: string): Promise<ApiResponse<Video>> {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      const video = this.mapVideo(data)
      return { data: video, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Upsert multiple videos (for sync service)
   */
  async upsertVideos(videos: Video[]): Promise<ApiResponse<Video[]>> {
    try {
      const rows = videos.map(v => this.videoToRow(v))

      const { data, error } = await supabase
        .from('videos')
        .upsert(rows, {
          onConflict: 'id',
          ignoreDuplicates: false
        })
        .select()

      if (error) throw error

      const result = this.mapVideos(data || [])
      return { data: result, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  // ============================================
  // SCRIPTS
  // ============================================

  /**
   * Get script by video ID
   */
  async getScriptByVideoId(videoId: string): Promise<ApiResponse<Script | null>> {
    try {
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error
      }

      if (!data) {
        return { data: null, error: null }
      }

      const script = this.mapScript(data)
      return { data: script, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Create a new script
   */
  async createScript(script: Omit<Script, 'id'>): Promise<ApiResponse<Script>> {
    try {
      const { data, error } = await supabase
        .from('scripts')
        .insert({
          video_id: script.videoId,
          plain_text: script.plainText || '',
          component_count: script.componentCount || 0,
          yjs_state: script.yDocState
        })
        .select()
        .single()

      if (error) throw error

      const result = this.mapScript(data)
      return { data: result, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Get or create a script for a video
   */
  async getOrCreateScript(videoId: string): Promise<ApiResponse<Script>> {
    try {
      // First try to get existing
      const { data: existing, error: fetchError } = await supabase
        .from('scripts')
        .select('*')
        .eq('video_id', videoId)
        .single()

      if (existing && !fetchError) {
        const script = this.mapScript(existing)
        return { data: script, error: null }
      }

      // Create new if not found
      const { data: created, error: createError } = await supabase
        .from('scripts')
        .insert({
          video_id: videoId,
          plain_text: '',
          component_count: 0
        })
        .select()
        .single()

      if (createError) throw createError

      const script = this.mapScript(created)
      return { data: script, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Update script content
   */
  async updateScript(
    scriptId: string,
    updates: Partial<Pick<Script, 'plainText' | 'componentCount' | 'yDocState'>>
  ): Promise<ApiResponse<Script>> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      }

      if (updates.plainText !== undefined) {
        updateData.plain_text = updates.plainText
      }
      if (updates.componentCount !== undefined) {
        updateData.component_count = updates.componentCount
      }
      if (updates.yDocState !== undefined) {
        updateData.yjs_state = updates.yDocState
      }

      const { data, error } = await supabase
        .from('scripts')
        .update(updateData)
        .eq('id', scriptId)
        .select()
        .single()

      if (error) throw error

      const script = this.mapScript(data)
      return { data: script, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  // ============================================
  // SCRIPT COMPONENTS
  // ============================================

  /**
   * List all components for a script
   */
  async listScriptComponents(scriptId: string): Promise<ApiResponse<ScriptComponent[]>> {
    try {
      const { data, error } = await supabase
        .from('script_components')
        .select('*')
        .eq('script_id', scriptId)
        .order('component_number', { ascending: true })

      if (error) throw error

      const components = this.mapScriptComponents(data || [])
      return { data: components, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Create a single script component
   */
  async createScriptComponent(component: Omit<ScriptComponent, 'id'>): Promise<ApiResponse<ScriptComponent>> {
    try {
      const { data, error } = await supabase
        .from('script_components')
        .insert({
          script_id: component.scriptId,
          component_number: component.componentNumber,
          content: component.content,
          word_count: component.wordCount
        })
        .select()
        .single()

      if (error) throw error

      const result = this.mapScriptComponent(data)
      return { data: result, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Delete all components for a script
   */
  async deleteScriptComponents(scriptId: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('script_components')
        .delete()
        .eq('script_id', scriptId)

      if (error) throw error

      return { data: undefined, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Get components for a script
   */
  async getScriptComponents(scriptId: string): Promise<ApiResponse<ScriptComponent[]>> {
    try {
      const { data, error } = await supabase
        .from('script_components')
        .select('*')
        .eq('script_id', scriptId)
        .order('component_number', { ascending: true })

      if (error) throw error

      const components = this.mapScriptComponents(data || [])
      return { data: components, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Replace all components for a script (used during extraction)
   */
  async replaceScriptComponents(
    scriptId: string,
    components: Omit<ScriptComponent, 'id' | 'scriptId' | 'createdAt'>[]
  ): Promise<ApiResponse<ScriptComponent[]>> {
    try {
      // Delete existing components
      await supabase
        .from('script_components')
        .delete()
        .eq('script_id', scriptId)

      // Insert new components
      const rows = components.map(c => ({
        script_id: scriptId,
        component_number: c.componentNumber,
        content: c.content,
        word_count: c.wordCount
      }))

      const { data, error } = await supabase
        .from('script_components')
        .insert(rows)
        .select()

      if (error) throw error

      const result = this.mapScriptComponents(data || [])
      return { data: result, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  // ============================================
  // USER PROFILES
  // ============================================

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<ApiResponse<UserProfile>> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      const profile = this.mapUserProfile(data)
      return { data: profile, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  // ============================================
  // DATA MAPPING UTILITIES
  // ============================================

  private mapProject(row: Database.ProjectRow): Project {
    return {
      id: row.id,
      eavCode: row.eav_code,
      title: row.title,
      dueDate: row.due_date ? new Date(row.due_date) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapProjects(rows: Database.ProjectRow[]): Project[] {
    return rows.map(row => this.mapProject(row))
  }

  private projectToRow(project: Project): Database.ProjectRow {
    return {
      id: project.id,
      eav_code: project.eavCode,
      title: project.title,
      due_date: project.dueDate?.toISOString() || null,
      created_at: project.createdAt.toISOString(),
      updated_at: project.updatedAt.toISOString()
    }
  }

  private mapVideo(row: Database.VideoRow): Video {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      mainStreamStatus: row.main_stream_status,
      voStreamStatus: row.vo_stream_status,
      productionType: row.production_type,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapVideos(rows: Database.VideoRow[]): Video[] {
    return rows.map(row => this.mapVideo(row))
  }

  private videoToRow(video: Video): Database.VideoRow {
    return {
      id: video.id,
      project_id: video.projectId,
      title: video.title,
      main_stream_status: video.mainStreamStatus || null,
      vo_stream_status: video.voStreamStatus || null,
      production_type: video.productionType || null,
      created_at: video.createdAt.toISOString(),
      updated_at: video.updatedAt.toISOString()
    }
  }

  private mapScript(row: Database.ScriptRow): Script {
    return {
      id: row.id,
      videoId: row.video_id,
      yDocState: row.yjs_state as Uint8Array | null, // Type cast for prototype - will be proper binary data in production
      plainText: row.plain_text,
      componentCount: row.component_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }

  private mapScriptComponent(row: Database.ScriptComponentRow): ScriptComponent {
    return {
      id: row.id,
      scriptId: row.script_id,
      componentNumber: row.component_number,
      content: row.content,
      wordCount: row.word_count || 0,
      createdAt: new Date(row.created_at)
    }
  }

  private mapScriptComponents(rows: Database.ScriptComponentRow[]): ScriptComponent[] {
    return rows.map(row => ({
      id: row.id,
      scriptId: row.script_id,
      componentNumber: row.component_number,
      content: row.content,
      wordCount: row.word_count,
      createdAt: new Date(row.created_at)
    }))
  }

  private mapUserProfile(row: Database.UserProfileRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role as UserProfile['role'],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }
}

// Export singleton instance for convenience
export const dataAccess = new DataAccessService()
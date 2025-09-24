// Critical-Engineer: consulted for Architecture pattern selection
// These are the core data contracts for the entire application
// All components must adhere to these interfaces

/**
 * Project represents a video production project from SmartSuite
 * Uses SmartSuite record ID as primary key (TEXT)
 */
export interface Project {
  id: string                    // SmartSuite record ID (e.g., '68aa9add9bedb640d0a3bc0c')
  eavCode: string               // Unique project code (e.g., 'EAV002')
  title: string                 // Full project title including code (e.g., 'EAV002 - Berkeley Homes')
  dueDate: Date | null         // Project deadline
  createdAt: Date
  updatedAt: Date
  // Computed/joined fields
  videoCount?: number           // Count of associated videos
  status?: 'draft' | 'active' | 'completed' | 'archived'
}

/**
 * Video represents a single video within a project
 * Uses SmartSuite record ID as primary key (TEXT)
 */
export interface Video {
  id: string                    // SmartSuite record ID
  projectId: string             // Reference to Project.id
  title: string                 // Video title with sequence (e.g., '0-Introduction')
  mainStreamStatus: string | null     // Script work status
  voStreamStatus: string | null       // Voice-over status
  productionType: string | null       // 'new' | 'reuse' | null
  sequence?: number             // Order within project
  createdAt: Date
  updatedAt: Date
  // Navigation helper
  project?: Project             // Joined project data when needed
}

/**
 * Script contains the actual content for a video
 * Uses UUID as primary key (generated in Supabase)
 */
export interface Script {
  id: string                    // UUID from Supabase
  videoId: string               // Reference to Video.id (SmartSuite ID)
  yDocState: Uint8Array | null // Y.js document state (binary)
  plainText: string | null     // Extracted plain text for search/display
  componentCount: number        // Number of components (paragraphs)
  lastEditedBy?: string         // User ID of last editor
  createdAt: Date
  updatedAt: Date
  // Joined data
  video?: Video                 // Associated video when needed
  components?: ScriptComponent[] // Extracted components when needed
}

/**
 * ScriptComponent represents a single paragraph/component
 * Extracted from Script content server-side
 */
export interface ScriptComponent {
  id: string                    // UUID from Supabase
  scriptId: string              // Reference to Script.id
  componentNumber: number       // C1, C2, C3... (1-based)
  content: string               // Plain text content of this component
  wordCount: number             // Word count for duration estimates
  createdAt: Date
  // Workflow tracking (future)
  sceneStatus?: 'pending' | 'approved'
  voStatus?: 'pending' | 'recorded' | 'approved'
  editStatus?: 'pending' | 'completed'
}

/**
 * UserProfile extends Supabase auth with app-specific fields
 */
export interface UserProfile {
  id: string                    // UUID from auth.users
  email: string
  displayName: string | null
  role: 'viewer' | 'editor' | 'admin'
  createdAt: Date
  updatedAt: Date
}

/**
 * Database row types for Supabase operations
 * These match the actual database schema
 */
export module Database {
  export interface ProjectRow {
    id: string
    eav_code: string
    title: string
    due_date: string | null
    created_at: string
    updated_at: string
  }

  export interface VideoRow {
    id: string
    project_id: string
    title: string
    main_stream_status: string | null
    vo_stream_status: string | null
    production_type: string | null
    created_at: string
    updated_at: string
  }

  export interface ScriptRow {
    id: string
    video_id: string
    yjs_state: Record<string, unknown> | null // Binary data
    plain_text: string | null
    component_count: number
    created_at: string
    updated_at: string
  }

  export interface ScriptComponentRow {
    id: string
    script_id: string
    component_number: number
    content: string
    word_count: number
    created_at: string
  }

  export interface UserProfileRow {
    id: string
    email: string
    display_name: string | null
    role: string
    created_at: string
    updated_at: string
  }
}

/**
 * Utility type for API responses
 */
export interface ApiResponse<T> {
  data: T | null
  error: Error | null
}

/**
 * SmartSuite sync status tracking
 */
export interface SyncStatus {
  lastSync: Date | null
  syncing: boolean
  error: string | null
  projectsCount: number
  videosCount: number
}
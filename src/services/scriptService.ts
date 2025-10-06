/**
 * Script Service - Handles script operations with Supabase
 *
 * Manages loading and saving scripts for videos, including:
 * - Creating scripts when they don't exist
 * - Loading scripts for specific videos
 * - Saving script content and extracted components
 *
 * Critical-Engineer: consulted for Security vulnerability assessment
 */

import { supabase } from '../lib/supabase';
import {
  validateVideoId,
  validateScriptId,
  validateScriptContent,
  validateComponentArray,
  ValidationError,
  type ComponentData
} from '../lib/validation';

// Workflow status enum for scripts
export type ScriptWorkflowStatus = 'draft' | 'in_review' | 'rework' | 'approved';

// Type definitions for scripts matching normalized database schema
export interface Script {
  id: string;
  video_id: string;
  yjs_state?: Uint8Array | null; // BYTEA field for Y.js document state (primary content storage)
  plain_text?: string; // Extracted plain text for search/display
  component_count?: number;
  status?: ScriptWorkflowStatus; // Workflow status (defaults to 'draft')
  components: ComponentData[]; // Loaded from script_components table
  created_at: string;
  updated_at: string;
}

// Critical-Engineer: consulted for Architecture pattern selection (yjs_state as source of truth)

// Re-export ComponentData from validation module for type consistency
export type { ComponentData } from '../lib/validation';

export interface ScriptServiceErrorInterface {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Load script for a specific video
 * Creates a new script if one doesn't exist
 * Loads components from the normalized script_components table
 */
export async function loadScriptForVideo(videoId: string, userRole?: string | null): Promise<Script> {
  try {
    // SECURITY: Validate input before database operation
    const validatedVideoId = validateVideoId(videoId);

    // First, try to find existing script
    // Using maybeSingle() to avoid 406 error when no rows exist
    const { data: existingScript, error: fetchError } = await supabase
      .from('scripts')
      .select('*')
      .eq('video_id', validatedVideoId)
      .maybeSingle();

    if (fetchError) {
      // Any error here is unexpected since maybeSingle handles no rows gracefully
      throw new ScriptServiceError(`Failed to fetch script: ${fetchError.message}`, fetchError.code);
    }

    // If script exists, load its components and return complete object
    if (existingScript) {
      const { data: components, error: componentsError } = await supabase
        .from('script_components')
        .select('*')
        .eq('script_id', existingScript.id)
        .order('component_number', { ascending: true });

      if (componentsError) {
        throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
      }

      // Transform database components to expected format
      const transformedComponents: ComponentData[] = (components || []).map(comp => ({
        number: comp.component_number,
        content: comp.content,
        wordCount: comp.word_count || 0,
        hash: generateContentHash(comp.content)
      }));

      return {
        ...existingScript,
        components: transformedComponents
      };
    }

    // Check if user has permission to create scripts
    if (userRole !== 'admin') {
      // Return a read-only placeholder for non-admin users

      return {
        id: `readonly-${validatedVideoId}`,
        video_id: validatedVideoId,
        yjs_state: null,
        plain_text: 'This script has not been created yet. Please ask an administrator to create the script for this video.',
        component_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        components: [],
        readonly: true // Flag to indicate this is a placeholder
      } as Script & { readonly: boolean };
    }

    // Create new script for video (Y.js state will be initialized by editor)
    const newScript = {
      video_id: validatedVideoId,
      yjs_state: null, // Will be populated when editor saves
      plain_text: 'Script for Video\n\nStart writing your script here. Each paragraph becomes a component that flows through the production pipeline.',
      component_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: createdScript, error: createError } = await supabase
      .from('scripts')
      .insert(newScript)
      .select('*')
      .single();

    if (createError) {
      throw new ScriptServiceError(`Failed to create script: ${createError.message}`, createError.code);
    }

    // Return new script with empty components array
    return {
      ...createdScript,
      components: []
    };
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error loading script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save script Y.js state, plain text, and components atomically
 * Uses RPC function for transactional consistency
 */
export async function saveScript(
  scriptId: string,
  yjsState: Uint8Array | null, // Y.js document state (will be stored as BYTEA)
  plainText: string,
  components: ComponentData[]
): Promise<Script> {
  try {
    // SECURITY: Validate all inputs before database operation
    const validatedScriptId = validateScriptId(scriptId);
    const validatedPlainText = validateScriptContent(plainText);
    const validatedComponents = validateComponentArray(components);
    // Try to use atomic RPC function first
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('save_script_with_components', {
        p_script_id: validatedScriptId,
        p_yjs_state: yjsState,
        p_plain_text: validatedPlainText,
        p_components: validatedComponents
      });

    // If RPC exists and works, use it
    if (!rpcError && rpcData && rpcData.length > 0) {
      const updatedScript = rpcData[0];
      return {
        ...updatedScript,
        components
      };
    }

    // Fallback to non-atomic updates if RPC doesn't exist yet
    // (This allows the system to work before migration is run)
    console.warn('RPC function not available, using fallback save method');

    // Update script with Y.js state and metadata
    const { data: updatedScript, error: scriptError } = await supabase
      .from('scripts')
      .update({
        yjs_state: yjsState,
        plain_text: validatedPlainText,
        component_count: validatedComponents.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedScriptId)
      .select('*')
      .single();

    if (scriptError) {
      throw new ScriptServiceError(`Failed to save script: ${scriptError.message}`, scriptError.code);
    }

    // Delete existing components for this script
    const { error: deleteError } = await supabase
      .from('script_components')
      .delete()
      .eq('script_id', validatedScriptId);

    if (deleteError) {
      throw new ScriptServiceError(`Failed to delete existing components: ${deleteError.message}`, deleteError.code);
    }

    // Insert new components if any exist
    if (validatedComponents.length > 0) {
      const componentsToInsert = validatedComponents.map(comp => ({
        script_id: validatedScriptId,
        component_number: comp.number,
        content: comp.content,
        word_count: comp.wordCount,
        created_at: new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from('script_components')
        .insert(componentsToInsert);

      if (insertError) {
        throw new ScriptServiceError(`Failed to save components: ${insertError.message}`, insertError.code);
      }
    }

    // Return complete script with components
    return {
      ...updatedScript,
      components: validatedComponents
    };
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error saving script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get script by ID with components (utility function)
 */
export async function getScriptById(scriptId: string): Promise<Script> {
  try {
    // SECURITY: Validate input before database operation
    const validatedScriptId = validateScriptId(scriptId);

    const { data: script, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', validatedScriptId)
      .single();

    if (error) {
      throw new ScriptServiceError(`Failed to fetch script: ${error.message}`, error.code);
    }

    // Load components for the script
    const { data: components, error: componentsError } = await supabase
      .from('script_components')
      .select('*')
      .eq('script_id', validatedScriptId)
      .order('component_number', { ascending: true });

    if (componentsError) {
      throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
    }

    // Transform database components to expected format
    const transformedComponents: ComponentData[] = (components || []).map(comp => ({
      number: comp.component_number,
      content: comp.content,
      wordCount: comp.word_count || 0,
      hash: generateContentHash(comp.content)
    }));

    return {
      ...script,
      components: transformedComponents
    };
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error fetching script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Utility function to generate content hash for component tracking
 */
function generateContentHash(content: string): string {
  // Simple hash function for content tracking
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Note: Plain text extraction moved to client-side editor.getText()
// This ensures consistency between what the editor shows and what we store

/**
 * Update script workflow status
 * Allows any authenticated user to change script status for collaboration
 */
export async function updateScriptStatus(
  scriptId: string,
  status: ScriptWorkflowStatus
): Promise<Script> {
  try {
    // SECURITY: Validate inputs before database operation
    const validatedScriptId = validateScriptId(scriptId);

    // Validate status is one of the allowed values
    const validStatuses: ScriptWorkflowStatus[] = ['draft', 'in_review', 'rework', 'approved'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }

    // Update script status (RLS policies will enforce authorization)
    const { data: updatedScript, error } = await supabase
      .from('scripts')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedScriptId)
      .select('*')
      .single();

    if (error) {
      throw new ScriptServiceError(`Failed to update script status: ${error.message}`, error.code);
    }

    // Load components for complete script object
    const { data: components, error: componentsError } = await supabase
      .from('script_components')
      .select('*')
      .eq('script_id', validatedScriptId)
      .order('component_number', { ascending: true });

    if (componentsError) {
      throw new ScriptServiceError(`Failed to load script components: ${componentsError.message}`, componentsError.code);
    }

    // Transform components to expected format
    const transformedComponents: ComponentData[] = (components || []).map(comp => ({
      number: comp.component_number,
      content: comp.content,
      wordCount: comp.word_count || 0,
      hash: generateContentHash(comp.content)
    }));

    return {
      ...updatedScript,
      components: transformedComponents
    };
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      throw new ScriptServiceError(`Input validation failed: ${error.message}`);
    }
    throw new ScriptServiceError(`Unexpected error updating script status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Custom error class for script service operations
 */
class ScriptServiceError extends Error {
  public code?: string;
  public details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ScriptServiceError';
    this.code = code;
    this.details = details;
  }
}
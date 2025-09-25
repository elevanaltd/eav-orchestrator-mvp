/**
 * Script Service - Handles script operations with Supabase
 *
 * Manages loading and saving scripts for videos, including:
 * - Creating scripts when they don't exist
 * - Loading scripts for specific videos
 * - Saving script content and extracted components
 */

import { supabase } from '../lib/supabase';

// Type definitions for scripts matching normalized database schema
export interface Script {
  id: string;
  video_id: string;
  yjs_state?: Uint8Array | null; // BYTEA field for Y.js document state (primary content storage)
  plain_text?: string; // Extracted plain text for search/display
  component_count?: number;
  components: ComponentData[]; // Loaded from script_components table
  created_at: string;
  updated_at: string;
}

// Critical-Engineer: consulted for Architecture pattern selection (yjs_state as source of truth)

export interface ComponentData {
  number: number;
  content: string;
  wordCount: number;
  hash: string;
}

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
export async function loadScriptForVideo(videoId: string): Promise<Script> {
  try {
    // First, try to find existing script
    const { data: existingScript, error: fetchError } = await supabase
      .from('scripts')
      .select('*')
      .eq('video_id', videoId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is expected for new videos
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

    // Create new script for video (Y.js state will be initialized by editor)
    const newScript = {
      video_id: videoId,
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
    // Try to use atomic RPC function first
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('save_script_with_components', {
        p_script_id: scriptId,
        p_yjs_state: yjsState,
        p_plain_text: plainText,
        p_components: components
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
        plain_text: plainText,
        component_count: components.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', scriptId)
      .select('*')
      .single();

    if (scriptError) {
      throw new ScriptServiceError(`Failed to save script: ${scriptError.message}`, scriptError.code);
    }

    // Delete existing components for this script
    const { error: deleteError } = await supabase
      .from('script_components')
      .delete()
      .eq('script_id', scriptId);

    if (deleteError) {
      throw new ScriptServiceError(`Failed to delete existing components: ${deleteError.message}`, deleteError.code);
    }

    // Insert new components if any exist
    if (components.length > 0) {
      const componentsToInsert = components.map(comp => ({
        script_id: scriptId,
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
      components
    };
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    throw new ScriptServiceError(`Unexpected error saving script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get script by ID with components (utility function)
 */
export async function getScriptById(scriptId: string): Promise<Script> {
  try {
    const { data: script, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', scriptId)
      .single();

    if (error) {
      throw new ScriptServiceError(`Failed to fetch script: ${error.message}`, error.code);
    }

    // Load components for the script
    const { data: components, error: componentsError } = await supabase
      .from('script_components')
      .select('*')
      .eq('script_id', scriptId)
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
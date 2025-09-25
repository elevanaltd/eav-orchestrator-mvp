/**
 * Script Service - Handles script operations with Supabase
 *
 * Manages loading and saving scripts for videos, including:
 * - Creating scripts when they don't exist
 * - Loading scripts for specific videos
 * - Saving script content and extracted components
 */

import { supabase } from '../lib/supabase';

// Type definitions for scripts
export interface Script {
  id: string;
  video_id: string;
  content: string;
  components: ComponentData[] | null;
  created_at: string;
  updated_at: string;
}

export interface ComponentData {
  number: number;
  content: string;
  wordCount: number;
  hash: string;
}

export interface ScriptServiceErrorInterface {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Load script for a specific video
 * Creates a new script if one doesn't exist
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

    // If script exists, return it
    if (existingScript) {
      return existingScript;
    }

    // Create new script for video
    const newScript = {
      video_id: videoId,
      content: `<h2>Script for Video</h2><p>Start writing your script here. Each paragraph becomes a component that flows through the production pipeline.</p>`,
      components: [],
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

    return createdScript;
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    throw new ScriptServiceError(`Unexpected error loading script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save script content and components
 */
export async function saveScript(
  scriptId: string,
  content: string,
  components: ComponentData[]
): Promise<Script> {
  try {
    const { data: updatedScript, error } = await supabase
      .from('scripts')
      .update({
        content,
        components,
        updated_at: new Date().toISOString()
      })
      .eq('id', scriptId)
      .select('*')
      .single();

    if (error) {
      throw new ScriptServiceError(`Failed to save script: ${error.message}`, error.code);
    }

    return updatedScript;
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    throw new ScriptServiceError(`Unexpected error saving script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get script by ID (utility function)
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

    return script;
  } catch (error) {
    if (error instanceof ScriptServiceError) {
      throw error;
    }
    throw new ScriptServiceError(`Unexpected error fetching script: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Custom error class for script service operations
 */
class ScriptServiceError extends Error {
  public code?: string;
  public details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'ScriptServiceError';
    this.code = code;
    this.details = details;
  }
}
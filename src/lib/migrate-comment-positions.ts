/**
 * Comment Position Migration Script
 *
 * Aggressively migrates all legacy comments (string indices) to ProseMirror positions.
 * Runs once on app startup via localStorage flag.
 *
 * Strategy:
 * 1. Load all legacy comments (position_system='string_indices')
 * 2. Group by script for efficiency
 * 3. Create headless TipTap editor with script content
 * 4. Use text matching to find PM positions
 * 5. Batch update to database
 * 6. Mark orphaned comments (text not found)
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { supabase } from './supabase';
import { findTextInDocument } from './comments-position-recovery';

interface LegacyComment {
  id: string;
  script_id: string;
  start_position: number;
  end_position: number;
  highlighted_text: string | null;
}

interface MigrationResult {
  total: number;
  migrated: number;
  orphaned: number;
  errors: number;
  duration: number;
}

/**
 * Create headless TipTap editor for position calculation
 * (No DOM rendering, just for getText() and position mapping)
 */
function createHeadlessEditor(content: string): Editor {
  return new Editor({
    content,
    extensions: [StarterKit],
    editable: false,
    // Headless mode - no DOM updates
    onCreate: () => {
      // Editor ready for position calculations
    }
  });
}

/**
 * Migrate all legacy comment positions to ProseMirror coordinates
 */
export async function migrateCommentPositions(): Promise<MigrationResult> {
  const startTime = performance.now();

  console.log('[Migration] Starting aggressive comment position migration...');

  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    orphaned: 0,
    errors: 0,
    duration: 0
  };

  try {
    // Get all legacy comments
    const { data: comments, error: fetchError } = await supabase
      .from('comments')
      .select('id, script_id, start_position, end_position, highlighted_text')
      .eq('position_system', 'string_indices')
      .eq('positions_recovered', false);

    if (fetchError) {
      console.error('[Migration] Failed to fetch legacy comments', fetchError);
      throw fetchError;
    }

    if (!comments || comments.length === 0) {
      console.log('[Migration] No legacy comments to migrate');
      result.duration = performance.now() - startTime;
      return result;
    }

    result.total = comments.length;
    console.log(`[Migration] Found ${result.total} legacy comments to migrate`);

    // Group by script for efficiency
    const commentsByScript = new Map<string, LegacyComment[]>();
    comments.forEach(c => {
      if (!commentsByScript.has(c.script_id)) {
        commentsByScript.set(c.script_id, []);
      }
      commentsByScript.get(c.script_id)!.push(c);
    });

    console.log(`[Migration] Processing ${commentsByScript.size} scripts...`);

    // Migrate each script's comments
    for (const [scriptId, scriptComments] of commentsByScript) {
      try {
        // Load script content
        const { data: script, error: scriptError } = await supabase
          .from('scripts')
          .select('content')
          .eq('id', scriptId)
          .single();

        if (scriptError || !script) {
          console.error(`[Migration] Failed to load script ${scriptId}`, scriptError);
          result.errors += scriptComments.length;
          continue;
        }

        // Create headless editor to get PM positions
        const editor = createHeadlessEditor(script.content);
        const documentText = editor.getText();

        // Recover positions for each comment
        const updates: Array<{
          id: string;
          start_position: number;
          end_position: number;
          position_system: string;
          positions_recovered: boolean;
        }> = [];

        for (const comment of scriptComments) {
          if (!comment.highlighted_text || comment.highlighted_text.trim() === '') {
            // No highlighted text - keep original positions, mark as orphaned
            updates.push({
              id: comment.id,
              start_position: comment.start_position,
              end_position: comment.end_position,
              position_system: 'pm_positions_orphaned',
              positions_recovered: true
            });
            result.orphaned++;
            continue;
          }

          // Try to find text in document
          const match = findTextInDocument(
            documentText,
            comment.highlighted_text,
            comment.start_position
          );

          if (match?.found) {
            // Found! Update to PM positions
            updates.push({
              id: comment.id,
              start_position: match.startPosition,
              end_position: match.endPosition,
              position_system: 'pm_positions',
              positions_recovered: true
            });
            result.migrated++;
          } else {
            // Not found - mark as orphaned but preserve positions
            updates.push({
              id: comment.id,
              start_position: comment.start_position,
              end_position: comment.end_position,
              position_system: 'pm_positions_orphaned',
              positions_recovered: true
            });
            result.orphaned++;
          }
        }

        // Batch update to database
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('comments')
            .update({
              start_position: update.start_position,
              end_position: update.end_position,
              position_system: update.position_system,
              positions_recovered: update.positions_recovered
            })
            .eq('id', update.id);

          if (updateError) {
            console.error(`[Migration] Failed to update comment ${update.id}`, updateError);
            result.errors++;
            result.migrated--;
          }
        }

        // Destroy headless editor
        editor.destroy();

        console.log(`[Migration] Migrated ${updates.length} comments for script ${scriptId}`);

      } catch (err) {
        console.error(`[Migration] Failed to migrate script ${scriptId}`, err);
        result.errors += scriptComments.length;
      }
    }

    result.duration = performance.now() - startTime;

    console.log('[Migration] Complete!', {
      total: result.total,
      migrated: result.migrated,
      orphaned: result.orphaned,
      errors: result.errors,
      duration: `${result.duration.toFixed(2)}ms`
    });

    return result;

  } catch (err) {
    console.error('[Migration] Failed', err);
    result.duration = performance.now() - startTime;
    throw err;
  }
}

/**
 * Check if migration has already run
 */
export function hasMigrationRun(): boolean {
  return localStorage.getItem('comments_migrated_v1') === 'true';
}

/**
 * Mark migration as complete
 */
export function markMigrationComplete(): void {
  localStorage.setItem('comments_migrated_v1', 'true');
}

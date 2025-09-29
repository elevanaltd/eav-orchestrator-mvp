/**
 * Comments CRUD Operations - Phase 2.4 Implementation
 *
 * Google Docs-style commenting system database operations
 * Following ADR-003 architecture requirements
 *
 * Features:
 * - Create, read, update, delete comments
 * - Position-based text anchoring
 * - Threading support for replies
 * - Resolution status management
 * - RLS security enforcement
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import type {
  CommentWithUser,
  CreateCommentData,
  CommentFilters,
  CommentError
} from '../types/comments';

// Result types for consistent API responses
export interface CommentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: CommentError;
}

/**
 * Create a new comment in the database
 */
export async function createComment(
  supabase: SupabaseClient<Database>,
  data: CreateCommentData,
  userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    // Validate input data
    const validationError = validateCommentData(data);
    if (validationError) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError
        }
      };
    }

    // Insert comment into database
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        script_id: data.scriptId,
        user_id: userId,
        content: data.content,
        start_position: data.startPosition,
        end_position: data.endPosition,
        parent_comment_id: data.parentCommentId,
        highlighted_text: '', // TODO: Extract from TipTap editor
      })
      .select(`
        id,
        script_id,
        user_id,
        content,
        start_position,
        end_position,
        parent_comment_id,
        resolved_at,
        resolved_by,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    // Transform to application format
    const commentWithUser: CommentWithUser = {
      id: comment.id,
      scriptId: comment.script_id,
      userId: comment.user_id,
      content: comment.content,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      parentCommentId: comment.parent_comment_id,
      resolvedAt: comment.resolved_at,
      resolvedBy: comment.resolved_by,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: undefined // Will be populated by getComments
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Get comments for a script with optional filtering
 */
export async function getComments(
  supabase: SupabaseClient<Database>,
  scriptId: string,
  filters?: CommentFilters
): Promise<CommentResult<CommentWithUser[]>> {
  try {
    let query = supabase
      .from('comments')
      .select(`
        id,
        script_id,
        user_id,
        content,
        start_position,
        end_position,
        parent_comment_id,
        resolved_at,
        resolved_by,
        created_at,
        updated_at
      `)
      .eq('script_id', scriptId)
      .eq('deleted', false) // Only non-deleted comments
      .order('start_position', { ascending: true });

    // Apply filters
    if (filters?.resolved !== undefined) {
      if (filters.resolved) {
        query = query.not('resolved_at', 'is', null);
      } else {
        query = query.is('resolved_at', null);
      }
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    const { data: comments, error } = await query;

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    // Transform to application format with basic user info
    const commentsWithUser: CommentWithUser[] = await Promise.all(
      (comments || []).map(async (comment) => {
        // For now, fetch user info separately for each comment
        // TODO: Optimize with a single join query when user relationships are clarified
        let userInfo = undefined;
        try {
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('id, email, display_name, role')
            .eq('id', comment.user_id)
            .single();

          if (userProfile) {
            userInfo = {
              id: userProfile.id,
              email: userProfile.email,
              display_name: userProfile.display_name,
              role: userProfile.role
            };
          }
        } catch {
          // If user profile not found, leave as undefined
          userInfo = undefined;
        }

        return {
          id: comment.id,
          scriptId: comment.script_id,
          userId: comment.user_id,
          content: comment.content,
          startPosition: comment.start_position,
          endPosition: comment.end_position,
          parentCommentId: comment.parent_comment_id,
          resolvedAt: comment.resolved_at,
          resolvedBy: comment.resolved_by,
          createdAt: comment.created_at,
          updatedAt: comment.updated_at,
          user: userInfo
        };
      })
    );

    return {
      success: true,
      data: commentsWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Update a comment's content
 */
export async function updateComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  updates: { content?: string },
  userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    // Validate content if provided
    if (updates.content !== undefined) {
      const validation = validateContent(updates.content);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error!
          }
        };
      }
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        content: updates.content,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .eq('user_id', userId) // User can only update their own comments
      .select(`
        id,
        script_id,
        user_id,
        content,
        start_position,
        end_position,
        parent_comment_id,
        resolved_at,
        resolved_by,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    // Transform to application format
    const commentWithUser: CommentWithUser = {
      id: comment.id,
      scriptId: comment.script_id,
      userId: comment.user_id,
      content: comment.content,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      parentCommentId: comment.parent_comment_id,
      resolvedAt: comment.resolved_at,
      resolvedBy: comment.resolved_by,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: undefined
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Resolve a comment (mark as resolved)
 */
export async function resolveComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  userId: string
): Promise<CommentResult<CommentWithUser>> {
  try {
    const resolvedAt = new Date().toISOString();

    const { data: comment, error } = await supabase
      .from('comments')
      .update({
        resolved_at: resolvedAt,
        resolved_by: userId,
        updated_at: resolvedAt
      })
      .eq('id', commentId)
      .select(`
        id,
        script_id,
        user_id,
        content,
        start_position,
        end_position,
        parent_comment_id,
        resolved_at,
        resolved_by,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    // Transform to application format
    const commentWithUser: CommentWithUser = {
      id: comment.id,
      scriptId: comment.script_id,
      userId: comment.user_id,
      content: comment.content,
      startPosition: comment.start_position,
      endPosition: comment.end_position,
      parentCommentId: comment.parent_comment_id,
      resolvedAt: comment.resolved_at,
      resolvedBy: comment.resolved_by,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      user: undefined
    };

    return {
      success: true,
      data: commentWithUser
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Soft delete a comment (mark as deleted)
 */
export async function deleteComment(
  supabase: SupabaseClient<Database>,
  commentId: string,
  userId: string
): Promise<CommentResult<boolean>> {
  try {
    const { error } = await supabase
      .from('comments')
      .update({
        deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', commentId)
      .eq('user_id', userId); // User can only delete their own comments

    if (error) {
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: error.message,
          details: error
        }
      };
    }

    return {
      success: true,
      data: true
    };

  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function validateCommentData(data: CreateCommentData): string | null {
  if (!data.scriptId || data.scriptId.trim() === '') {
    return 'Script ID is required';
  }

  if (!data.content || data.content.trim() === '') {
    return 'Comment content is required';
  }

  const contentValidation = validateContent(data.content);
  if (!contentValidation.valid) {
    return contentValidation.error!;
  }

  if (data.startPosition < 0) {
    return 'Start position must be non-negative';
  }

  if (data.endPosition < data.startPosition) {
    return 'End position must be greater than start position';
  }

  return null;
}

function validateContent(content: string): { valid: boolean; error?: string } {
  const trimmed = content.trim();

  if (trimmed.length < 1) {
    return { valid: false, error: 'Content cannot be empty' };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: 'Content cannot exceed 10,000 characters' };
  }

  return { valid: true };
}
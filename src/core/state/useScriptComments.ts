import { useScriptCommentsQuery } from './useScriptCommentsQuery'
import { useCommentMutations } from './useCommentMutations'
import { useCommentStore } from '../stores/commentStore'
import { useCurrentScript } from './useCurrentScript'
import { getUserFriendlyErrorMessage } from '../../utils/errorHandling'

// Constitutional Authority: holistic-orchestrator - Phase 1 unified interface hooks
// Implementation-lead consulted: Gap G6 synthesis - preserve error context via callback patterns
// Gap G6 Re-evaluation: "Superior error handling" = context-specific messages (preserved via helper)
// Architecture: Unified interface that wraps useScriptCommentsQuery + useCommentMutations + useCommentStore

export interface CommentErrorContext {
  operation: 'create' | 'reply' | 'resolve' | 'unresolve' | 'delete'
  resource: 'comment' | 'reply'
}

/**
 * Unified comment interface that preserves Gap G6 error handling quality
 *
 * Provides single hook for all comment-related state and operations:
 * - Comment fetching with threading (via TanStack Query)
 * - CRUD mutations with optimistic UI
 * - Realtime subscription status
 * - Context-aware error handling (Gap G6 preservation)
 *
 * Benefits:
 * - Reduces CommentSidebar from ~150 LOC of hook orchestration to single hook call
 * - Centralizes comment lifecycle management
 * - Preserves Gap G6 context-specific error messages via helper
 * - Components retain low-level access via mutations property
 *
 * Constitutional Compliance:
 * - Gap G6 (Lines 188-195): Context-specific error messages preserved via createContextualError
 * - MIP (Line 32): Essential complexity (reduces boilerplate), not accumulative (preserves low-level access)
 * - Line 169-176: Constitutional essential = error context (preserved)
 */
export const useScriptComments = () => {
  const { currentScript } = useCurrentScript()
  const commentsQuery = useScriptCommentsQuery(currentScript?.id || null)
  const mutations = useCommentMutations()
  const store = useCommentStore()

  /**
   * Create context-aware error message (Gap G6 preservation)
   *
   * Wraps getUserFriendlyErrorMessage with comment-specific context
   * Enables components to provide operation-specific error messages:
   * - "Failed to create comment. Please try again."
   * - "Failed to delete comment. Please try again."
   * - "Failed to resolve comment. Please try again."
   *
   * @param error - Error from mutation
   * @param context - Operation and resource context
   * @returns User-friendly error message
   */
  const createContextualError = (error: Error, context: CommentErrorContext): string => {
    return getUserFriendlyErrorMessage(error, context)
  }

  return {
    // Query state - threaded comments
    threads: commentsQuery.data || [],
    isLoading: commentsQuery.isLoading,
    error: commentsQuery.error,
    refetch: commentsQuery.refetch,

    // Mutations - direct access for onError callbacks (Gap G6 preservation)
    mutations,

    // Convenience wrappers - simplified async API
    createComment: mutations.createMutation.mutateAsync,
    updateComment: mutations.updateMutation.mutateAsync,
    deleteComment: mutations.deleteMutation.mutateAsync,
    resolveComment: mutations.resolveMutation.mutateAsync,
    unresolveComment: mutations.unresolveMutation.mutateAsync,

    // Mutation status
    isCreating: mutations.createMutation.isPending,
    isDeleting: mutations.deleteMutation.isPending,
    isResolving: mutations.resolveMutation.isPending,

    // Store access - optimistic state
    optimisticComments: store.optimisticComments,
    submittingStatus: store.submittingStatus,

    // Error helper - Gap G6 context preservation
    createContextualError,

    // Additional context
    scriptId: currentScript?.id || null,
  }
}

/**
 * CommentSidebar.tsx - Google Docs-Style Comments Sidebar
 *
 * Implementation of ADR-003 specification:
 * - Fixed right panel (300px width)
 * - Shows comments in document order
 * - Filter controls (All/Open/Resolved)
 * - Comment cards with threading
 * - Comment creation form
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommentWithUser, CommentThread, CreateCommentData } from '../../types/comments';
import {
  getComments,
  createComment as createCommentInDB,
  updateComment
} from '../../lib/comments';
import { useCommentMutations } from '../../core/state/useCommentMutations';
import { Logger } from '../../services/logger';
import { useErrorHandling, getUserFriendlyErrorMessage } from '../../utils/errorHandling';

export interface CommentSidebarProps {
  scriptId: string;
  createComment?: {
    startPosition: number;
    endPosition: number;
    selectedText: string;
  } | null;
  onCommentCreated?: (commentData: CreateCommentData) => void;
  onCommentCancelled?: () => void;
  onCommentDeleted?: (commentId: string) => void;
  // FIX (ADR-005 ADDENDUM 2): Removed documentContent prop - no longer needed
}

type FilterMode = 'all' | 'open' | 'resolved';
type ConnectionStatus = 'connected' | 'reconnecting' | 'degraded';

export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  scriptId,
  createComment,
  onCommentCreated,
  onCommentCancelled,
  onCommentDeleted
  // FIX (ADR-005 ADDENDUM 2): Removed documentContent destructuring
}) => {
  const { currentUser } = useAuth();
  const { executeWithErrorHandling } = useErrorHandling('comment operations');

  // FIX #3: Use optimistic UI mutations for resolve/unresolve/delete
  const { resolveMutation, unresolveMutation, deleteMutation } = useCommentMutations();
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Connection state for realtime resilience
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');
  const [reconnectionTimer, setReconnectionTimer] = useState<NodeJS.Timeout | null>(null);
  const reconnectionAttemptsRef = useRef(0);

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // commentId being replied to
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // User profile cache to prevent N+1 queries (critical-engineer validated solution)
  const userProfileCacheRef = useRef<Map<string, { id: string; email: string; displayName: string | null; role: string | null }>>(new Map());

  // BLOCKING ISSUE #2 FIX: Clear user profile cache when scriptId changes
  // Prevents memory leak where cache accumulates profiles from different scripts forever
  useEffect(() => {
    userProfileCacheRef.current.clear();
    Logger.info('User profile cache cleared', { scriptId });
  }, [scriptId]);

  // Delete functionality state
  const [deleteConfirming, setDeleteConfirming] = useState<string | null>(null); // commentId being confirmed for deletion
  const [deleting, setDeleting] = useState(false);

  // Edit functionality state
  const [editing, setEditing] = useState<string | null>(null); // commentId being edited
  const [editText, setEditText] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Fetch user profile with caching to prevent N+1 queries
  const fetchUserProfileCached = useCallback(async (userId: string) => {
    // Check cache first
    const cached = userProfileCacheRef.current.get(userId);
    if (cached) {
      return cached;
    }

    // Fetch from database if not cached
    try {
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id, email, display_name, role')
        .eq('id', userId)
        .single();

      if (userError) {
        Logger.error('Failed to fetch user profile', { error: userError, userId });
        return null;
      }

      // Cache the result
      const profileData = {
        id: userProfile.id,
        email: userProfile.email,
        displayName: userProfile.display_name,
        role: userProfile.role
      };
      userProfileCacheRef.current.set(userId, profileData);

      return profileData;
    } catch (err) {
      Logger.error('Exception fetching user profile', { error: err, userId });
      return null;
    }
  }, []);

  // Unified comment loading function with optional cancellation check
  const loadCommentsWithCleanup = useCallback(async (cancellationCheck?: () => boolean) => {
    // PRIORITY 1 FIX: Clear comments immediately when scriptId changes to prevent stale data
    setComments([]);

    // Don't load comments for readonly placeholder scripts (no script created yet)
    if (scriptId.startsWith('readonly-')) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await executeWithErrorHandling(
      async () => {
        // FIX (ADR-005 ADDENDUM 2): Load comments WITHOUT documentContent
        // Recovery is NOT needed - positions are already correct PM positions from DB
        const response = await getComments(supabase, scriptId);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to load comments');
        }

        return response.data || [];
      },
      (errorInfo) => {
        if (cancellationCheck?.()) return; // Don't update state if cancelled

        // Set context-specific user-friendly error message
        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'load', resource: 'comments' }
        );
        setError(contextualMessage);
        // Log the error for debugging
        Logger.error('Comment loading error', { error: errorInfo.message });
      },
      { maxAttempts: 2, baseDelayMs: 1000 } // Retry with shorter delay for UI responsiveness
    );

    if (cancellationCheck?.()) return; // Don't update state if cancelled

    if (result.success) {
      setComments(result.data);
      setError(null); // Clear any previous errors on success

      // Log position recovery results if any comments were recovered
      const recoveredComments = result.data.filter(c => c.recovery && c.recovery.status === 'relocated');
      if (recoveredComments.length > 0) {
        Logger.info(`CommentSidebar: ${recoveredComments.length} comment(s) repositioned`, {
          recovered: recoveredComments.map(c => ({
            id: c.id,
            status: c.recovery?.status,
            matchQuality: c.recovery?.matchQuality,
            message: c.recovery?.message
          }))
        });
      }
    }

    setLoading(false);
  }, [scriptId, executeWithErrorHandling]); // Removed documentContent - no longer used

  // Note: Manual refresh removed - realtime handles all updates automatically
  // loadCommentsWithCleanup() used only for initial mount/scriptId change

  useEffect(() => {
    let isCancelled = false; // Cleanup flag for async operations

    loadCommentsWithCleanup(() => isCancelled);

    return () => {
      isCancelled = true; // Cancel any pending state updates
    };
  }, [loadCommentsWithCleanup]);

  // Realtime subscription for collaborative comments
  useEffect(() => {
    if (!scriptId) return;

    // BLOCKING ISSUE #3 FIX: Add cancellation ref to prevent timer execution after unmount
    const isCancelledRef = { current: false };

    // Create Realtime channel scoped to this script
    const channel = supabase
      .channel(`comments:${scriptId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'comments',
          // No server-side filter - RLS handles authorization, client filters by scriptId
        },
        async (payload) => {
          // Handle Realtime events
          if (payload.eventType === 'INSERT') {
            // TYPE SAFETY FIX: payload.new only contains raw table data, no JOINs
            const commentData = payload.new as {
              id: string;
              script_id: string;
              user_id: string;
              content: string;
              start_position: number;
              end_position: number;
              highlighted_text: string | null;
              parent_comment_id: string | null;
              resolved_at: string | null;
              resolved_by: string | null;
              created_at: string;
              updated_at: string;
            };

            // Client-side filter: only process comments for current script
            if (commentData.script_id !== scriptId) {
              return;
            }

            try {
              // Fetch user profile with cache (prevents N+1 queries)
              const userProfile = await fetchUserProfileCached(commentData.user_id);

              // Construct CommentWithUser with enriched data
              const commentWithUser: CommentWithUser = {
                id: commentData.id,
                scriptId: commentData.script_id,
                userId: commentData.user_id,
                content: commentData.content,
                startPosition: commentData.start_position,
                endPosition: commentData.end_position,
                highlightedText: commentData.highlighted_text || undefined,
                parentCommentId: commentData.parent_comment_id,
                resolvedAt: commentData.resolved_at,
                resolvedBy: commentData.resolved_by,
                createdAt: commentData.created_at,
                updatedAt: commentData.updated_at,
                user: userProfile || undefined
              };

              // Add new comment to state (avoid duplicates)
              setComments((prevComments) => {
                const exists = prevComments.some(c => c.id === commentWithUser.id);
                if (exists) return prevComments;
                return [...prevComments, commentWithUser];
              });

              Logger.info('Realtime comment added', { commentId: commentWithUser.id });
            } catch (err) {
              Logger.error('Failed to enrich realtime comment', { error: err, commentId: commentData.id });
            }
          } else if (payload.eventType === 'UPDATE') {
            // TYPE SAFETY FIX: Same enrichment needed for UPDATE events
            const commentData = payload.new as {
              id: string;
              script_id: string;
              user_id: string;
              content: string;
              start_position: number;
              end_position: number;
              highlighted_text: string | null;
              parent_comment_id: string | null;
              resolved_at: string | null;
              resolved_by: string | null;
              created_at: string;
              updated_at: string;
            };

            // Client-side filter: only process comments for current script
            if (commentData.script_id !== scriptId) {
              return;
            }

            try {
              // Fetch user profile with cache (prevents N+1 queries)
              const userProfile = await fetchUserProfileCached(commentData.user_id);

              // Construct CommentWithUser with enriched data
              const commentWithUser: CommentWithUser = {
                id: commentData.id,
                scriptId: commentData.script_id,
                userId: commentData.user_id,
                content: commentData.content,
                startPosition: commentData.start_position,
                endPosition: commentData.end_position,
                highlightedText: commentData.highlighted_text || undefined,
                parentCommentId: commentData.parent_comment_id,
                resolvedAt: commentData.resolved_at,
                resolvedBy: commentData.resolved_by,
                createdAt: commentData.created_at,
                updatedAt: commentData.updated_at,
                user: userProfile || undefined
              };

              // Update existing comment in state
              setComments((prevComments) =>
                prevComments.map(c =>
                  c.id === commentWithUser.id ? commentWithUser : c
                )
              );

              Logger.info('Realtime comment updated', { commentId: commentWithUser.id });
            } catch (err) {
              Logger.error('Failed to enrich realtime update', { error: err, commentId: commentData.id });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedComment = payload.old as { id: string };

            // Remove deleted comment from state
            setComments((prevComments) =>
              prevComments.filter(c => c.id !== deletedComment.id)
            );

            Logger.info('Realtime comment deleted', { commentId: deletedComment.id });
          }
        }
      )
      .subscribe((status) => {
        // Connection state machine - resilient handling instead of destructive errors
        if (status === 'SUBSCRIBED') {
          Logger.info('Realtime channel subscribed', { scriptId });
          setConnectionStatus('connected');
          reconnectionAttemptsRef.current = 0; // Reset on successful connection
          if (reconnectionTimer) {
            clearTimeout(reconnectionTimer);
            setReconnectionTimer(null);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          const eventType = status === 'CHANNEL_ERROR' ? 'error' : status === 'TIMED_OUT' ? 'timeout' : 'closed';
          Logger.warn(`Realtime channel ${eventType}`, { scriptId });

          reconnectionAttemptsRef.current += 1;
          const nextAttempt = reconnectionAttemptsRef.current;

          if (nextAttempt >= 4) {
            // After 4 failed attempts, move to degraded state
            Logger.error('Realtime connection degraded after 4 failed attempts', { scriptId });
            setConnectionStatus('degraded');
            return;
          }

          // Set reconnecting state
          setConnectionStatus('reconnecting');

          // Calculate exponential backoff with jitter: 2^attempt * 1000ms + random(0-500ms)
          const baseDelay = Math.pow(2, nextAttempt) * 1000;
          const jitter = Math.random() * 500;
          const delay = baseDelay + jitter;

          Logger.info(`Scheduling reconnection attempt ${nextAttempt}`, {
            scriptId,
            delayMs: Math.round(delay)
          });

          // Schedule reconnection attempt
          const timer = setTimeout(() => {
            // BLOCKING ISSUE #3 FIX: Check if component still mounted before executing
            if (isCancelledRef.current) {
              Logger.info('Reconnection cancelled (component unmounted)', { scriptId });
              return;
            }

            Logger.info(`Executing reconnection attempt ${nextAttempt}`, { scriptId });
            // Supabase will automatically attempt to reconnect when we try to use the channel
            channel.subscribe();
          }, delay);

          setReconnectionTimer(timer);
        }
      });

    // Cleanup: unsubscribe when scriptId changes or component unmounts
    return () => {
      // BLOCKING ISSUE #3 FIX: Mark as cancelled BEFORE cleanup to prevent timer execution
      isCancelledRef.current = true;

      Logger.info('Unsubscribing from realtime channel', { scriptId });
      if (reconnectionTimer) {
        clearTimeout(reconnectionTimer);
      }
      channel.unsubscribe();
    };
    // ESLint false positive: reconnectionTimer is managed internally and must NOT trigger re-subscription
    // Including it in deps caused infinite loop bug (subscribe→unsubscribe→close→repeat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptId, fetchUserProfileCached]);

  // Filter comments based on resolved status
  const filteredComments = comments.filter(comment => {
    if (filterMode === 'open') {
      return !comment.resolvedAt;
    } else if (filterMode === 'resolved') {
      return !!comment.resolvedAt;
    }
    return true; // 'all'
  });

  // Group comments into threads with numbering
  const commentThreads: (CommentThread & { commentNumber: number })[] = [];
  const threadMap = new Map<string, CommentThread & { commentNumber: number }>();

  // First, collect all parent comments and sort by position
  const parentComments = filteredComments
    .filter(comment => !comment.parentCommentId)
    .sort((a, b) => a.startPosition - b.startPosition);

  parentComments.forEach((comment, index) => {
    // Root comment with sequential numbering
    const thread = {
      id: comment.id,
      parentComment: comment,
      replies: [],
      isResolved: !!comment.resolvedAt,
      replyCount: 0,
      commentNumber: index + 1, // Sequential numbering starting from 1
    };
    threadMap.set(comment.id, thread);
    commentThreads.push(thread);
  });

  // Then add replies to their parent threads
  filteredComments.forEach(comment => {
    if (comment.parentCommentId) {
      // Reply comment
      const parentThread = threadMap.get(comment.parentCommentId);
      if (parentThread) {
        parentThread.replies.push(comment);
        parentThread.replyCount++;
      }
    }
  });

  // Handle comment creation using CRUD functions with error handling
  const handleCreateComment = async () => {
    if (!createComment || !commentText.trim() || !currentUser) return;

    // Don't allow comment creation on readonly placeholder scripts (no script created yet)
    if (scriptId.startsWith('readonly-')) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const commentData: CreateCommentData = {
      scriptId,
      content: commentText.trim(),
      startPosition: createComment.startPosition,
      endPosition: createComment.endPosition,
      parentCommentId: null,
      // Sanitize highlightedText to prevent XSS - plain text only for position recovery
      highlightedText: DOMPurify.sanitize(createComment.selectedText, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
      }),
    };

    const result = await executeWithErrorHandling(
      async () => {
        const response = await createCommentInDB(supabase, commentData, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create comment');
        }

        return response.data;
      },
      (errorInfo) => {
        // Set context-specific user-friendly error message
        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'create', resource: 'comment' }
        );
        setError(contextualMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setCommentText('');
      // Realtime subscription will add the comment automatically - no need to reload

      // Call the callback if provided (for parent component to reload highlights)
      if (onCommentCreated) {
        onCommentCreated(commentData);
      }
    }

    setSubmitting(false);
  };

  const handleCancelComment = () => {
    setCommentText('');
    // Notify parent to clear selection state
    if (onCommentCancelled) {
      onCommentCancelled();
    }
  };

  // Reply functionality handlers
  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyText('');
  };

  const handleReplySubmit = async (parentCommentId: string) => {
    if (!replyText.trim() || !currentUser) return;

    setSubmittingReply(true);
    setError(null);

    // Find parent comment to get position information
    const parentComment = comments.find(c => c.id === parentCommentId);

    const replyData: CreateCommentData = {
      scriptId,
      content: replyText.trim(),
      startPosition: parentComment?.startPosition || 0,
      endPosition: parentComment?.endPosition || 0,
      parentCommentId,
    };

    const result = await executeWithErrorHandling(
      async () => {
        const response = await createCommentInDB(supabase, replyData, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create reply');
        }

        return response.data;
      },
      (errorInfo) => {
        // Set context-specific user-friendly error message
        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'reply', resource: 'reply' }
        );
        setError(contextualMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      // Reset reply state
      setReplyingTo(null);
      setReplyText('');
      // Realtime subscription will add the reply automatically - no need to reload
    }

    setSubmittingReply(false);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  // FIX #3: Resolve functionality with optimistic UI mutations
  const handleResolveToggle = async (commentId: string, isCurrentlyResolved: boolean) => {
    if (!currentUser) return;

    setError(null);

    // FIX: TanStack Query mutate() uses callbacks, not try/catch (Vercel Bot analysis)
    const operation = isCurrentlyResolved ? 'unresolve' : 'resolve';
    const mutationOptions = {
      onError: (error: Error) => {
        const contextualMessage = getUserFriendlyErrorMessage(
          error,
          { operation, resource: 'comment' }
        );
        setError(contextualMessage);
      }
    };

    if (isCurrentlyResolved) {
      unresolveMutation.mutate({ commentId, scriptId }, mutationOptions);
    } else {
      resolveMutation.mutate({ commentId, scriptId }, mutationOptions);
    }
  };

  // Delete functionality handlers
  const handleDeleteClick = (commentId: string) => {
    setDeleteConfirming(commentId);
  };

  // FIX #3: Delete functionality with optimistic UI mutation
  const handleDeleteConfirm = async (commentId: string) => {
    if (!currentUser) return;

    setDeleting(true);
    setError(null);

    // FIX: TanStack Query mutate() uses callbacks, not try/catch (Vercel Bot analysis)
    // Remove dead try/catch block - error handling via onError callback
    deleteMutation.mutate(
      { commentId, scriptId },
      {
        onSuccess: () => {
          // FIX ISSUE #3B: Update local state manually (Gap G6 - legacy component with manual state)
          // Mutation updates React Query cache, but this component uses useState, not useQuery
          // Remove deleted comment from local state to match cache update
          setComments(prev => prev.filter(c => c.id !== commentId))

          // Trigger parent to remove highlight
          if (onCommentDeleted) {
            onCommentDeleted(commentId);
          }
          setDeleteConfirming(null);
          setDeleting(false);
        },
        onError: (error) => {
          const contextualMessage = getUserFriendlyErrorMessage(
            error as Error,
            { operation: 'delete', resource: 'comment' }
          );
          setError(contextualMessage);
          setDeleting(false);
        }
      }
    );
  };

  const handleDeleteCancel = () => {
    setDeleteConfirming(null);
  };

  // Edit functionality handlers
  const handleEditClick = (comment: CommentWithUser) => {
    setEditing(comment.id);
    setEditText(comment.content);
  };

  const handleEditSubmit = async (commentId: string) => {
    if (!editText.trim() || !currentUser) return;

    setSubmittingEdit(true);
    setError(null);

    const result = await executeWithErrorHandling(
      async () => {
        const response = await updateComment(supabase, commentId, { content: editText.trim() }, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to update comment');
        }

        return response.data;
      },
      (errorInfo) => {
        // Set context-specific user-friendly error message
        const contextualMessage = getUserFriendlyErrorMessage(
          new Error(errorInfo.message),
          { operation: 'update', resource: 'comment' }
        );
        setError(contextualMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setEditing(null);
      setEditText('');
      // Realtime subscription will update the comment automatically - no need to reload
    }

    setSubmittingEdit(false);
  };

  const handleEditCancel = () => {
    setEditing(null);
    setEditText('');
  };

  // Check if current user can delete a comment (author or admin)
  const canDeleteComment = (comment: CommentWithUser) => {
    return currentUser && comment.userId === currentUser.id;
  };

  // Check if current user can edit a comment (author only)
  const canEditComment = (comment: CommentWithUser) => {
    return currentUser && comment.userId === currentUser.id;
  };

  if (loading) {
    return (
      <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
        <div role="status" aria-label="Loading Comments">
          Loading comments...
        </div>
      </aside>
    );
  }

  // Render connection status banner (non-destructive overlay)
  const renderConnectionBanner = () => {
    if (connectionStatus === 'reconnecting') {
      return (
        <div className="connection-status-banner reconnecting" role="status">
          <span>Reconnecting to live updates...</span>
        </div>
      );
    }

    if (connectionStatus === 'degraded') {
      return (
        <div className="connection-status-banner degraded" role="alert">
          <span>Connection degraded. Some features may be unavailable.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="reconnect-button"
          >
            Reconnect
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
      {/* Connection Status Banner (non-destructive overlay) */}
      {renderConnectionBanner()}

      {/* Priority 4: Sticky Header Container - stays visible while comments scroll */}
      <div className="comments-sticky-header">
        {/* Header */}
        <header role="banner" aria-label="Comments Header">
          <h2>Comments</h2>
        </header>

        {/* Inline Error Display for Operations */}
        {error && (
          <div className="inline-error" role="alert">
            <div className="error-content">
              <span className="error-icon-small">⚠️</span>
              <span className="error-message-small">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="error-dismiss"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="comment-filters">
          <button
            type="button"
            aria-label="All Comments"
            className={filterMode === 'all' ? 'active' : ''}
            onClick={() => setFilterMode('all')}
          >
            All Comments
          </button>
          <button
            type="button"
            aria-label="Open Comments"
            className={filterMode === 'open' ? 'active' : ''}
            onClick={() => setFilterMode('open')}
          >
            Open Comments
          </button>
          <button
            type="button"
            aria-label="Resolved Comments"
            className={filterMode === 'resolved' ? 'active' : ''}
            onClick={() => setFilterMode('resolved')}
          >
            Resolved Comments
          </button>
        </div>
      </div>

      {/* Comment Creation Form */}
      {createComment && (
        <form role="form" aria-label="New Comment" onSubmit={(e) => { e.preventDefault(); handleCreateComment(); }}>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            aria-label="Comment Text"
            disabled={submitting}
          />
          <div className="form-actions">
            <button
              type="submit"
              aria-label="Submit"
              disabled={!commentText.trim() || submitting || connectionStatus !== 'connected'}
            >
              Submit
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={handleCancelComment}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="comments-list">
        {commentThreads.length === 0 ? (
          <div className="empty-state">
            <p>No comments yet.</p>
            <p>Select text to add a comment.</p>
          </div>
        ) : (
          commentThreads.map((thread) => (
            <div key={thread.id} className="comment-thread">
              {/* Parent Comment */}
              <article
                role="article"
                className={`comment-card ${thread.isResolved ? 'comment-resolved' : ''}`}
                data-comment-id={thread.parentComment.id}
                onMouseEnter={() => {
                  // Highlight corresponding text when hovering comment
                  const highlight = document.querySelector(`[data-comment-id="${thread.parentComment.id}"].comment-highlight`);
                  if (highlight) {
                    highlight.classList.add('highlight-hover');
                  }
                }}
                onMouseLeave={() => {
                  // Remove highlight when leaving comment
                  const highlight = document.querySelector(`[data-comment-id="${thread.parentComment.id}"].comment-highlight`);
                  if (highlight) {
                    highlight.classList.remove('highlight-hover');
                  }
                }}
              >
                <div className="comment-header">
                  <div className="comment-number-badge">{thread.commentNumber}</div>
                  <span className="comment-author">{thread.parentComment.user?.displayName || thread.parentComment.user?.email || 'Unknown'}</span>
                  <span className="comment-date">{new Date(thread.parentComment.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Conditional rendering: Edit form or comment content */}
                {editing === thread.parentComment.id ? (
                  <div className="edit-form">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      aria-label="Edit Comment Text"
                      disabled={submittingEdit}
                      className="edit-textarea"
                    />
                    <div className="form-actions">
                      <button
                        type="button"
                        aria-label="Save Edit"
                        onClick={() => handleEditSubmit(thread.parentComment.id)}
                        disabled={!editText.trim() || submittingEdit}
                      >
                        {submittingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel Edit"
                        onClick={handleEditCancel}
                        disabled={submittingEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="comment-content">{thread.parentComment.content}</div>
                    <div className="comment-actions">
                      <button
                        type="button"
                        aria-label="Reply"
                        onClick={() => handleReplyClick(thread.parentComment.id)}
                      >
                        Reply
                      </button>
                      {thread.isResolved ? (
                        <button
                          type="button"
                          aria-label="Reopen"
                          onClick={() => handleResolveToggle(thread.parentComment.id, true)}
                        >
                          Reopen
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label="Resolve"
                          onClick={() => handleResolveToggle(thread.parentComment.id, false)}
                        >
                          Resolve
                        </button>
                      )}
                      {canEditComment(thread.parentComment) && (
                        <button
                          type="button"
                          aria-label="Edit"
                          onClick={() => handleEditClick(thread.parentComment)}
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteComment(thread.parentComment) && (
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => handleDeleteClick(thread.parentComment.id)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </article>

              {/* Reply Form for Parent Comment */}
              {replyingTo === thread.parentComment.id && (
                <form
                  role="form"
                  aria-label="Reply Form"
                  className="reply-form"
                  onSubmit={(e) => { e.preventDefault(); handleReplySubmit(thread.parentComment.id); }}
                >
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply..."
                    aria-label="Reply Text"
                    disabled={submittingReply}
                  />
                  <div className="form-actions">
                    <button
                      type="submit"
                      aria-label="Submit Reply"
                      disabled={!replyText.trim() || submittingReply || connectionStatus !== 'connected'}
                    >
                      Submit Reply
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel Reply"
                      onClick={handleCancelReply}
                      disabled={submittingReply}
                    >
                      Cancel Reply
                    </button>
                  </div>
                </form>
              )}

              {/* Replies */}
              {thread.replies.map((reply) => (
                <div key={reply.id}>
                  <article
                    role="article"
                    className="comment-card comment-reply"
                  >
                    <div className="comment-header">
                      <span className="comment-author">{reply.user?.displayName || reply.user?.email || 'Unknown'}</span>
                      <span className="comment-date">{new Date(reply.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Conditional rendering: Edit form or comment content */}
                    {editing === reply.id ? (
                      <div className="edit-form">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          aria-label="Edit Comment Text"
                          disabled={submittingEdit}
                          className="edit-textarea"
                        />
                        <div className="form-actions">
                          <button
                            type="button"
                            aria-label="Save Edit"
                            onClick={() => handleEditSubmit(reply.id)}
                            disabled={!editText.trim() || submittingEdit}
                          >
                            {submittingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            aria-label="Cancel Edit"
                            onClick={handleEditCancel}
                            disabled={submittingEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="comment-content">{reply.content}</div>
                        <div className="comment-actions">
                          <button
                            type="button"
                            aria-label="Reply"
                            onClick={() => handleReplyClick(reply.id)}
                          >
                            Reply
                          </button>
                          {canEditComment(reply) && (
                            <button
                              type="button"
                              aria-label="Edit"
                              onClick={() => handleEditClick(reply)}
                            >
                              Edit
                            </button>
                          )}
                          {canDeleteComment(reply) && (
                            <button
                              type="button"
                              aria-label="Delete"
                              onClick={() => handleDeleteClick(reply.id)}
                              className="delete-button"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </article>

                  {/* Reply Form for Reply Comment */}
                  {replyingTo === reply.id && (
                    <form
                      role="form"
                      aria-label="Reply Form"
                      className="reply-form nested-reply"
                      onSubmit={(e) => { e.preventDefault(); handleReplySubmit(thread.parentComment.id); }}
                    >
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        aria-label="Reply Text"
                        disabled={submittingReply}
                      />
                      <div className="form-actions">
                        <button
                          type="submit"
                          aria-label="Submit Reply"
                          disabled={!replyText.trim() || submittingReply || connectionStatus !== 'connected'}
                        >
                          Submit Reply
                        </button>
                        <button
                          type="button"
                          aria-label="Cancel Reply"
                          onClick={handleCancelReply}
                          disabled={submittingReply}
                        >
                          Cancel Reply
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirming && (
        <div
          role="dialog"
          aria-label="Delete Comment"
          className="delete-dialog-overlay"
          onClick={(e) => e.target === e.currentTarget && handleDeleteCancel()}
        >
          <div className="delete-dialog">
            <h3>Delete Comment</h3>
            <p>Are you sure you want to delete this comment? This action cannot be undone.</p>
            <div className="dialog-actions">
              <button
                type="button"
                aria-label="Confirm Delete"
                onClick={() => handleDeleteConfirm(deleteConfirming)}
                disabled={deleting}
                className="confirm-delete-button"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                type="button"
                aria-label="Cancel Delete"
                onClick={handleDeleteCancel}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .comments-sidebar {
          width: 300px;
          height: 100%;
          border-left: 1px solid #e5e7eb;
          background: white;
          padding: 16px;
          overflow-y: auto;
        }

        /* Priority 4: Sticky header container for header + filters */
        .comments-sticky-header {
          position: sticky;
          top: 0;
          background: white;
          z-index: 10;
          padding-bottom: 8px;
          margin-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .comment-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .comment-filters button {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          cursor: pointer;
        }

        .comment-filters button.active {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .empty-state {
          text-align: center;
          color: #6b7280;
          padding: 32px 16px;
        }

        .comment-thread {
          margin-bottom: 16px;
        }

        .comment-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .comment-card:hover {
          border-color: #3B82F6;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
        }

        .comment-card.highlight-hover {
          border-color: #F59E0B;
          background-color: #FFFBEB;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15);
        }

        .comment-reply {
          margin-left: 24px;
          border-left: 3px solid #3b82f6;
        }

        .comment-resolved {
          background: #f3f4f6;
          opacity: 0.8;
        }

        .comment-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
          gap: 8px;
        }

        .comment-number-badge {
          background: #3B82F6;
          color: white;
          font-size: 10px;
          font-weight: bold;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          flex-shrink: 0;
        }

        .comment-author {
          font-weight: 600;
        }

        .comment-date {
          color: #6b7280;
        }

        .comment-content {
          margin-bottom: 8px;
          line-height: 1.4;
        }

        .comment-actions {
          display: flex;
          gap: 8px;
        }

        .comment-actions button {
          padding: 2px 8px;
          border: none;
          background: none;
          color: #3b82f6;
          cursor: pointer;
          font-size: 12px;
        }

        .comment-actions button:hover {
          text-decoration: underline;
        }

        form {
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }

        textarea {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          resize: vertical;
          font-family: inherit;
        }

        .form-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .form-actions button {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
        }

        .form-actions button[type="submit"] {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }

        .form-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .reply-form {
          margin: 8px 0 16px 16px;
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .reply-form.nested-reply {
          margin-left: 32px;
          background: #e5e7eb;
        }

        /* Edit Form Styling */
        .edit-form {
          margin: 8px 0;
        }

        .edit-textarea {
          width: 100%;
          min-height: 60px;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
        }

        .delete-button {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        .delete-button:hover {
          background: #dc2626;
          border-color: #dc2626;
        }

        .delete-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .delete-dialog {
          background: white;
          padding: 24px;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          width: 90%;
        }

        .delete-dialog h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
        }

        .delete-dialog p {
          margin: 0 0 20px 0;
          color: #6b7280;
        }

        .dialog-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .confirm-delete-button {
          background: #ef4444;
          color: white;
          border-color: #ef4444;
        }

        .confirm-delete-button:hover {
          background: #dc2626;
          border-color: #dc2626;
        }

        /* Error State Styling */
        .error-state {
          padding: 20px;
          text-align: center;
        }

        .error-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 16px;
          padding: 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
        }

        .error-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .error-text h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .error-text p {
          margin: 0;
          font-size: 14px;
          color: #7f1d1d;
          line-height: 1.4;
        }

        .error-actions {
          display: flex;
          justify-content: center;
        }

        .retry-button {
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .retry-button:hover {
          background: #b91c1c;
        }

        /* Inline Error Styling */
        .inline-error {
          margin: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 12px;
        }

        .error-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .error-icon-small {
          font-size: 16px;
          color: #dc2626;
          flex-shrink: 0;
        }

        .error-message-small {
          flex: 1;
          font-size: 13px;
          color: #7f1d1d;
          line-height: 1.4;
        }

        .error-dismiss {
          background: none;
          border: none;
          color: #7f1d1d;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .error-dismiss:hover {
          background: rgba(127, 29, 29, 0.1);
        }
      `}</style>
    </aside>
  );
};
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

import React, { useState, useEffect, useCallback } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommentWithUser, CommentThread, CreateCommentData } from '../../types/comments';
import { getComments, createComment as createCommentInDB } from '../../lib/comments';
import { Logger } from '../../services/logger';
import { useErrorHandling } from '../../utils/errorHandling';

export interface CommentSidebarProps {
  scriptId: string;
  createComment?: {
    startPosition: number;
    endPosition: number;
    selectedText: string;
  } | null;
  onCommentCreated?: () => void;
  onCommentCancelled?: () => void;
  documentContent?: string; // For position recovery
}

type FilterMode = 'all' | 'open' | 'resolved';

export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  scriptId,
  createComment,
  onCommentCreated,
  onCommentCancelled,
  documentContent
}) => {
  const { currentUser } = useAuth();
  const { executeWithErrorHandling } = useErrorHandling('comment operations');
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // commentId being replied to
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Delete functionality state
  const [deleteConfirming, setDeleteConfirming] = useState<string | null>(null); // commentId being confirmed for deletion
  const [deleting, setDeleting] = useState(false);

  // Edit functionality state
  const [editing, setEditing] = useState<string | null>(null); // commentId being edited
  const [editText, setEditText] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Unified comment loading function with optional cancellation check
  const loadCommentsWithCleanup = useCallback(async (cancellationCheck?: () => boolean) => {
    // PRIORITY 1 FIX: Clear comments immediately when scriptId changes to prevent stale data
    setComments([]);
    setLoading(true);
    setError(null);

    const result = await executeWithErrorHandling(
      async () => {
        // Pass documentContent for position recovery if available
        const response = await getComments(supabase, scriptId, undefined, documentContent);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to load comments');
        }

        return response.data || [];
      },
      (errorInfo) => {
        if (cancellationCheck?.()) return; // Don't update state if cancelled

        // Set user-friendly error message
        setError(errorInfo.userMessage);
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
  }, [scriptId, documentContent, executeWithErrorHandling]);

  // Load comments without cancellation check (for manual refresh)
  const loadComments = useCallback(() => {
    loadCommentsWithCleanup(); // No cancellation check
  }, [loadCommentsWithCleanup]);

  useEffect(() => {
    let isCancelled = false; // Cleanup flag for async operations

    loadCommentsWithCleanup(() => isCancelled);

    return () => {
      isCancelled = true; // Cancel any pending state updates
    };
  }, [loadCommentsWithCleanup]);

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
        // Set user-friendly error message
        setError(errorInfo.userMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setCommentText('');
      await loadComments(); // Refresh comments to show the new one

      // Call the callback if provided (for parent component to reload highlights)
      if (onCommentCreated) {
        onCommentCreated();
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
        // Set user-friendly error message
        setError(errorInfo.userMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      // Reset reply state
      setReplyingTo(null);
      setReplyText('');
      await loadComments(); // Refresh comments to show the new reply
    }

    setSubmittingReply(false);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  // Resolve functionality handlers with error handling
  const handleResolveToggle = async (commentId: string, isCurrentlyResolved: boolean) => {
    if (!currentUser) return;

    setError(null);

    const result = await executeWithErrorHandling(
      async () => {
        // Import resolve/unresolve functions dynamically to work with module mocks in tests
        const { resolveComment, unresolveComment } = await import('../../lib/comments');

        // Toggle based on current resolved state
        const response = isCurrentlyResolved
          ? await unresolveComment(supabase, commentId, currentUser.id)
          : await resolveComment(supabase, commentId, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || `Failed to ${isCurrentlyResolved ? 'reopen' : 'resolve'} comment`);
        }

        return response.data;
      },
      (errorInfo) => {
        // Set user-friendly error message
        setError(errorInfo.userMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      await loadComments(); // Refresh comments to show the updated state
    }
  };

  // Delete functionality handlers
  const handleDeleteClick = (commentId: string) => {
    setDeleteConfirming(commentId);
  };

  const handleDeleteConfirm = async (commentId: string) => {
    if (!currentUser) return;

    setDeleting(true);
    setError(null);

    const result = await executeWithErrorHandling(
      async () => {
        // Import deleteComment function dynamically to work with module mocks in tests
        const { deleteComment } = await import('../../lib/comments');

        const response = await deleteComment(supabase, commentId, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to delete comment');
        }

        return response.data;
      },
      (errorInfo) => {
        // Set user-friendly error message
        setError(errorInfo.userMessage);
      },
      { maxAttempts: 1, baseDelayMs: 500 } // Only retry once for delete operations
    );

    if (result.success) {
      setDeleteConfirming(null);
      await loadComments(); // Refresh comments to show the updated state
    }

    setDeleting(false);
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
        // Import updateComment function dynamically to work with module mocks in tests
        const { updateComment } = await import('../../lib/comments');

        const response = await updateComment(supabase, commentId, { content: editText.trim() }, currentUser.id);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to update comment');
        }

        return response.data;
      },
      (errorInfo) => {
        // Set user-friendly error message
        setError(errorInfo.userMessage);
      },
      { maxAttempts: 2, baseDelayMs: 500 }
    );

    if (result.success) {
      setEditing(null);
      setEditText('');
      await loadComments(); // Refresh comments to show the updated content
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

  if (error) {
    return (
      <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
        <div className="error-state">
          <div role="alert" className="error-message">
            <div className="error-icon">⚠️</div>
            <div className="error-text">
              <h3>Unable to load comments</h3>
              <p>{error}</p>
            </div>
          </div>
          <div className="error-actions">
            <button
              type="button"
              onClick={() => {
                setError(null);
                loadComments();
              }}
              className="retry-button"
            >
              Try Again
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
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
              disabled={!commentText.trim() || submitting}
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
                  <span className="comment-author">{thread.parentComment.user?.email || 'Unknown'}</span>
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
                      disabled={!replyText.trim() || submittingReply}
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
                      <span className="comment-author">{reply.user?.email || 'Unknown'}</span>
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
                          disabled={!replyText.trim() || submittingReply}
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
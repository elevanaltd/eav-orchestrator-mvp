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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { CommentWithUser, CommentThread, CreateCommentData } from '../../types/comments';
import { getComments, createComment as createCommentInDB } from '../../lib/comments';

export interface CommentSidebarProps {
  scriptId: string;
  createComment?: {
    startPosition: number;
    endPosition: number;
    selectedText: string;
  } | null;
  onCommentCreated?: (data: CreateCommentData) => void;
}

type FilterMode = 'all' | 'open' | 'resolved';

export const CommentSidebar: React.FC<CommentSidebarProps> = ({
  scriptId,
  createComment,
  onCommentCreated
}) => {
  const { currentUser } = useAuth();
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

  // Load comments from database using CRUD functions
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getComments(supabase, scriptId);

      if (!result.success) {
        setError(result.error?.message || 'Error loading comments');
        console.error('Comment loading error:', result.error);
        return;
      }

      setComments(result.data || []);
    } catch (err) {
      setError('Error loading comments');
      console.error('Comment loading error:', err);
    } finally {
      setLoading(false);
    }
  }, [scriptId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

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

  // Handle comment creation using CRUD functions
  const handleCreateComment = async () => {
    if (!createComment || !commentText.trim() || !currentUser) return;

    try {
      setSubmitting(true);
      const commentData: CreateCommentData = {
        scriptId,
        content: commentText.trim(),
        startPosition: createComment.startPosition,
        endPosition: createComment.endPosition,
        parentCommentId: null,
      };

      // Create comment in database using CRUD function
      const result = await createCommentInDB(supabase, commentData, currentUser.id);

      if (!result.success) {
        setError(result.error?.message || 'Error creating comment');
        console.error('Comment creation error:', result.error);
        return;
      }

      // Call the callback if provided (for parent component notifications)
      if (onCommentCreated) {
        onCommentCreated(commentData);
      }

      setCommentText('');
      await loadComments(); // Refresh comments to show the new one
    } catch (err) {
      console.error('Error creating comment:', err);
      setError('Error creating comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelComment = () => {
    setCommentText('');
  };

  // Reply functionality handlers
  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyText('');
  };

  const handleReplySubmit = async (parentCommentId: string) => {
    if (!replyText.trim() || !currentUser) return;

    try {
      setSubmittingReply(true);
      const replyData: CreateCommentData = {
        scriptId,
        content: replyText.trim(),
        // For replies, use the parent comment's position since they share the same text selection
        startPosition: 0, // Will be updated based on parent comment's position
        endPosition: 0,
        parentCommentId,
      };

      // Find parent comment to get position information
      const parentComment = comments.find(c => c.id === parentCommentId);
      if (parentComment) {
        replyData.startPosition = parentComment.startPosition;
        replyData.endPosition = parentComment.endPosition;
      }

      // Create reply in database using CRUD function
      const result = await createCommentInDB(supabase, replyData, currentUser.id);

      if (!result.success) {
        setError(result.error?.message || 'Error creating reply');
        console.error('Reply creation error:', result.error);
        return;
      }

      // Reset reply state
      setReplyingTo(null);
      setReplyText('');
      await loadComments(); // Refresh comments to show the new reply
    } catch (err) {
      console.error('Error creating reply:', err);
      setError('Error creating reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  // Resolve functionality handlers
  const handleResolveToggle = async (commentId: string, isCurrentlyResolved: boolean) => {
    if (!currentUser) return;

    try {
      // Import resolve/unresolve functions dynamically to work with module mocks in tests
      const { resolveComment, unresolveComment } = await import('../../lib/comments');

      // Toggle based on current resolved state
      const result = isCurrentlyResolved
        ? await unresolveComment(supabase, commentId, currentUser.id)
        : await resolveComment(supabase, commentId, currentUser.id);

      if (!result.success) {
        setError(result.error?.message || `Error ${isCurrentlyResolved ? 'reopening' : 'resolving'} comment`);
        console.error('Resolve toggle error:', result.error);
        return;
      }

      await loadComments(); // Refresh comments to show the updated state
    } catch (err) {
      console.error(`Error ${isCurrentlyResolved ? 'reopening' : 'resolving'} comment:`, err);
      setError(`Error ${isCurrentlyResolved ? 'reopening' : 'resolving'} comment`);
    }
  };

  // Delete functionality handlers
  const handleDeleteClick = (commentId: string) => {
    setDeleteConfirming(commentId);
  };

  const handleDeleteConfirm = async (commentId: string) => {
    if (!currentUser) return;

    try {
      setDeleting(true);
      // Import deleteComment function dynamically to work with module mocks in tests
      const { deleteComment } = await import('../../lib/comments');

      const result = await deleteComment(supabase, commentId, currentUser.id);

      if (!result.success) {
        setError(result.error?.message || 'Error deleting comment');
        console.error('Delete comment error:', result.error);
        return;
      }

      setDeleteConfirming(null);
      await loadComments(); // Refresh comments to show the updated state
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Error deleting comment');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirming(null);
  };

  // Check if current user can delete a comment (author or admin)
  const canDeleteComment = (comment: CommentWithUser) => {
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
        <div role="alert">
          Error loading comments
        </div>
      </aside>
    );
  }

  return (
    <aside className="comments-sidebar" role="complementary" aria-label="Comments Sidebar">
      {/* Header */}
      <header role="banner" aria-label="Comments Header">
        <h2>Comments</h2>
      </header>

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
                    <div className="comment-content">{reply.content}</div>
                    <div className="comment-actions">
                      <button
                        type="button"
                        aria-label="Reply"
                        onClick={() => handleReplyClick(reply.id)}
                      >
                        Reply
                      </button>
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
      `}</style>
    </aside>
  );
};
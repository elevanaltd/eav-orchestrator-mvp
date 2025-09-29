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

  // Group comments into threads
  const commentThreads: CommentThread[] = [];
  const threadMap = new Map<string, CommentThread>();

  filteredComments.forEach(comment => {
    if (!comment.parentCommentId) {
      // Root comment
      const thread: CommentThread = {
        id: comment.id,
        parentComment: comment,
        replies: [],
        isResolved: !!comment.resolvedAt,
        replyCount: 0
      };
      threadMap.set(comment.id, thread);
      commentThreads.push(thread);
    } else {
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
              >
                <div className="comment-header">
                  <span className="comment-author">{thread.parentComment.user?.email || 'Unknown'}</span>
                  <span className="comment-date">{new Date(thread.parentComment.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="comment-content">{thread.parentComment.content}</div>
                <div className="comment-actions">
                  <button type="button" aria-label="Reply">Reply</button>
                  {thread.isResolved ? (
                    <button type="button" aria-label="Reopen">Reopen</button>
                  ) : (
                    <button type="button" aria-label="Resolve">Resolve</button>
                  )}
                </div>
              </article>

              {/* Replies */}
              {thread.replies.map((reply) => (
                <article
                  key={reply.id}
                  role="article"
                  className="comment-card comment-reply"
                >
                  <div className="comment-header">
                    <span className="comment-author">{reply.user?.email || 'Unknown'}</span>
                    <span className="comment-date">{new Date(reply.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="comment-content">{reply.content}</div>
                  <div className="comment-actions">
                    <button type="button" aria-label="Reply">Reply</button>
                  </div>
                </article>
              ))}
            </div>
          ))
        )}
      </div>

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
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 12px;
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
      `}</style>
    </aside>
  );
};
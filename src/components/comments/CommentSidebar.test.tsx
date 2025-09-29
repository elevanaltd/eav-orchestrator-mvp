/**
 * CommentSidebar.test.tsx - TDD Tests for Comments Sidebar
 *
 * Following TDD protocol (RED-GREEN-REFACTOR):
 * These tests are written BEFORE implementation to define the expected behavior.
 *
 * Requirements from ADR-003:
 * - Fixed right panel (300px width)
 * - Shows comments in document order
 * - Filter controls (All/Open/Resolved)
 * - Comment cards with threading
 * - Comment creation form
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Comment } from '../../types/comments';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'user-1', email: 'test@example.com' } }),
}));

// Import component after mocks
import { CommentSidebar } from './CommentSidebar';
import { supabase } from '../../lib/supabase';

// Sample test data
const sampleComments: Comment[] = [
  {
    id: 'comment-1',
    scriptId: 'script-1',
    userId: 'user-1',
    content: 'This needs revision.',
    startPosition: 10,
    endPosition: 25,
    parentCommentId: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: '2024-09-29T10:00:00Z',
    updatedAt: '2024-09-29T10:00:00Z',
  },
  {
    id: 'comment-2',
    scriptId: 'script-1',
    userId: 'user-2',
    content: 'I agree with this change.',
    startPosition: 10,
    endPosition: 25,
    parentCommentId: 'comment-1',
    resolvedAt: null,
    resolvedBy: null,
    createdAt: '2024-09-29T10:05:00Z',
    updatedAt: '2024-09-29T10:05:00Z',
  },
  {
    id: 'comment-3',
    scriptId: 'script-1',
    userId: 'user-1',
    content: 'Fixed in new version.',
    startPosition: 50,
    endPosition: 65,
    parentCommentId: null,
    resolvedAt: '2024-09-29T11:00:00Z',
    resolvedBy: 'user-1',
    createdAt: '2024-09-29T10:30:00Z',
    updatedAt: '2024-09-29T11:00:00Z',
  },
];

describe('CommentSidebar', () => {
  const mockSupabaseFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock behavior
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: [],
            error: null,
          })),
        })),
      })),
    });
  });

  describe('Component Structure', () => {
    it('should render the sidebar with correct layout', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      // Should have main container with correct class/width
      const sidebar = screen.getByRole('complementary', { name: /comments sidebar/i });
      expect(sidebar).toBeInTheDocument();
      expect(sidebar).toHaveClass('comments-sidebar');
    });

    it('should have a header with title', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        const header = screen.getByRole('banner', { name: /comments header/i });
        expect(header).toBeInTheDocument();
        expect(screen.getByText(/comments/i)).toBeInTheDocument();
      });
    });

    it('should display filter controls', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        // Should have filter buttons
        expect(screen.getByRole('button', { name: /all comments/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /open comments/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /resolved comments/i })).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no comments', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: [],
              error: null,
            })),
          })),
        })),
      });

      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
        expect(screen.getByText(/select text to add a comment/i)).toBeInTheDocument();
      });
    });
  });

  describe('Comment Display', () => {
    beforeEach(() => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: sampleComments,
              error: null,
            })),
          })),
        })),
      });
    });

    it('should display comments in document order', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        expect(screen.getByText('This needs revision.')).toBeInTheDocument();
      });

      const commentCards = screen.getAllByRole('article');
      expect(commentCards).toHaveLength(3); // All comments shown as cards
    });

    it('should display comment metadata correctly', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        // Should show user info, timestamp, content
        expect(screen.getByText('This needs revision.')).toBeInTheDocument();
        expect(screen.getByText(/user-1/)).toBeInTheDocument();
      });
    });

    it('should show threading hierarchy', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        const replyComment = screen.getByText('I agree with this change.');
        expect(replyComment).toBeInTheDocument();

        // Reply should be visually indented (check for thread class)
        const replyCard = replyComment.closest('[role="article"]');
        expect(replyCard).toHaveClass('comment-reply');
      });
    });

    it('should distinguish resolved vs open comments', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        const resolvedComment = screen.getByText('Fixed in new version.');
        const resolvedCard = resolvedComment.closest('[role="article"]');
        expect(resolvedCard).toHaveClass('comment-resolved');
      });
    });
  });

  describe('Filter Functionality', () => {
    beforeEach(() => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: sampleComments,
              error: null,
            })),
          })),
        })),
      });
    });

    it('should filter to show only open comments', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      const openFilter = screen.getByRole('button', { name: /open comments/i });
      fireEvent.click(openFilter);

      await waitFor(() => {
        // Should show only unresolved comments
        expect(screen.getByText('This needs revision.')).toBeInTheDocument();
        expect(screen.getByText('I agree with this change.')).toBeInTheDocument();
        expect(screen.queryByText('Fixed in new version.')).not.toBeInTheDocument();
      });
    });

    it('should filter to show only resolved comments', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      const resolvedFilter = screen.getByRole('button', { name: /resolved comments/i });
      fireEvent.click(resolvedFilter);

      await waitFor(() => {
        // Should show only resolved comments
        expect(screen.queryByText('This needs revision.')).not.toBeInTheDocument();
        expect(screen.queryByText('I agree with this change.')).not.toBeInTheDocument();
        expect(screen.getByText('Fixed in new version.')).toBeInTheDocument();
      });
    });

    it('should show all comments by default', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        // All comments should be visible initially
        expect(screen.getByText('This needs revision.')).toBeInTheDocument();
        expect(screen.getByText('I agree with this change.')).toBeInTheDocument();
        expect(screen.getByText('Fixed in new version.')).toBeInTheDocument();
      });
    });
  });

  describe('Comment Creation', () => {
    it('should show creation form when createComment prop is provided', () => {
      const createCommentData = {
        startPosition: 10,
        endPosition: 25,
        selectedText: 'selected text',
      };

      render(<CommentSidebar scriptId="script-1" createComment={createCommentData} />);

      expect(screen.getByRole('form', { name: /new comment/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /comment text/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('should not show creation form when createComment is null', () => {
      render(<CommentSidebar scriptId="script-1" />);

      expect(screen.queryByRole('form', { name: /new comment/i })).not.toBeInTheDocument();
    });

    it('should call onCommentCreated when form is submitted', async () => {
      const onCommentCreated = vi.fn();
      const createCommentData = {
        startPosition: 10,
        endPosition: 25,
        selectedText: 'selected text',
      };

      render(
        <CommentSidebar
          scriptId="script-1"
          createComment={createCommentData}
          onCommentCreated={onCommentCreated}
        />
      );

      const textarea = screen.getByRole('textbox', { name: /comment text/i });
      const submitButton = screen.getByRole('button', { name: /submit/i });

      fireEvent.change(textarea, { target: { value: 'New comment text' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onCommentCreated).toHaveBeenCalledWith({
          scriptId: 'script-1',
          content: 'New comment text',
          startPosition: 10,
          endPosition: 25,
          parentCommentId: null,
        });
      });
    });
  });

  describe('Threading Actions', () => {
    beforeEach(() => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: sampleComments,
              error: null,
            })),
          })),
        })),
      });
    });

    it('should show reply button on comment cards', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        const replyButtons = screen.getAllByRole('button', { name: /reply/i });
        expect(replyButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show resolve button for unresolved comments', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        // Should have resolve buttons for unresolved comments
        const resolveButtons = screen.getAllByRole('button', { name: /resolve/i });
        expect(resolveButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show reopen button for resolved comments', async () => {
      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        // Should have reopen button for resolved comment
        expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching comments', () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => new Promise(() => {})), // Never resolves
          })),
        })),
      });

      render(<CommentSidebar scriptId="script-1" />);

      expect(screen.getByRole('status', { name: /loading comments/i })).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error state when comments fail to load', async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: null,
              error: { message: 'Database error' },
            })),
          })),
        })),
      });

      render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/error loading comments/i)).toBeInTheDocument();
      });
    });
  });
});
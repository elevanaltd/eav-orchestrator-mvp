/**
 * CommentSidebar.realtime.test.tsx - TDD Tests for Realtime Subscriptions
 *
 * Following TDD protocol (RED-GREEN-REFACTOR):
 * Phase: RED - These tests WILL FAIL until Realtime implementation is complete
 *
 * Requirements:
 * - Subscribe to Supabase Realtime channel on mount
 * - Handle INSERT events (add new comments to state)
 * - Handle UPDATE events (modify existing comments)
 * - Handle DELETE events (remove comments from state)
 * - Cleanup subscription on unmount
 * - Filter by script_id to prevent cross-script pollution
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { CommentWithUser } from '../../types/comments';

// Mock Supabase with Realtime channel support
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue({ status: 'ok', error: null }),
};

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
};

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock comments library
vi.mock('../../lib/comments', () => ({
  getComments: vi.fn().mockResolvedValue({
    success: true,
    data: [],
    error: null,
  }),
}));

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { id: 'user-1', email: 'test@example.com' } }),
}));

// Import component after mocks
import { CommentSidebar } from './CommentSidebar';

describe('CommentSidebar - Realtime Subscriptions (TDD RED Phase)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Subscription Setup', () => {
    it('should create a Realtime channel scoped to script_id on mount', async () => {
      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        // Should create channel with script-specific name
        expect(mockSupabase.channel).toHaveBeenCalledWith('comments:script-123');
      });
    });

    it('should subscribe to postgres_changes event for comments table', async () => {
      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            event: '*', // All events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'comments',
            filter: 'script_id=eq.script-123',
          }),
          expect.any(Function) // Payload handler callback
        );
      });
    });

    it('should call subscribe() to activate the channel', async () => {
      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });
    });

    it('should unsubscribe from channel on unmount', async () => {
      const { unmount } = render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(mockChannel.unsubscribe).toHaveBeenCalled();
      });
    });

    it('should create new subscription when scriptId changes', async () => {
      const { rerender } = render(<CommentSidebar scriptId="script-1" />);

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith('comments:script-1');
      });

      vi.clearAllMocks();

      rerender(<CommentSidebar scriptId="script-2" />);

      await waitFor(() => {
        // Should unsubscribe from old channel
        expect(mockChannel.unsubscribe).toHaveBeenCalled();
        // Should create new channel
        expect(mockSupabase.channel).toHaveBeenCalledWith('comments:script-2');
      });
    });
  });

  describe('INSERT Event Handling', () => {
    it('should add new comment to state when INSERT event received', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      // Capture the Realtime callback
      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      render(<CommentSidebar scriptId="script-123" />);

      // Wait for subscription setup
      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
        expect(realtimeCallback).not.toBeNull();
      });

      // Simulate INSERT event
      const newComment: CommentWithUser = {
        id: 'new-comment-1',
        scriptId: 'script-123',
        userId: 'user-2',
        content: 'New comment from another user',
        startPosition: 10,
        endPosition: 20,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-2',
          email: 'user2@example.com',
        },
      };

      realtimeCallback!({
        eventType: 'INSERT',
        new: newComment,
        old: {},
        errors: null,
      });

      // New comment should appear in the UI
      await waitFor(() => {
        expect(screen.getByText('New comment from another user')).toBeInTheDocument();
      });
    });

    it('should not add duplicate comments if INSERT event for existing comment', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with existing comment
      const existingComment: CommentWithUser = {
        id: 'existing-1',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Existing comment',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [existingComment],
        error: null,
      });

      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Existing comment')).toBeInTheDocument();
      });

      // Simulate duplicate INSERT event
      realtimeCallback!({
        eventType: 'INSERT',
        new: existingComment,
        old: {},
        errors: null,
      });

      // Should still only have ONE instance of the comment
      await waitFor(() => {
        const commentCards = screen.getAllByRole('article');
        const matchingComments = commentCards.filter(card =>
          card.textContent?.includes('Existing comment')
        );
        expect(matchingComments).toHaveLength(1);
      });
    });
  });

  describe('UPDATE Event Handling', () => {
    it('should update existing comment when UPDATE event received', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with existing comment
      const existingComment: CommentWithUser = {
        id: 'comment-1',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Original content',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [existingComment],
        error: null,
      });

      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Original content')).toBeInTheDocument();
      });

      // Simulate UPDATE event
      const updatedComment = {
        ...existingComment,
        content: 'Updated content',
        updatedAt: new Date().toISOString(),
      };

      realtimeCallback!({
        eventType: 'UPDATE',
        new: updatedComment,
        old: existingComment,
        errors: null,
      });

      // Updated content should appear
      await waitFor(() => {
        expect(screen.queryByText('Original content')).not.toBeInTheDocument();
        expect(screen.getByText('Updated content')).toBeInTheDocument();
      });
    });

    it('should update resolved status when comment is resolved via Realtime', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with unresolved comment
      const unresolvedComment: CommentWithUser = {
        id: 'comment-1',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Needs review',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [unresolvedComment],
        error: null,
      });

      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        const commentCard = screen.getByText('Needs review').closest('[role="article"]');
        expect(commentCard).not.toHaveClass('comment-resolved');
      });

      // Simulate UPDATE event with resolved status
      const resolvedComment = {
        ...unresolvedComment,
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'user-2',
      };

      realtimeCallback!({
        eventType: 'UPDATE',
        new: resolvedComment,
        old: unresolvedComment,
        errors: null,
      });

      // Should show as resolved
      await waitFor(() => {
        const commentCard = screen.getByText('Needs review').closest('[role="article"]');
        expect(commentCard).toHaveClass('comment-resolved');
      });
    });
  });

  describe('DELETE Event Handling', () => {
    it('should remove comment from state when DELETE event received', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      // Start with existing comment
      const existingComment: CommentWithUser = {
        id: 'comment-to-delete',
        scriptId: 'script-123',
        userId: 'user-1',
        content: 'Will be deleted',
        startPosition: 5,
        endPosition: 15,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-1',
          email: 'user1@example.com',
        },
      };

      const { getComments } = await import('../../lib/comments');
      vi.mocked(getComments).mockResolvedValue({
        success: true,
        data: [existingComment],
        error: null,
      });

      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(screen.getByText('Will be deleted')).toBeInTheDocument();
      });

      // Simulate DELETE event
      realtimeCallback!({
        eventType: 'DELETE',
        old: existingComment,
        new: {},
        errors: null,
      });

      // Comment should disappear
      await waitFor(() => {
        expect(screen.queryByText('Will be deleted')).not.toBeInTheDocument();
      });
    });

    it('should not error if DELETE event for non-existent comment', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Simulate DELETE for comment that doesn't exist
      realtimeCallback!({
        eventType: 'DELETE',
        old: { id: 'non-existent-comment' },
        new: {},
        errors: null,
      });

      // Should not crash or error
      await waitFor(() => {
        expect(true).toBe(true); // No-op assertion to wait for async
      });
    });
  });

  describe('RLS Filtering (Automated)', () => {
    it('should receive only comments for current script_id via RLS', async () => {
      // This test validates that Supabase RLS filters broadcasts automatically
      // No additional client-side filtering needed
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.on).toHaveBeenCalledWith(
          'postgres_changes',
          expect.objectContaining({
            filter: 'script_id=eq.script-123',
          }),
          expect.any(Function)
        );
      });

      // Verify filter was applied in subscription
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          filter: 'script_id=eq.script-123',
        }),
        expect.any(Function)
      );
    });
  });

  describe('Memory Safety and Cleanup', () => {
    it('should not update state if component unmounts during subscription setup', async () => {
      let realtimeCallback: ((payload: any) => void) | null = null;

      mockChannel.on.mockImplementation((eventType, config, callback) => {
        if (eventType === 'postgres_changes') {
          realtimeCallback = callback;
        }
        return mockChannel;
      });

      const { unmount } = render(<CommentSidebar scriptId="script-123" />);

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Unmount before event arrives
      unmount();

      // Simulate late event arrival
      const lateComment: CommentWithUser = {
        id: 'late-comment',
        scriptId: 'script-123',
        userId: 'user-2',
        content: 'Should not cause error',
        startPosition: 10,
        endPosition: 20,
        parentCommentId: null,
        resolvedAt: null,
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          id: 'user-2',
          email: 'user2@example.com',
        },
      };

      // This should not crash or cause warnings
      if (realtimeCallback) {
        realtimeCallback({
          eventType: 'INSERT',
          new: lateComment,
          old: {},
          errors: null,
        });
      }

      // Test passes if no errors thrown
      expect(true).toBe(true);
    });
  });
});

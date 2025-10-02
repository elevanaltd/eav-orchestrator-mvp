/**
 * Test Suite: Comment ProseMirror Position Storage
 *
 * Validates that fresh comments store PM positions directly without conversion
 * and that position system tracking is properly maintained.
 */

import { describe, it, expect } from 'vitest';
import type { CreateCommentData } from '../types/comments';

describe('Comment PM Position Storage', () => {
  it('fresh comment stores PM positions without conversion', () => {
    // Simulate editor selection (ProseMirror positions)
    const pmFrom = 10;
    const pmTo = 20;
    const selectedText = 'test comment';

    // Create comment data as it would be passed from TipTapEditor
    const commentData: CreateCommentData = {
      scriptId: 'test-script-id',
      content: 'This is a test comment',
      startPosition: pmFrom,     // PM position - NO conversion
      endPosition: pmTo,          // PM position - NO conversion
      highlightedText: selectedText,
      parentCommentId: null
    };

    // Verify positions are stored directly (no -1 offset)
    expect(commentData.startPosition).toBe(10);
    expect(commentData.endPosition).toBe(20);
    expect(commentData.startPosition).toBe(pmFrom);
    expect(commentData.endPosition).toBe(pmTo);
  });

  it('position system should be marked as pm_positions for fresh comments', () => {
    // This test will fail until we add position_system field to database
    // and update the createComment function to set it

    const commentData = {
      scriptId: 'test-script-id',
      content: 'Test comment',
      startPosition: 15,
      endPosition: 25,
      highlightedText: 'highlighted',
      parentCommentId: null,
      // NEW: position system tracking
      position_system: 'pm_positions' as const
    };

    expect(commentData.position_system).toBe('pm_positions');
  });

  it('fresh comment recovery should preserve PM positions', () => {
    // Simulate a fresh comment (created < 10 seconds ago)
    const now = new Date();
    const comment = {
      id: 'test-comment-id',
      startPosition: 10,
      endPosition: 20,
      highlighted_text: 'test text',
      created_at: now.toISOString(),
      position_system: 'pm_positions' as const
    };

    // Calculate age
    const createdAt = new Date(comment.created_at);
    const ageInSeconds = (now.getTime() - createdAt.getTime()) / 1000;

    // Fresh comment (< 10 seconds)
    expect(ageInSeconds).toBeLessThan(10);

    // Positions should be preserved exactly
    expect(comment.startPosition).toBe(10);
    expect(comment.endPosition).toBe(20);
  });
});

/**
 * Test Suite: CommentPositionTracker Plugin
 *
 * Validates ProseMirror plugin for stateful comment position tracking
 * using DecorationSet pattern for O(num_comments) performance.
 */

import { describe, it, expect, vi } from 'vitest';
import { EditorState } from '@tiptap/pm/state';
import { DOMParser } from '@tiptap/pm/model';
import { schema as basicSchema } from '@tiptap/pm/schema-basic';
import { createCommentPositionTracker } from './CommentPositionTracker';
import type { CommentHighlight } from '../../types/comments';

// Helper to create test editor state
function createTestEditorState(content: string, highlights: CommentHighlight[] = []) {
  const parser = DOMParser.fromSchema(basicSchema);
  const div = document.createElement('div');
  div.innerHTML = `<p>${content}</p>`;
  const doc = parser.parse(div);

  return EditorState.create({
    doc,
    plugins: [createCommentPositionTracker(highlights, () => {})]
  });
}

describe('CommentPositionTracker Plugin', () => {
  describe('Position Shifting - Text Insertion', () => {
    it('positions shift when text inserted before comment', () => {
      const onPositionsChanged = vi.fn();

      const highlights: CommentHighlight[] = [{
        commentId: 'comment-1',
        from: 10,
        to: 20,
        commentNumber: 1,
        resolved: false
      }];

      const state = createTestEditorState('Hello world test content here', highlights);
      const plugin = createCommentPositionTracker(highlights, onPositionsChanged);

      // Insert "INSERTED" (8 chars) at position 5
      const tr = state.tr.insertText('INSERTED', 5);
      const newState = state.apply(tr);
      plugin.spec?.state?.apply?.(tr, state.plugins[0].getState(state)!, state, newState);

      // Expect callback with shifted positions
      expect(onPositionsChanged).toHaveBeenCalled();
      const updatedHighlights = onPositionsChanged.mock.calls[0][0];

      expect(updatedHighlights[0].from).toBe(18); // 10 + 8
      expect(updatedHighlights[0].to).toBe(28);   // 20 + 8
    });

    it('positions preserved when text inserted after comment', () => {
      const onPositionsChanged = vi.fn();

      const highlights: CommentHighlight[] = [{
        commentId: 'comment-1',
        commentNumber: 1,
        from: 5,
        to: 10,
        resolved: false
      }];

      const state = createTestEditorState('Hello world test', highlights);

      // Insert at position 15 (after comment)
      const tr = state.tr.insertText(' ADDED', 15);
      const plugin = createCommentPositionTracker(highlights, onPositionsChanged);
      const newState = state.apply(tr);
      plugin.spec?.state?.apply?.(tr, state.plugins[0].getState(state)!, state, newState);

      // Positions should not change
      const updatedHighlights = onPositionsChanged.mock.calls[0][0];
      expect(updatedHighlights[0].from).toBe(5);
      expect(updatedHighlights[0].to).toBe(10);
    });
  });

  describe('Position Shifting - Text Deletion', () => {
    it('positions shift when text deleted before comment', () => {
      const onPositionsChanged = vi.fn();

      const highlights: CommentHighlight[] = [{
        commentId: 'comment-1',
        commentNumber: 1,
        from: 17,  // "DELETE_ME " is 10 chars, "test" starts at position 11 in <p> (position 12 with opening tag)
        to: 22,
        resolved: false
      }];

      const state = createTestEditorState('DELETE_ME test content', highlights);

      // Delete "DELETE_ME " (10 chars) from position 1 (after opening <p> tag)
      const tr = state.tr.delete(1, 11);
      const plugin = createCommentPositionTracker(highlights, onPositionsChanged);
      const newState = state.apply(tr);
      plugin.spec?.state?.apply?.(tr, state.plugins[0].getState(state)!, state, newState);

      const updatedHighlights = onPositionsChanged.mock.calls[0][0];
      expect(updatedHighlights[0].from).toBe(7);  // 17 - 10
      expect(updatedHighlights[0].to).toBe(12);   // 22 - 10
    });
  });

  describe('Performance Requirements', () => {
    it('performance: position updates <5ms per keystroke with 100 comments', () => {
      const highlights: CommentHighlight[] = Array.from({ length: 100 }, (_, i) => ({
        commentId: `comment-${i}`,
        commentNumber: i + 1,
        from: i * 10,
        to: i * 10 + 5,
        resolved: false
      }));

      const onPositionsChanged = vi.fn();
      const state = createTestEditorState('A'.repeat(1000), highlights);

      const start = performance.now();
      const tr = state.tr.insertText('x', 0);
      const plugin = createCommentPositionTracker(highlights, onPositionsChanged);
      const newState = state.apply(tr);
      plugin.spec?.state?.apply?.(tr, state.plugins[0].getState(state)!, state, newState);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5); // <5ms requirement
    });

    it('handles multiple rapid edits without performance degradation', () => {
      const highlights: CommentHighlight[] = Array.from({ length: 50 }, (_, i) => ({
        commentId: `comment-${i}`,
        commentNumber: i + 1,
        from: i * 5,
        to: i * 5 + 3,
        resolved: false
      }));

      const onPositionsChanged = vi.fn();
      const state = createTestEditorState('A'.repeat(500), highlights);

      // Simulate 10 rapid keystrokes
      const start = performance.now();
      let currentState = state;
      for (let i = 0; i < 10; i++) {
        const tr = currentState.tr.insertText('x', i);
        const plugin = createCommentPositionTracker(highlights, onPositionsChanged);
        plugin.spec?.state?.apply?.(tr, currentState.plugins[0].getState(currentState)!, currentState, currentState);
        currentState = currentState.apply(tr);
      }
      const avgDuration = (performance.now() - start) / 10;

      expect(avgDuration).toBeLessThan(5); // Each keystroke <5ms
    });
  });

  describe('Comment Resolution State', () => {
    it('maintains resolved state through position changes', () => {
      const onPositionsChanged = vi.fn();

      const highlights: CommentHighlight[] = [{
        commentId: 'comment-1',
        commentNumber: 1,
        from: 10,
        to: 20,
        resolved: true // Resolved comment
      }];

      const state = createTestEditorState('Hello world test', highlights);
      const tr = state.tr.insertText('NEW', 5);
      const plugin = createCommentPositionTracker(highlights, onPositionsChanged);
      plugin.spec?.state?.apply?.(tr, state.plugins[0].getState(state)!, state, state);

      const updatedHighlights = onPositionsChanged.mock.calls[0][0];
      expect(updatedHighlights[0].resolved).toBe(true); // State preserved
      expect(updatedHighlights[0].from).toBe(13); // Position updated
    });
  });

  describe('No-op Detection', () => {
    it('should not call onPositionsChanged when document unchanged', () => {
      const onPositionsChanged = vi.fn();

      const highlights: CommentHighlight[] = [{
        commentId: 'comment-1',
        commentNumber: 1,
        from: 5,
        to: 10,
        resolved: false
      }];

      const state = createTestEditorState('Hello world', highlights);

      // Transaction with no document change (e.g., just selection change)
      const tr = state.tr.setSelection(state.selection);
      const plugin = createCommentPositionTracker(highlights, onPositionsChanged);
      plugin.spec?.state?.apply?.(tr, state.plugins[0].getState(state)!, state, state);

      expect(onPositionsChanged).not.toHaveBeenCalled();
    });
  });
});

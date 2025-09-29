/**
 * CommentHighlightExtension Tests
 *
 * TDD Tests for the TipTap Comment Highlight Mark Extension
 * These tests MUST fail first to demonstrate TDD discipline
 *
 * Based on ADR-003 Google Docs-style commenting system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentHighlightExtension } from './CommentHighlightExtension';

describe('CommentHighlightExtension - TDD', () => {
  let editor: Editor;

  beforeEach(() => {
    // This will fail until we create the extension
    editor = new Editor({
      extensions: [
        StarterKit,
        CommentHighlightExtension,
      ],
      content: '<p>This is a test document with some content to highlight.</p>',
    });
  });

  afterEach(() => {
    editor?.destroy();
  });

  describe('Extension Registration', () => {
    it('should register as a mark extension', () => {
      // This will fail - extension doesn't exist yet
      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'commentHighlight'
      );

      expect(extension).toBeDefined();
      expect(extension?.type).toBe('mark');
    });

    it('should have the correct name', () => {
      // This will fail - extension doesn't exist yet
      expect(CommentHighlightExtension.name).toBe('commentHighlight');
    });
  });

  describe('Comment Highlighting Commands', () => {
    it('should add comment highlight command', () => {
      // This will fail - extension doesn't exist yet
      const hasAddCommand = editor.commands.addCommentHighlight;
      expect(hasAddCommand).toBeDefined();
      expect(typeof hasAddCommand).toBe('function');
    });

    it('should remove comment highlight command', () => {
      // This will fail - extension doesn't exist yet
      const hasRemoveCommand = editor.commands.removeCommentHighlight;
      expect(hasRemoveCommand).toBeDefined();
      expect(typeof hasRemoveCommand).toBe('function');
    });

    it('should toggle comment highlight command', () => {
      // This will fail - extension doesn't exist yet
      const hasToggleCommand = editor.commands.toggleCommentHighlight;
      expect(hasToggleCommand).toBeDefined();
      expect(typeof hasToggleCommand).toBe('function');
    });
  });

  describe('Mark Application', () => {
    it('should apply comment highlight to selected text', () => {
      // This will fail - extension doesn't exist yet
      const content = 'This is a test document';
      editor.commands.setContent(`<p>${content}</p>`);

      // Select "test document" (positions 10-23)
      editor.commands.setTextSelection({ from: 11, to: 24 });

      const result = editor.commands.addCommentHighlight({
        commentId: 'comment-123',
        from: 11,
        to: 24
      });

      expect(result).toBe(true);

      // Check that the mark was applied
      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');
      expect(html).toContain('class="comment-highlight"');
    });

    it('should remove comment highlight by comment ID', () => {
      // This will fail - extension doesn't exist yet
      const content = 'This is a test document';
      editor.commands.setContent(`<p>${content}</p>`);

      // First add a highlight
      editor.commands.setTextSelection({ from: 11, to: 24 });
      editor.commands.addCommentHighlight({
        commentId: 'comment-123',
        from: 11,
        to: 24
      });

      // Verify it was added
      let html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');

      // Now remove it
      const result = editor.commands.removeCommentHighlight('comment-123');
      expect(result).toBe(true);

      // Verify it was removed
      html = editor.getHTML();
      expect(html).not.toContain('data-comment-id="comment-123"');
      expect(html).not.toContain('class="comment-highlight"');
    });
  });

  describe('HTML Parsing and Rendering', () => {
    it('should parse comment highlights from HTML', () => {
      // This will fail - extension doesn't exist yet
      const htmlWithHighlight = '<p>This is <mark data-comment-id="comment-123" class="comment-highlight">highlighted text</mark> in a paragraph.</p>';

      editor.commands.setContent(htmlWithHighlight);

      // Check that the comment highlight was parsed correctly
      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-123"');
      expect(html).toContain('class="comment-highlight"');
    });

    it('should render comment highlights as mark elements', () => {
      // This will fail - extension doesn't exist yet
      editor.commands.setContent('<p>Test content</p>');
      editor.commands.setTextSelection({ from: 1, to: 5 });

      editor.commands.addCommentHighlight({
        commentId: 'comment-456',
        from: 1,
        to: 5
      });

      const html = editor.getHTML();
      expect(html).toMatch(/<mark[^>]*data-comment-id="comment-456"[^>]*>/);
      expect(html).toContain('class="comment-highlight"');
    });
  });

  describe('Comment ID Management', () => {
    it('should store and retrieve comment ID attributes', () => {
      // This will fail - extension doesn't exist yet
      const testCommentId = 'comment-789';

      editor.commands.setContent('<p>Test content for comment ID</p>');
      editor.commands.setTextSelection({ from: 1, to: 8 });

      editor.commands.addCommentHighlight({
        commentId: testCommentId,
        from: 1,
        to: 8
      });

      const html = editor.getHTML();
      expect(html).toContain(`data-comment-id="${testCommentId}"`);
    });

    it('should handle multiple comment highlights with different IDs', () => {
      // This will fail - extension doesn't exist yet
      const content = 'First highlight and second highlight in text';
      editor.commands.setContent(`<p>${content}</p>`);

      // Add first highlight
      editor.commands.setTextSelection({ from: 1, to: 6 }); // "First"
      editor.commands.addCommentHighlight({
        commentId: 'comment-1',
        from: 1,
        to: 6
      });

      // Add second highlight
      editor.commands.setTextSelection({ from: 21, to: 27 }); // "second"
      editor.commands.addCommentHighlight({
        commentId: 'comment-2',
        from: 21,
        to: 27
      });

      const html = editor.getHTML();
      expect(html).toContain('data-comment-id="comment-1"');
      expect(html).toContain('data-comment-id="comment-2"');

      // Both highlights should be present
      const commentMatches = html.match(/data-comment-id="/g);
      expect(commentMatches).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty selections gracefully', () => {
      // This will fail - extension doesn't exist yet
      editor.commands.setContent('<p>Test content</p>');

      // Try to add highlight to empty selection (same from/to positions)
      const result = editor.commands.addCommentHighlight({
        commentId: 'comment-empty',
        from: 5,
        to: 5
      });

      expect(result).toBe(false);
    });

    it('should handle removing non-existent comment IDs gracefully', () => {
      // This will fail - extension doesn't exist yet
      editor.commands.setContent('<p>Test content</p>');

      // Try to remove a comment that doesn't exist
      const result = editor.commands.removeCommentHighlight('non-existent-comment');

      // Should still return true (operation completed without error)
      expect(result).toBe(true);
    });
  });
});
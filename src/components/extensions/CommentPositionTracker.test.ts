/**
 * CommentPositionTracker Tests - RED PHASE
 *
 * TDD Tests for ProseMirror plugin that automatically updates comment positions
 * as document changes using transaction.mapping.map()
 *
 * These tests MUST fail first to demonstrate TDD discipline
 *
 * Based on ADR-005: Scenario 3 - Comments track text during edits
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CommentHighlightExtension } from './CommentHighlightExtension';
import { CommentPositionTracker } from './CommentPositionTracker';

/**
 * Type definition for comment highlight used by position tracker
 */
interface CommentHighlight {
  commentId: string;
  commentNumber: number;
  startPosition: number;
  endPosition: number;
  resolved?: boolean;
}

/**
 * Test editor helper interface
 */
interface TestEditor extends Editor {
  getCommentById: (commentId: string) => CommentHighlight | undefined;
}

/**
 * Helper function to create test editor with comment position tracking
 */
function createTestEditor(options: {
  content: string;
  comments?: CommentHighlight[];
  onPositionUpdate?: (comments: CommentHighlight[]) => void;
}): TestEditor {
  const { content, comments = [], onPositionUpdate } = options;

  // Create editor with extensions
  const editor = new Editor({
    extensions: [
      StarterKit,
      CommentHighlightExtension,
      CommentPositionTracker.configure({
        onPositionUpdate: onPositionUpdate || (() => {}),
      }),
    ],
    content: `<p>${content}</p>`,
  }) as TestEditor;

  // Load existing comments
  if (comments.length > 0) {
    editor.commands.loadExistingHighlights(comments);
  }

  // Add helper method to get comment by ID
  editor.getCommentById = (commentId: string): CommentHighlight | undefined => {
    const highlights: CommentHighlight[] = [];

    // Extract comment positions from editor state
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.marks) {
        node.marks.forEach((mark) => {
          if (mark.type.name === 'commentHighlight') {
            const from = pos;
            const to = pos + node.nodeSize;

            // Check if this is the comment we're looking for
            if (mark.attrs.commentId === commentId) {
              highlights.push({
                commentId: mark.attrs.commentId,
                commentNumber: mark.attrs.commentNumber,
                startPosition: from,
                endPosition: to,
                resolved: mark.attrs.resolved,
              });
            }
          }
        });
      }
    });

    return highlights[0]; // Return first match (should be only one per ID)
  };

  return editor;
}

describe('CommentPositionTracker - TDD RED Phase', () => {
  let editor: TestEditor;

  afterEach(() => {
    editor?.destroy();
  });

  describe('Extension Registration', () => {
    it('should register as a plugin extension', () => {
      // This will fail - extension doesn't exist yet
      editor = createTestEditor({ content: 'Test content' });

      const extension = editor.extensionManager.extensions.find(
        ext => ext.name === 'commentPositionTracker'
      );

      expect(extension).toBeDefined();
      expect(extension?.type).toBe('extension');
    });

    it('should have the correct name', () => {
      // This will fail - extension doesn't exist yet
      expect(CommentPositionTracker.name).toBe('commentPositionTracker');
    });
  });

  describe('Position Tracking - Text Insertion Before Comment', () => {
    it('should update comment positions when text inserted before', () => {
      // Setup: Create editor with comment at positions 10-20
      editor = createTestEditor({
        content: 'Start text here for testing positions',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 11, // Position of "text" in "Start text"
            endPosition: 20,  // Position after "text here"
          }
        ]
      });

      // Action: Insert 8 characters at the beginning
      editor.commands.insertContentAt(0, 'INSERTED ');

      // Assert: Positions should shift by +8
      const comment = editor.getCommentById('c1');
      expect(comment).toBeDefined();
      expect(comment?.startPosition).toBe(19); // 11 + 8
      expect(comment?.endPosition).toBe(28);   // 20 + 8
    });

    it('should handle multiple character insertions before comment', () => {
      editor = createTestEditor({
        content: 'Original text for testing',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 10,
            endPosition: 15,
          }
        ]
      });

      // Insert text at position 0
      editor.commands.insertContentAt(0, 'NEW CONTENT '); // 12 characters

      const comment = editor.getCommentById('c1');
      expect(comment?.startPosition).toBe(22); // 10 + 12
      expect(comment?.endPosition).toBe(27);   // 15 + 12
    });
  });

  describe('Position Tracking - Text Insertion After Comment', () => {
    it('should NOT update positions when text inserted after comment', () => {
      editor = createTestEditor({
        content: 'Start text here for testing positions',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 11,
            endPosition: 20,
          }
        ]
      });

      // Insert text after comment (position 30)
      editor.commands.insertContentAt(30, ' APPENDED');

      const comment = editor.getCommentById('c1');
      expect(comment?.startPosition).toBe(11); // Unchanged
      expect(comment?.endPosition).toBe(20);   // Unchanged
    });
  });

  describe('Position Tracking - Text Deletion Before Comment', () => {
    it('should shift positions left when text deleted before comment', () => {
      editor = createTestEditor({
        content: 'DELETE_THIS Start text here',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 19, // Position after "DELETE_THIS "
            endPosition: 28,
          }
        ]
      });

      // Delete "DELETE_THIS " (12 characters)
      editor.commands.deleteRange({ from: 1, to: 13 });

      const comment = editor.getCommentById('c1');
      expect(comment?.startPosition).toBe(7);  // 19 - 12
      expect(comment?.endPosition).toBe(16);   // 28 - 12
    });

    it('should handle large deletions before comment', () => {
      editor = createTestEditor({
        content: 'REMOVE ALL OF THIS CONTENT BEFORE COMMENT stays',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 39, // "COMMENT"
            endPosition: 46,
          }
        ]
      });

      // Delete "REMOVE ALL OF THIS CONTENT BEFORE " (35 characters)
      editor.commands.deleteRange({ from: 1, to: 36 });

      const comment = editor.getCommentById('c1');
      expect(comment?.startPosition).toBe(4);  // 39 - 35
      expect(comment?.endPosition).toBe(11);   // 46 - 35
    });
  });

  describe('Position Tracking - Multiple Comments', () => {
    it('should update all comment positions when text inserted', () => {
      editor = createTestEditor({
        content: 'First comment and second comment here',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 1,  // "First"
            endPosition: 6,
          },
          {
            commentId: 'c2',
            commentNumber: 2,
            startPosition: 19, // "second"
            endPosition: 25,
          }
        ]
      });

      // Insert at beginning
      editor.commands.insertContentAt(0, 'NEW '); // 4 characters

      const c1 = editor.getCommentById('c1');
      const c2 = editor.getCommentById('c2');

      expect(c1?.startPosition).toBe(5);  // 1 + 4
      expect(c1?.endPosition).toBe(10);   // 6 + 4
      expect(c2?.startPosition).toBe(23); // 19 + 4
      expect(c2?.endPosition).toBe(29);   // 25 + 4
    });

    it('should only update comments after insertion point', () => {
      editor = createTestEditor({
        content: 'First comment and second comment here',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 1,  // "First"
            endPosition: 6,
          },
          {
            commentId: 'c2',
            commentNumber: 2,
            startPosition: 19, // "second"
            endPosition: 25,
          }
        ]
      });

      // Insert between the two comments (position 10)
      editor.commands.insertContentAt(10, 'MIDDLE '); // 7 characters

      const c1 = editor.getCommentById('c1');
      const c2 = editor.getCommentById('c2');

      expect(c1?.startPosition).toBe(1);  // Unchanged (before insertion)
      expect(c1?.endPosition).toBe(6);    // Unchanged
      expect(c2?.startPosition).toBe(26); // 19 + 7 (after insertion)
      expect(c2?.endPosition).toBe(32);   // 25 + 7
    });
  });

  describe('Position Tracking - Undo/Redo', () => {
    it('should maintain correct positions through undo/redo', () => {
      editor = createTestEditor({
        content: 'Text for undo test',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 6,
            endPosition: 9,
          }
        ]
      });

      // Insert text
      editor.commands.insertContentAt(0, 'NEW ');
      expect(editor.getCommentById('c1')?.startPosition).toBe(10); // 6 + 4

      // Undo
      editor.commands.undo();
      expect(editor.getCommentById('c1')?.startPosition).toBe(6); // Back to original

      // Redo
      editor.commands.redo();
      expect(editor.getCommentById('c1')?.startPosition).toBe(10); // Forward again
    });

    it('should handle multiple undo/redo cycles', () => {
      editor = createTestEditor({
        content: 'Test content',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 6,
            endPosition: 13,
          }
        ]
      });

      // First edit
      editor.commands.insertContentAt(0, 'A ');
      expect(editor.getCommentById('c1')?.startPosition).toBe(8);

      // Second edit
      editor.commands.insertContentAt(0, 'B ');
      expect(editor.getCommentById('c1')?.startPosition).toBe(10);

      // Undo twice
      editor.commands.undo();
      expect(editor.getCommentById('c1')?.startPosition).toBe(8);
      editor.commands.undo();
      expect(editor.getCommentById('c1')?.startPosition).toBe(6);

      // Redo twice
      editor.commands.redo();
      expect(editor.getCommentById('c1')?.startPosition).toBe(8);
      editor.commands.redo();
      expect(editor.getCommentById('c1')?.startPosition).toBe(10);
    });
  });

  describe('DB Sync Debouncing', () => {
    it('should debounce DB updates during rapid edits', async () => {
      const mockUpdate = vi.fn();

      editor = createTestEditor({
        content: 'Test content',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 6,
            endPosition: 13,
          }
        ],
        onPositionUpdate: mockUpdate
      });

      // Rapid edits
      editor.commands.insertContentAt(0, 'A');
      editor.commands.insertContentAt(0, 'B');
      editor.commands.insertContentAt(0, 'C');

      // Should NOT have synced yet
      expect(mockUpdate).not.toHaveBeenCalled();

      // Wait for debounce (500ms)
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should have synced once with all position updates
      expect(mockUpdate).toHaveBeenCalledOnce();
    });

    it('should pass correct comment data to onPositionUpdate callback', async () => {
      const mockUpdate = vi.fn();

      editor = createTestEditor({
        content: 'Test content',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 6,
            endPosition: 13,
          }
        ],
        onPositionUpdate: mockUpdate
      });

      // Make an edit
      editor.commands.insertContentAt(0, 'NEW ');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));

      // Verify callback was called with updated positions
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 10, // 6 + 4
            endPosition: 17,   // 13 + 4
          })
        ])
      );
    });

    it('should reset debounce timer on each edit', async () => {
      const mockUpdate = vi.fn();

      editor = createTestEditor({
        content: 'Test content',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 6,
            endPosition: 13,
          }
        ],
        onPositionUpdate: mockUpdate
      });

      // First edit
      editor.commands.insertContentAt(0, 'A');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Second edit (should reset timer)
      editor.commands.insertContentAt(0, 'B');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Third edit (should reset timer again)
      editor.commands.insertContentAt(0, 'C');

      // Should still not have called yet (timer keeps resetting)
      expect(mockUpdate).not.toHaveBeenCalled();

      // Wait for final debounce
      await new Promise(resolve => setTimeout(resolve, 600));

      // Now should have called
      expect(mockUpdate).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it('should handle insertion at exact comment start position', () => {
      editor = createTestEditor({
        content: 'Test content here',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 6,
            endPosition: 13,
          }
        ]
      });

      // Insert at exact start position
      editor.commands.insertContentAt(6, 'INSERT ');

      const comment = editor.getCommentById('c1');
      // Comment should shift right
      expect(comment?.startPosition).toBeGreaterThan(6);
    });

    it('should handle deletion that overlaps comment start', () => {
      editor = createTestEditor({
        content: 'REMOVE_THIS content here',
        comments: [
          {
            commentId: 'c1',
            commentNumber: 1,
            startPosition: 13, // "content"
            endPosition: 20,
          }
        ]
      });

      // Delete range that includes content before comment
      editor.commands.deleteRange({ from: 1, to: 13 });

      const comment = editor.getCommentById('c1');
      expect(comment?.startPosition).toBe(1); // Shifted left
    });

    it('should handle empty document state', () => {
      editor = createTestEditor({
        content: '',
        comments: []
      });

      // Insert into empty document
      editor.commands.setContent('<p>New content</p>');

      // Should not crash
      expect(editor.state.doc.textContent).toBe('New content');
    });
  });
});

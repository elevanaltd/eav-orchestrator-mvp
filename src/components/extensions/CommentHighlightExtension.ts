/**
 * CommentHighlightExtension - TipTap Mark for Comment Highlights
 *
 * Implementation of Google Docs-style comment highlighting using TipTap marks.
 * Based on ADR-003 architecture requirements.
 *
 * Features:
 * - Mark-based highlighting (non-intrusive to document structure)
 * - Comment ID tracking for database integration
 * - Position-based anchoring support
 * - Visual highlighting with CSS classes
 */

import { Mark, markInputRule, mergeAttributes } from '@tiptap/core';

// Mark input rule for comment highlighting (currently not used, but could be extended)
// Note: type will be resolved at runtime when extension is registered
const commentHighlightInputRule = markInputRule({
  find: /(?:\*\*)([^*]+)(?:\*\*)/g,
  type: 'commentHighlight' as never, // Will be resolved by TipTap at runtime
});

export interface CommentHighlightOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentHighlight: {
      /**
       * Add a comment highlight mark to the selected text
       */
      addCommentHighlight: (attributes: { commentId: string; from: number; to: number }) => ReturnType;
      /**
       * Remove comment highlight by comment ID
       */
      removeCommentHighlight: (commentId: string) => ReturnType;
      /**
       * Toggle comment highlight
       */
      toggleCommentHighlight: (attributes: { commentId: string }) => ReturnType;
    };
  }
}

/**
 * CommentHighlightExtension
 *
 * Creates a TipTap Mark that can highlight text without affecting document structure.
 * Each highlight is associated with a comment ID for database correlation.
 */
export const CommentHighlightExtension = Mark.create<CommentHighlightOptions>({
  name: 'commentHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) {
            return {};
          }
          return {
            'data-comment-id': attributes.commentId,
            'class': 'comment-highlight',
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'mark[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      addCommentHighlight:
        (attributes) =>
        ({ commands }) => {
          const { from, to, commentId } = attributes;

          if (from === to) {
            return false;
          }

          // Apply the comment highlight mark to the specified range
          return commands.setMark(this.name, { commentId });
        },

      removeCommentHighlight:
        (commentId) =>
        ({ state, dispatch }) => {
          const { tr } = state;
          const { doc } = tr;

          // Find all comment highlights with the specified commentId
          doc.descendants((node, pos) => {
            if (node.isText && node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === 'commentHighlight' && mark.attrs.commentId === commentId) {
                  const from = pos;
                  const to = pos + node.nodeSize;
                  tr.removeMark(from, to, mark.type);
                }
              });
            }
          });

          if (dispatch) {
            dispatch(tr);
          }

          return true;
        },

      toggleCommentHighlight:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
    };
  },

  addInputRules() {
    return [commentHighlightInputRule];
  },
});
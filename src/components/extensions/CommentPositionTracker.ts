/**
 * CommentPositionTracker - Stateful ProseMirror Plugin
 *
 * Tracks comment positions using DecorationSet for O(num_comments) performance.
 * Automatically updates positions when document changes through edit operations.
 *
 * Architecture:
 * - Uses ProseMirror's mapping system for automatic position tracking
 * - DecorationSet.map() handles position updates efficiently
 * - Callbacks notify of position changes for DB persistence
 * - No manual document traversal needed
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DecorationSet, Decoration } from '@tiptap/pm/view';
import type { CommentHighlight } from '../../types/comments';

export const CommentPositionTrackerKey = new PluginKey('commentPositionTracker');

/**
 * Create comment position tracker plugin
 *
 * @param initialHighlights - Initial comment positions
 * @param onPositionsChanged - Callback when positions change (debounced in Phase 5)
 * @returns ProseMirror plugin instance
 */
export function createCommentPositionTracker(
  initialHighlights: CommentHighlight[],
  onPositionsChanged: (highlights: CommentHighlight[]) => void
) {
  return new Plugin({
    key: CommentPositionTrackerKey,

    state: {
      init(_, state) {
        // Create initial DecorationSet from highlights
        const decorations = initialHighlights.map(h =>
          Decoration.inline(h.from, h.to, {
            class: h.resolved ? 'comment-highlight comment-resolved' : 'comment-highlight',
            'data-comment-id': h.commentId,
            'data-comment-number': (h.commentNumber ?? 0).toString(),
            'data-resolved': (h.resolved ?? false).toString()
          })
        );
        return DecorationSet.create(state.doc, decorations);
      },

      apply(tr, decorationSet) {
        // Skip processing if document unchanged
        if (!tr.docChanged) {
          return decorationSet;
        }

        // Map decorations through transaction (O(num_comments) not O(doc_size))
        const mapped = decorationSet.map(tr.mapping, tr.doc);

        // Extract updated positions and notify
        const updatedHighlights: CommentHighlight[] = [];
        mapped.find().forEach(decoration => {
          // Access decoration attributes
          const attrs = (decoration as any).type.attrs;
          updatedHighlights.push({
            commentId: attrs['data-comment-id'],
            commentNumber: parseInt(attrs['data-comment-number']) || undefined,
            from: decoration.from,
            to: decoration.to,
            resolved: attrs['data-resolved'] === 'true' || undefined
          });
        });

        // Notify callback with updated positions (will be debounced in Phase 5)
        if (updatedHighlights.length > 0) {
          onPositionsChanged(updatedHighlights);
        }

        return mapped;
      }
    },

    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
}

/**
 * Update comment highlights in the plugin
 *
 * Use this to add/remove/update comments without recreating the plugin
 */
export function updateCommentHighlights(
  highlights: CommentHighlight[]
): (state: any) => any {
  return (state) => {
    const tr = state.tr;
    const plugin = CommentPositionTrackerKey.get(state);

    if (!plugin) {
      console.warn('CommentPositionTracker plugin not found');
      return state.apply(tr);
    }

    // Create new decoration set
    const decorations = highlights.map(h =>
      Decoration.inline(h.from, h.to, {
        class: h.resolved ? 'comment-highlight comment-resolved' : 'comment-highlight',
        'data-comment-id': h.commentId,
        'data-comment-number': (h.commentNumber ?? 0).toString(),
        'data-resolved': (h.resolved ?? false).toString()
      })
    );

    const newDecorationSet = DecorationSet.create(state.doc, decorations);

    // Update plugin state
    tr.setMeta(CommentPositionTrackerKey, { decorationSet: newDecorationSet });

    return state.apply(tr);
  };
}

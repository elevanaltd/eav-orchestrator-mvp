import type { Editor } from '@tiptap/react'
import type { CommentHighlight } from '../types/comments'
import { supabase } from './supabase'

/**
 * Reconciliation loop: Remove highlights for deleted comments
 * Runs on editor load and periodically
 */
export async function reconcileComments(
  editor: Editor | null,
  scriptId: string
): Promise<void> {
  if (!editor) return

  const { data: comments } = await supabase
    .from('comments')
    .select('id')
    .eq('script_id', scriptId)
    .not('deleted_at', 'is', null)

  if (!comments?.length) return

  const deletedCommentIds = new Set(comments.map(c => c.id))

  // Remove highlights for deleted comments by traversing and unsetting
  const { state, view } = editor
  const { tr } = state

  state.doc.descendants((node, pos) => {
    node.marks.forEach(mark => {
      if (mark.type.name === 'commentHighlight') {
        const commentId = mark.attrs.commentId
        if (deletedCommentIds.has(commentId)) {
          tr.removeMark(pos, pos + node.nodeSize, mark.type)
        }
      }
    })
  })

  if (tr.docChanged) {
    view.dispatch(tr)
  }
}

/**
 * Clean up orphaned highlights (highlights without corresponding comments)
 */
export async function cleanOrphanedHighlights(
  editor: Editor | null,
  scriptId: string,
  currentHighlights: CommentHighlight[]
): Promise<void> {
  if (!editor) return

  const { data: validComments } = await supabase
    .from('comments')
    .select('id')
    .eq('script_id', scriptId)
    .is('deleted_at', null)

  if (!validComments) return

  const validCommentIds = new Set(validComments.map(c => c.id))
  const orphanedIds = currentHighlights
    .filter(h => !validCommentIds.has(h.commentId))
    .map(h => h.commentId)

  if (orphanedIds.length === 0) return

  // Remove orphaned highlights by traversing and unsetting
  const { state, view } = editor
  const { tr } = state

  state.doc.descendants((node, pos) => {
    node.marks.forEach(mark => {
      if (mark.type.name === 'commentHighlight') {
        const commentId = mark.attrs.commentId
        if (orphanedIds.includes(commentId)) {
          tr.removeMark(pos, pos + node.nodeSize, mark.type)
        }
      }
    })
  })

  if (tr.docChanged) {
    view.dispatch(tr)
  }
}

import { useCallback, useRef } from 'react'
import type { CommentHighlight } from '../types/comments'
import { supabase } from '../lib/supabase'

const DEBOUNCE_MS = 500

/**
 * Hook for debounced comment position synchronization to database
 * Prevents race conditions with realtime subscriptions
 */
export function useCommentPositionSync() {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedUpdate = useCallback(async (highlights: CommentHighlight[]) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce the update
    timeoutRef.current = setTimeout(async () => {
      if (highlights.length === 0) return

      // Update each comment's position
      const updates = highlights.map(async (highlight) => {
        await supabase
          .from('comments')
          .update({
            pm_position_from: highlight.from,
            pm_position_to: highlight.to,
            updated_at: new Date().toISOString()
          })
          .eq('id', highlight.commentId)
      })

      await Promise.all(updates)
    }, DEBOUNCE_MS)
  }, [])

  return { debouncedUpdate }
}

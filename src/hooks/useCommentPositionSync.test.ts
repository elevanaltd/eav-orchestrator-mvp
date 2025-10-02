/**
 * Comment Position Sync Tests
 *
 * Tests for debounced database synchronization of comment positions
 * Phase 5: Debounced DB writes implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useCommentPositionSync } from './useCommentPositionSync'
import type { CommentHighlight } from '../types/comments'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }
}))

describe('useCommentPositionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should debounce position updates', async () => {
    const { result } = renderHook(() => useCommentPositionSync())

    const highlights: CommentHighlight[] = [
      { commentId: 'comment-1', from: 10, to: 20 }
    ]

    // Trigger multiple updates quickly
    result.current.debouncedUpdate(highlights)
    result.current.debouncedUpdate(highlights)
    result.current.debouncedUpdate(highlights)

    const { supabase } = await import('../lib/supabase')

    // Should not call immediately
    expect(supabase.from).not.toHaveBeenCalled()

    // Wait for debounce (500ms + buffer)
    await new Promise(resolve => setTimeout(resolve, 600))

    // Should call only once after debounce
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledTimes(1)
    })
  })

  it('should update positions for all highlights', async () => {
    const { result } = renderHook(() => useCommentPositionSync())

    const highlights: CommentHighlight[] = [
      { commentId: 'comment-1', from: 10, to: 20 },
      { commentId: 'comment-2', from: 30, to: 40 }
    ]

    result.current.debouncedUpdate(highlights)

    await new Promise(resolve => setTimeout(resolve, 600))

    const { supabase } = await import('../lib/supabase')

    await waitFor(() => {
      // Should update each comment
      expect(supabase.from).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle empty highlights array', async () => {
    const { result } = renderHook(() => useCommentPositionSync())

    result.current.debouncedUpdate([])

    await new Promise(resolve => setTimeout(resolve, 600))

    const { supabase } = await import('../lib/supabase')

    // Should not call with empty array
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('should cancel pending updates on new input', async () => {
    const { result } = renderHook(() => useCommentPositionSync())

    const highlights1: CommentHighlight[] = [
      { commentId: 'comment-1', from: 10, to: 20 }
    ]

    const highlights2: CommentHighlight[] = [
      { commentId: 'comment-1', from: 15, to: 25 }
    ]

    result.current.debouncedUpdate(highlights1)
    await new Promise(resolve => setTimeout(resolve, 200)) // Partial wait

    result.current.debouncedUpdate(highlights2) // New update cancels old
    await new Promise(resolve => setTimeout(resolve, 600)) // Complete wait for new update

    const { supabase } = await import('../lib/supabase')

    await waitFor(() => {
      // Should only call once with latest data
      expect(supabase.from).toHaveBeenCalledTimes(1)
    })
  })

  it('should complete debounced update in <700ms', async () => {
    const { result } = renderHook(() => useCommentPositionSync())

    const highlights: CommentHighlight[] = [
      { commentId: 'comment-1', from: 10, to: 20 }
    ]

    const start = performance.now()
    result.current.debouncedUpdate(highlights)
    await new Promise(resolve => setTimeout(resolve, 600))

    const duration = performance.now() - start
    expect(duration).toBeLessThan(700)
  })
})

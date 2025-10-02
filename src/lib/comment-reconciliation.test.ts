/**
 * Comment Reconciliation Tests
 *
 * Tests for orphaned highlight cleanup and comment/highlight synchronization
 * Phase 4: Reconciliation loop implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Editor } from '@tiptap/react'
import { reconcileComments, cleanOrphanedHighlights } from './comment-reconciliation'
import type { CommentHighlight } from '../types/comments'

// Mock Supabase
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(() => ({
            data: []
          })),
          is: vi.fn(() => ({
            data: []
          }))
        }))
      }))
    }))
  }
}))

describe('Comment Reconciliation', () => {
  let mockEditor: Editor

  beforeEach(() => {
    // Create mock editor with chain API
    mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          unsetMark: vi.fn(() => ({
            run: vi.fn()
          }))
        }))
      }))
    } as unknown as Editor
  })

  describe('reconcileComments', () => {
    it('should handle null editor gracefully', async () => {
      await expect(
        reconcileComments(null, 'script-123')
      ).resolves.not.toThrow()
    })

    it('should remove highlights for deleted comments', async () => {
      const scriptId = 'script-123'

      // Mock deleted comments
      const { supabase } = await import('./supabase')
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              data: [
                { id: 'deleted-comment-1' },
                { id: 'deleted-comment-2' }
              ]
            }))
          }))
        }))
      } as any)

      await reconcileComments(mockEditor, scriptId)

      expect(mockEditor.chain).toHaveBeenCalled()
    })

    it('should handle no deleted comments', async () => {
      const scriptId = 'script-123'

      const { supabase } = await import('./supabase')
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              data: []
            }))
          }))
        }))
      } as any)

      await reconcileComments(mockEditor, scriptId)

      // Should not call chain if no deleted comments
      expect(mockEditor.chain).not.toHaveBeenCalled()
    })
  })

  describe('cleanOrphanedHighlights', () => {
    it('should handle null editor gracefully', async () => {
      await expect(
        cleanOrphanedHighlights(null, 'script-123', [])
      ).resolves.not.toThrow()
    })

    it('should remove highlights without corresponding comments', async () => {
      const scriptId = 'script-123'
      const highlights: CommentHighlight[] = [
        { commentId: 'comment-1', from: 10, to: 20 },
        { commentId: 'orphaned-1', from: 30, to: 40 },
        { commentId: 'comment-2', from: 50, to: 60 }
      ]

      // Mock valid comments (missing 'orphaned-1')
      const { supabase } = await import('./supabase')
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              data: [
                { id: 'comment-1' },
                { id: 'comment-2' }
              ]
            }))
          }))
        }))
      } as any)

      await cleanOrphanedHighlights(mockEditor, scriptId, highlights)

      expect(mockEditor.chain).toHaveBeenCalled()
    })

    it('should handle all valid highlights', async () => {
      const scriptId = 'script-123'
      const highlights: CommentHighlight[] = [
        { commentId: 'comment-1', from: 10, to: 20 }
      ]

      const { supabase } = await import('./supabase')
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              data: [
                { id: 'comment-1' }
              ]
            }))
          }))
        }))
      } as any)

      await cleanOrphanedHighlights(mockEditor, scriptId, highlights)

      // Should not call chain if all highlights valid
      expect(mockEditor.chain).not.toHaveBeenCalled()
    })

    it('should handle empty highlights array', async () => {
      const scriptId = 'script-123'

      const { supabase } = await import('./supabase')
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              data: []
            }))
          }))
        }))
      } as any)

      await cleanOrphanedHighlights(mockEditor, scriptId, [])

      expect(mockEditor.chain).not.toHaveBeenCalled()
    })
  })

  describe('Performance', () => {
    it('should complete reconciliation in <100ms', async () => {
      const start = performance.now()
      await reconcileComments(mockEditor, 'script-123')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })
  })
})

import { useQuery } from '@tanstack/react-query'
import { getComments } from '../../lib/comments'
import { supabase } from '../../lib/supabase'
import type { CommentWithRecovery } from '../../types/comments'

// Critical-Engineer: consulted for query architecture with Supabase integration
// Architecture: TanStack Query for comments with real-time sync readiness

/**
 * Hook for querying script comments
 *
 * Architecture compliance:
 * - Named query key for React Query DevTools
 * - Auto-fetch when scriptId provided
 * - 30-second stale time for comment freshness
 * - Ready for real-time updates via RealtimeProvider
 */
export const useScriptCommentsQuery = (scriptId: string | null) => {
  return useQuery<CommentWithRecovery[], Error>({
    queryKey: ['comments', scriptId] as const,
    queryFn: async () => {
      if (!scriptId) {
        throw new Error('No script ID provided')
      }

      const result = await getComments(supabase, scriptId)

      if (!result.success || !result.data) {
        throw new Error(result.error?.message || 'Failed to fetch comments')
      }

      return result.data
    },
    enabled: !!scriptId,
    staleTime: 1000 * 30, // 30 seconds - comments need fresher data than scripts
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  })
}

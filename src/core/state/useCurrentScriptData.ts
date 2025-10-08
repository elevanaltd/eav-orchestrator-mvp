import { useQuery } from '@tanstack/react-query'
import { useNavigation } from '../../contexts/NavigationContext'
import { useAuth } from '../../contexts/AuthContext'
import { loadScriptForVideo } from '../../services/scriptService'

// Critical-Engineer: consulted for Server state management architecture (Amendment #1)
// Architecture: Lines 417-433 - TanStack Query for server state with 5-minute stale time

/**
 * Hook to fetch current script data based on selected video
 * Uses TanStack Query for server state management with caching
 *
 * Architecture compliance:
 * - 5-minute stale time for optimal UX (Line 430)
 * - Enabled only when video is selected
 * - Passes user role for RLS enforcement
 * - Query key: ['script', videoId] for cache management
 */
export const useCurrentScriptData = () => {
  const { selectedVideo } = useNavigation()
  const { userProfile } = useAuth()

  return useQuery({
    queryKey: ['script', selectedVideo?.id],
    queryFn: () => {
      if (!selectedVideo) {
        throw new Error('No video selected')
      }
      return loadScriptForVideo(selectedVideo.id, userProfile?.role || null)
    },
    enabled: !!selectedVideo, // Only fetch when video is selected
    staleTime: 1000 * 60 * 5, // 5 minutes (Architecture Line 430)
  })
}

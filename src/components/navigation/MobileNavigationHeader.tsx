/**
 * Mobile Navigation Header
 *
 * Provides dropdown navigation for mobile devices to solve the "Trapped User" problem.
 * Uses native <select> with <optgroup> for optimal mobile UX and performance.
 *
 * Critical-Engineer: consulted for Mobile navigation patterns and user experience
 */

import { useNavigate, useParams } from 'react-router-dom'
import { isMobileDevice } from '../../utils/mobileDetection'
import { Project, Video } from '../../contexts/NavigationContext'

interface MobileNavigationHeaderProps {
  projects: Project[]
  videos: Video[]
  loading?: boolean
}

export function MobileNavigationHeader({
  projects,
  videos,
  loading = false
}: MobileNavigationHeaderProps) {
  const navigate = useNavigate()
  const { projectId, videoId } = useParams<{
    projectId: string
    videoId: string
  }>()

  // Only render on mobile devices
  if (!isMobileDevice()) {
    return null
  }

  // Don't render if no projects available
  if (!projects.length && !loading) {
    return null
  }

  /**
   * Handle navigation selection
   * Format: "projectId/videoId" or "projectId" for project-only
   */
  const handleSelectionChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value

    if (!value || value === 'default') {
      return
    }

    // Parse the selection value
    const parts = value.split('/')
    if (parts.length !== 2) {
      console.warn('Invalid selection format:', value)
      return
    }

    const [selectedProjectId, selectedVideoId] = parts

    // Validate that the selection exists
    const project = projects.find(p => p.id === selectedProjectId)
    const video = videos.find(v => v.id === selectedVideoId)

    if (!project || !video) {
      console.warn('Invalid project/video selection:', { selectedProjectId, selectedVideoId })
      return
    }

    // Navigate to the selected video
    navigate(`/project/${selectedProjectId}/video/${selectedVideoId}`)
  }

  /**
   * Get current selection value for controlled component
   */
  const getCurrentSelectionValue = (): string => {
    if (projectId && videoId) {
      return `${projectId}/${videoId}`
    }
    return 'default'
  }

  /**
   * Group videos by their project's eav_code
   */
  const getVideosForProject = (project: Project): Video[] => {
    return videos.filter(video => video.eav_code === project.eav_code)
  }

  /**
   * Render project groups with videos
   */
  const renderProjectGroups = () => {
    if (loading) {
      return (
        <option value="loading" disabled>
          Loading projects...
        </option>
      )
    }

    if (!projects.length) {
      return (
        <option value="no-projects" disabled>
          No projects available
        </option>
      )
    }

    return projects.map(project => {
      const projectVideos = getVideosForProject(project)

      return (
        <optgroup key={project.id} label={project.title}>
          {projectVideos.length > 0 ? (
            projectVideos.map(video => (
              <option
                key={video.id}
                value={`${project.id}/${video.id}`}
              >
                {video.title}
              </option>
            ))
          ) : (
            <option value={`${project.id}/no-videos`} disabled>
              No videos in this project
            </option>
          )}
        </optgroup>
      )
    })
  }

  return (
    <div className="mobile-navigation-header">
      <select
        value={getCurrentSelectionValue()}
        onChange={handleSelectionChange}
        className="mobile-nav-select"
        aria-label="Select project and video to navigate"
        disabled={loading}
      >
        <option value="default">
          {loading ? 'Loading...' : 'Select a video'}
        </option>
        {renderProjectGroups()}
      </select>
    </div>
  )
}
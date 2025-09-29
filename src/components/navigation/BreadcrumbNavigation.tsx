/**
 * Breadcrumb Navigation
 *
 * Provides hierarchical navigation context for mobile users.
 * Shows "Project > Video" structure with clickable upward navigation.
 *
 * Critical-Engineer: consulted for Mobile navigation patterns and accessibility
 */

import { useNavigate } from 'react-router-dom'
import { isMobileDevice } from '../../utils/mobileDetection'
import { Project, Video } from '../../contexts/NavigationContext'

interface BreadcrumbNavigationProps {
  currentProject: Project | null
  currentVideo: Video | null
}

export function BreadcrumbNavigation({
  currentProject,
  currentVideo
}: BreadcrumbNavigationProps) {
  const navigate = useNavigate()

  // Only render on mobile devices
  if (!isMobileDevice()) {
    return null
  }

  // Don't render without a current project
  if (!currentProject) {
    return null
  }

  /**
   * Handle navigation to project level
   */
  const handleProjectClick = () => {
    if (currentProject && currentVideo) {
      // Only allow navigation up when we're at video level
      navigate(`/project/${currentProject.id}`)
    }
  }

  /**
   * Truncate text for mobile display
   */
  const truncateText = (text: string, maxLength: number = 25): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
  }

  return (
    <nav className="mobile-breadcrumb" aria-label="Breadcrumb navigation">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          {currentVideo ? (
            // Show project as clickable when at video level
            <button
              className="breadcrumb-link"
              onClick={handleProjectClick}
              aria-label={`Navigate to ${currentProject.title}`}
              title={currentProject.title}
            >
              <span className="breadcrumb-text">
                {truncateText(currentProject.title)}
              </span>
            </button>
          ) : (
            // Show project as non-clickable when at project level
            <span
              className="breadcrumb-current"
              aria-current="page"
              title={currentProject.title}
            >
              <span className="breadcrumb-text">
                {truncateText(currentProject.title)}
              </span>
            </span>
          )}
        </li>

        {currentVideo && (
          <>
            <li className="breadcrumb-separator" aria-hidden="true">
              <span>&gt;</span>
            </li>
            <li className="breadcrumb-item">
              <span
                className="breadcrumb-current"
                aria-current="page"
                title={currentVideo.title}
              >
                <span className="breadcrumb-text">
                  {truncateText(currentVideo.title)}
                </span>
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  )
}
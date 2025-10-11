import { useState } from 'react';
import { useNavigation, Video } from '../../contexts/NavigationContext';
import '../../styles/Navigation.css';
import { useNavigationData } from '../../core/state/useNavigationData';

// Critical-Engineer: consulted for Security vulnerability assessment

interface NavigationSidebarProps {
  // Optional legacy callbacks for backward compatibility
  onProjectSelect?: (projectId: string) => void;
  onVideoSelect?: (videoId: string, projectId: string) => void;
  // Auto-refresh configuration
  refreshInterval?: number; // milliseconds, default 30000 (30 seconds)
}

export function NavigationSidebar({
  onProjectSelect,
  onVideoSelect,
  refreshInterval = 30000
}: NavigationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Use navigation context for selection state
  const {
    setSelectedProject,
    setSelectedVideo,
    isProjectSelected,
    isVideoSelected: checkVideoSelected
  } = useNavigation();

  // Use navigation data hook for data fetching and auto-refresh
  const {
    projects,
    videos: videosMap,
    loading,
    error,
    isRefreshing,
    loadVideos: loadVideosFromHook
  } = useNavigationData({ refreshInterval, autoRefresh: true });

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const handleProjectClick = (projectId: string) => {
    // Find the project object from our projects list
    const project = projects.find(p => p.id === projectId) || null;
    setSelectedProject(project);
    toggleProject(projectId);

    // Load videos for this project if not already expanded
    if (!expandedProjects.has(projectId)) {
      loadVideosFromHook(projectId);
    }

    // Call legacy callback if provided
    onProjectSelect?.(projectId);
  };

  const handleVideoClick = (videoId: string, projectId: string) => {
    // Find the project to get its eav_code
    const project = projects.find(p => p.id === projectId) || null;

    // Find the video from the videos map using eav_code
    let video: Video | null = null;
    if (project?.eav_code && videosMap[project.eav_code]) {
      video = videosMap[project.eav_code].find((v: Video) => v.id === videoId) || null;
    }

    setSelectedVideo(video, project);

    // Call legacy callback if provided
    onVideoSelect?.(videoId, projectId);
  };

  const getStatusDot = (mainStatus?: string, voStatus?: string) => {
    if (mainStatus === 'ready' && voStatus === 'ready') return 'status-ready';
    if (mainStatus === 'processing' || voStatus === 'processing') return 'status-processing';
    return 'status-pending';
  };

  const getProjectVideos = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project?.eav_code) return [];
    return videosMap[project.eav_code] || [];
  };

  return (
    <div className={`nav-sidebar ${isCollapsed ? 'nav-sidebar--collapsed' : ''}`}>
      <div className="nav-header">
        <div className="nav-brand">
          {!isCollapsed && (
            <>
              <h2>EAV Orchestrator</h2>
              <p>
                Projects & Videos
                {isRefreshing && (
                  <span className="nav-refresh-indicator" title="Refreshing data...">
                    🔄
                  </span>
                )}
              </p>
            </>
          )}
        </div>
        <button
          className="nav-toggle"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="nav-content">
          {error && (
            <div className="nav-error">
              {error}
            </div>
          )}

          {loading && (
            <div className="nav-loading">
              <div className="nav-loading-spinner"></div>
              Loading...
            </div>
          )}

          <div className="nav-section">
            <h3 className="nav-section-title">
              Projects ({projects.length})
            </h3>

            <div className="nav-list">
              {projects.length === 0 && !loading && !error && (
                <div className="nav-empty">
                  <div className="nav-empty-icon">📁</div>
                  No projects found
                </div>
              )}

              {projects.map(project => {
                const isExpanded = expandedProjects.has(project.id);
                const isSelected = isProjectSelected(project.id);
                const projectVideos = getProjectVideos(project.id);

                return (
                  <div key={project.id} className="nav-project">
                    <div
                      className={`nav-project-item ${isSelected ? 'nav-project-item--selected' : ''}`}
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <div className="nav-project-icon">
                        {isExpanded ? '📂' : '📁'}
                      </div>
                      <div className="nav-project-info">
                        <div className="nav-project-title">{project.title}</div>
                        <div className="nav-project-meta">
                          {isExpanded ? `${projectVideos.length} videos` : 'Click to expand'}
                          {project.due_date && ` • Due ${project.due_date}`}
                        </div>
                      </div>
                      <div className="nav-project-expand">
                        {isExpanded ? '▼' : '▶'}
                      </div>
                    </div>

                    {isExpanded && projectVideos.length > 0 && (
                      <div className="nav-video-list">
                        {projectVideos.map(video => {
                          const isVideoSelected = checkVideoSelected(video.id);
                          return (
                            <div
                              key={video.id}
                              className={`nav-video-item ${isVideoSelected ? 'nav-video-item--selected' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVideoClick(video.id, project.id);
                              }}
                            >
                              <div className={`nav-video-status ${getStatusDot(video.main_stream_status, video.vo_stream_status)}`}></div>
                              <div className="nav-video-info">
                                <div className="nav-video-title">{video.title}</div>
                                <div className="nav-video-meta">
                                  Main: {video.main_stream_status || 'N/A'} | VO: {video.vo_stream_status || 'N/A'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="nav-collapsed-hint">
          <div className="nav-collapsed-icon">📁</div>
          <div className="nav-collapsed-count">{projects.length}</div>
        </div>
      )}
    </div>
  );
}
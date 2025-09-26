import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigation, Project, Video } from '../../contexts/NavigationContext';
import { validateProjectId, ValidationError } from '../../lib/validation';
import '../../styles/Navigation.css';

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

  // Data loading state
  const [projects, setProjects] = useState<Project[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // DEBUG: Client access debugging
  useEffect(() => {
    const debugClientAccess = async () => {
      console.log('=== CLIENT ACCESS DEBUG ===');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Current user:', user?.email);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user?.id)
        .single();
      console.log('User role:', profile?.role);

      if (profile?.role === 'client') {
        const { data: clientAccess } = await supabase
          .from('user_clients')
          .select('*')
          .eq('user_id', user?.id);
        console.log('Client access entries:', clientAccess);

        // Check if any projects match
        const { data: allProjects } = await supabase
          .from('projects')
          .select('id, title, client_filter');
        console.log('All projects with filters:', allProjects);
      }
      console.log('=== END DEBUG ===');
    };

    debugClientAccess();
  }, []);

  // Auto-refresh state
  const [isVisible, setIsVisible] = useState(!document.hidden);

  // Handle visibility changes for performance optimization
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Declare functions before they are used
  // SECURITY FIX: Prevent race condition by using functional state updates
  const refreshData = useCallback(async () => {
    // Refresh projects data without disrupting UI
    await loadProjects(true);

    // Use functional state update to get current expandedProjects
    // This prevents stale closure issues
    setExpandedProjects(currentExpanded => {
      // Refresh videos for currently expanded projects
      const refreshPromises = Array.from(currentExpanded).map(projectId =>
        loadVideos(projectId, true)
      );
      Promise.all(refreshPromises).catch(err => {
        console.error('Failed to refresh expanded project videos:', err);
      });

      // Return the same state (no change needed)
      return currentExpanded;
    });
  }, []); // Empty dependency array - no external dependencies needed

  // Auto-refresh projects when component is visible
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    // Initial load
    loadProjects();

    // Set up refresh interval
    const intervalId = setInterval(() => {
      if (!document.hidden) {
        refreshData();
      }
    }, refreshInterval);

    // Cleanup interval on unmount or dependency change
    return () => {
      clearInterval(intervalId);
    };
  }, [isVisible, refreshInterval, refreshData]);

  const loadProjects = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('title');

      if (error) throw error;
      setProjects(data || []);
      console.log('Navigation: Projects loaded:', data);
    } catch (err) {
      setError(`Failed to load projects: ${err}`);
      console.error('Navigation: Load projects error:', err);
    }

    if (isRefresh) {
      setIsRefreshing(false);
    } else {
      setLoading(false);
    }
  };

  const loadVideos = async (projectId: string, isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    setError('');

    try {
      // SECURITY: Validate projectId before database operation
      const validatedProjectId = validateProjectId(projectId);

      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('project_id', validatedProjectId)
        .order('title');

      if (error) throw error;

      // Update videos state - merge with existing videos from other projects
      setVideos(prevVideos => [
        ...prevVideos.filter(v => v.project_id !== validatedProjectId),
        ...(data || [])
      ]);

      console.log('Navigation: Videos loaded for project:', validatedProjectId, data);
    } catch (err) {
      if (err instanceof ValidationError) {
        setError(`Invalid project ID: ${err.message}`);
      } else {
        setError(`Failed to load videos: ${err}`);
      }
      console.error('Navigation: Load videos error:', err);
    }

    if (!isRefresh) {
      setLoading(false);
    }
  };

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
      loadVideos(projectId);
    }

    // Call legacy callback if provided
    onProjectSelect?.(projectId);
  };

  const handleVideoClick = (videoId: string, projectId: string) => {
    // Find the video and project objects
    const video = videos.find(v => v.id === videoId) || null;
    const project = projects.find(p => p.id === projectId) || null;
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
    return videos.filter(video => video.project_id === projectId);
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
                                handleVideoClick(video.id, video.project_id);
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
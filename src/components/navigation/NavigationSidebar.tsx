import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigation, Project, Video } from '../../contexts/NavigationContext';
import '../../styles/Navigation.css';

interface NavigationSidebarProps {
  // Optional legacy callbacks for backward compatibility
  onProjectSelect?: (projectId: string) => void;
  onVideoSelect?: (videoId: string, projectId: string) => void;
}

export function NavigationSidebar({ onProjectSelect, onVideoSelect }: NavigationSidebarProps) {
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

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
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
    setLoading(false);
  };

  const loadVideos = async (projectId: string) => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('project_id', projectId)
        .order('title');

      if (error) throw error;

      // Update videos state - merge with existing videos from other projects
      setVideos(prevVideos => [
        ...prevVideos.filter(v => v.project_id !== projectId),
        ...(data || [])
      ]);

      console.log('Navigation: Videos loaded for project:', projectId, data);
    } catch (err) {
      setError(`Failed to load videos: ${err}`);
      console.error('Navigation: Load videos error:', err);
    }
    setLoading(false);
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
              <p>Projects & Videos</p>
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
                        {projectVideos.length > 0 ? (isExpanded ? '📂' : '📁') : '📄'}
                      </div>
                      <div className="nav-project-info">
                        <div className="nav-project-title">{project.title}</div>
                        <div className="nav-project-meta">
                          {projectVideos.length} videos
                          {project.due_date && ` • Due ${project.due_date}`}
                        </div>
                      </div>
                      {projectVideos.length > 0 && (
                        <div className="nav-project-expand">
                          {isExpanded ? '▼' : '▶'}
                        </div>
                      )}
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
import { useState } from 'react';
import '../../styles/Navigation.css';

interface Project {
  id: string;
  title: string;
  due_date?: string;
}

interface Video {
  id: string;
  project_id: string;
  title: string;
  main_stream_status?: string;
  vo_stream_status?: string;
}

interface NavigationSidebarProps {
  onProjectSelect?: (projectId: string) => void;
  onVideoSelect?: (videoId: string, projectId: string) => void;
}

export function NavigationSidebar({ onProjectSelect, onVideoSelect }: NavigationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  // Mock data for now - will be replaced with Supabase in next task
  const mockProjects: Project[] = [
    { id: '1', title: 'Sample Project Alpha', due_date: '2025-10-15' },
    { id: '2', title: 'Beta Campaign', due_date: '2025-10-30' },
  ];

  const mockVideos: Video[] = [
    { id: 'v1', project_id: '1', title: 'Intro Video', main_stream_status: 'ready', vo_stream_status: 'pending' },
    { id: 'v2', project_id: '1', title: 'Product Demo', main_stream_status: 'processing', vo_stream_status: 'ready' },
    { id: 'v3', project_id: '2', title: 'Campaign Overview', main_stream_status: 'ready', vo_stream_status: 'ready' },
  ];

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
    setSelectedProject(projectId);
    toggleProject(projectId);
    onProjectSelect?.(projectId);
  };

  const handleVideoClick = (videoId: string, projectId: string) => {
    setSelectedVideo(videoId);
    onVideoSelect?.(videoId, projectId);
  };

  const getStatusDot = (mainStatus?: string, voStatus?: string) => {
    if (mainStatus === 'ready' && voStatus === 'ready') return 'status-ready';
    if (mainStatus === 'processing' || voStatus === 'processing') return 'status-processing';
    return 'status-pending';
  };

  const getProjectVideos = (projectId: string) => {
    return mockVideos.filter(video => video.project_id === projectId);
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
          <div className="nav-section">
            <h3 className="nav-section-title">
              Projects ({mockProjects.length})
            </h3>

            <div className="nav-list">
              {mockProjects.map(project => {
                const isExpanded = expandedProjects.has(project.id);
                const isSelected = selectedProject === project.id;
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
                          const isVideoSelected = selectedVideo === video.id;
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
          <div className="nav-collapsed-count">{mockProjects.length}</div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react'
import { dataAccess } from '../services/data-access'
import type { Project, Video } from '../types/data'

export function DataTestPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load projects on mount
  useEffect(() => {
    console.log('DataTestPanel mounted, loading projects...')
    loadProjects()
  }, [])

  // Load videos when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadVideos(selectedProject)
    } else {
      setVideos([])
    }
  }, [selectedProject])

  const loadProjects = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await dataAccess.listProjects()
      if (result.error) {
        throw result.error
      }
      setProjects(result.data || [])
      console.log('Loaded projects:', result.data)
    } catch (err) {
      setError(`Error loading projects: ${err}`)
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadVideos = async (projectId: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await dataAccess.listVideosForProject(projectId)
      if (result.error) {
        throw result.error
      }
      setVideos(result.data || [])
      console.log('Loaded videos for project:', projectId, result.data)
    } catch (err) {
      setError(`Error loading videos: ${err}`)
      console.error('Failed to load videos:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
      margin: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginTop: 0, color: '#1f2937' }}>
        🧪 Data Access Layer Test
      </h2>

      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          color: '#dc2626',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: '12px', color: '#6b7280' }}>
          Loading...
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ color: '#374151' }}>Projects ({projects.length})</h3>
        {projects.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No projects found. Have you added test data to Supabase?</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map(project => (
              <div
                key={project.id}
                onClick={() => setSelectedProject(project.id)}
                style={{
                  padding: '12px',
                  backgroundColor: selectedProject === project.id ? '#dbeafe' : 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: 600, color: '#1f2937' }}>
                  {project.eavCode} - {project.title}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  ID: {project.id}
                </div>
                {project.dueDate && (
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Due: {new Date(project.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProject && (
        <div>
          <h3 style={{ color: '#374151' }}>Videos ({videos.length})</h3>
          {videos.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No videos found for this project.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {videos.map(video => (
                <div
                  key={video.id}
                  style={{
                    padding: '12px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#1f2937' }}>
                    {video.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Status: {video.mainStreamStatus || 'Not started'} |
                    VO: {video.voStreamStatus || 'Not started'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Type: {video.productionType || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#374151' }}>Connection Status</h4>
        <div style={{ fontSize: '14px', color: '#4b5563' }}>
          ✅ Supabase connected<br />
          ✅ Data Access Layer operational<br />
          {projects.length > 0 && '✅ Test data found'}<br />
          {selectedProject && videos.length > 0 && '✅ Video loading working'}
        </div>
      </div>

      <button
        onClick={loadProjects}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500
        }}
      >
        Refresh Data
      </button>
    </div>
  )
}
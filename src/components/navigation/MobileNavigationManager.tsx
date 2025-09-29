/**
 * Mobile Navigation Manager
 *
 * Manages mobile navigation components with data loading and URL synchronization.
 * Integrates MobileNavigationHeader and BreadcrumbNavigation with existing data flow.
 *
 * Critical-Engineer: consulted for Data flow architecture and performance optimization
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNavigation, Project, Video } from '../../contexts/NavigationContext'
import { MobileNavigationHeader } from './MobileNavigationHeader'
import { BreadcrumbNavigation } from './BreadcrumbNavigation'
import { isMobileDevice } from '../../utils/mobileDetection'

export function MobileNavigationManager() {
  const { projectId, videoId } = useParams<{
    projectId: string
    videoId: string
  }>()

  const { setSelectedProject, setSelectedVideo } = useNavigation()

  // Data state
  const [projects, setProjects] = useState<Project[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)

  // Check if mobile device
  const isMobile = isMobileDevice()

  /**
   * Load projects data (reusing NavigationSidebar logic)
   */
  const loadProjects = async () => {
    setLoading(true)
    try {
      // Fetch projects that meet the phase criteria
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .not('project_phase', 'in', '("Completed","Not Proceeded With")')
        .order('title')

      if (projectError) throw projectError

      // Fetch all videos to determine which projects have videos
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('eav_code')
        .not('eav_code', 'is', null)

      if (videoError) throw videoError

      // Create a set of eav_codes that have videos
      const eavCodesWithVideos = new Set(videoData?.map(v => v.eav_code) || [])

      // Filter projects to only those with videos
      const projectsWithVideos = (projectData || []).filter(project =>
        project.eav_code && eavCodesWithVideos.has(project.eav_code)
      )

      setProjects(projectsWithVideos)

    } catch (err) {
      console.error('MobileNavigation: Failed to load projects:', err)
    }
    setLoading(false)
  }


  // Load videos when projects change
  const loadAllVideosCallback = useCallback(async () => {
    if (!projects.length) return

    try {
      const eavCodes = projects.map(p => p.eav_code).filter(Boolean)

      const { data: videoData, error } = await supabase
        .from('videos')
        .select('*')
        .in('eav_code', eavCodes)
        .order('title')

      if (error) throw error

      setVideos(videoData || [])

    } catch (err) {
      console.error('MobileNavigation: Failed to load videos:', err)
    }
  }, [projects])

  // Sync current selection with URL parameters
  const syncWithURLCallback = useCallback(async () => {
    if (!projectId) {
      setCurrentProject(null)
      setCurrentVideo(null)
      setSelectedProject(null)
      setSelectedVideo(null)
      return
    }

    try {
      // Load current project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (projectError || !projectData) {
        console.warn('Project not found:', projectId)
        return
      }

      setCurrentProject(projectData)
      setSelectedProject(projectData)

      // Load current video if specified
      if (videoId) {
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', videoId)
          .single()

        if (videoError || !videoData) {
          console.warn('Video not found:', videoId)
          setCurrentVideo(null)
          setSelectedVideo(null)
          return
        }

        setCurrentVideo(videoData)
        setSelectedVideo(videoData, projectData)
      } else {
        setCurrentVideo(null)
        setSelectedVideo(null)
      }

    } catch (err) {
      console.error('MobileNavigation: Failed to sync with URL:', err)
    }
  }, [projectId, videoId, setSelectedProject, setSelectedVideo])

  // Load projects on mount
  useEffect(() => {
    if (isMobile) {
      loadProjects()
    }
  }, [isMobile])

  // Load videos when projects change
  useEffect(() => {
    if (isMobile && projects.length > 0) {
      loadAllVideosCallback()
    }
  }, [isMobile, projects.length, loadAllVideosCallback])

  // Sync with URL parameters
  useEffect(() => {
    if (isMobile) {
      syncWithURLCallback()
    }
  }, [isMobile, projectId, videoId, syncWithURLCallback])

  // Only render on mobile devices
  if (!isMobile) {
    return null
  }

  return (
    <>
      <MobileNavigationHeader
        projects={projects}
        videos={videos}
        loading={loading}
      />
      <BreadcrumbNavigation
        currentProject={currentProject}
        currentVideo={currentVideo}
      />
    </>
  )
}
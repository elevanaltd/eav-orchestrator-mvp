import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncResult {
  projectsFound: number
  projectsSynced: number
  videosFound: number
  videosSynced: number
  errors: string[]
}

// SmartSuite data types
interface SmartSuiteProject {
  id: string
  title?: string
  projdue456?: {
    to_date?: {
      date?: string
    }
  }
}

interface SmartSuiteVideo {
  id: string
  title?: string
  mainStreamStatus?: {
    value?: string
  }
  voStreamStatus?: {
    value?: string
  }
  productionType?: string
}

// Note: SyncMetadata interface removed as it's not used in this edge function
// The sync_metadata table is managed by the client-side code

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get secrets from environment (never exposed to client)
    const SMARTSUITE_API_KEY = Deno.env.get('SMARTSUITE_API_KEY')
    // Edge Functions still use the old naming convention
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

    if (!SMARTSUITE_API_KEY || !SUPABASE_SERVICE_KEY || !SUPABASE_URL) {
      throw new Error('Missing required environment variables')
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Implement distributed locking - only one sync can run at a time
    const { data: lockData, error: lockError } = await supabase
      .from('sync_metadata')
      .update({
        status: 'running',
        last_sync_started_at: new Date().toISOString()
      })
      .eq('id', 'singleton')
      .eq('status', 'idle')  // Only update if idle (atomic check-and-set)
      .select()
      .single()

    if (lockError || !lockData) {
      return new Response(
        JSON.stringify({
          error: 'Sync already in progress or failed to acquire lock',
          code: 'SYNC_IN_PROGRESS'
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const result: SyncResult = {
      projectsFound: 0,
      projectsSynced: 0,
      videosFound: 0,
      videosSynced: 0,
      errors: []
    }

    try {
      // 1. Fetch all projects from SmartSuite
      const projectsResponse = await fetch(
        'https://api.smartsuite.com/v1/applications/68a8ff5237fde0bf797c05b3/records/list',
        {
          headers: {
            'Authorization': `Bearer ${SMARTSUITE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!projectsResponse.ok) {
        throw new Error(`SmartSuite API error: ${projectsResponse.status}`)
      }

      const projects = await projectsResponse.json()
      result.projectsFound = projects.items?.length || 0

      // 2. Transform and upsert projects to Supabase
      if (projects.items && projects.items.length > 0) {
        const transformedProjects = projects.items.map((p: SmartSuiteProject) => ({
          id: p.id,
          title: p.title || 'Untitled Project',
          due_date: p.projdue456?.to_date?.date || null
        }))

        const { error: projectUpsertError } = await supabase
          .from('projects')
          .upsert(transformedProjects, {
            onConflict: 'id',
            ignoreDuplicates: false
          })

        if (projectUpsertError) {
          result.errors.push(`Project upsert error: ${projectUpsertError.message}`)
        } else {
          result.projectsSynced = transformedProjects.length
        }

        // 3. Sync videos for each project
        for (const project of projects.items) {
          try {
            const videosResponse = await fetch(
              'https://api.smartsuite.com/v1/applications/68b2437a8f1755b055e0a124/records/list',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SMARTSUITE_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  filter: {
                    operator: 'and',
                    criteria: [
                      {
                        field: 'project',
                        operator: 'has_any_of',
                        value: [project.id]
                      }
                    ]
                  }
                })
              }
            )

            if (!videosResponse.ok) {
              result.errors.push(`Video fetch error for project ${project.id}: ${videosResponse.status}`)
              continue
            }

            const videos = await videosResponse.json()
            const projectVideos = videos.items || []
            result.videosFound += projectVideos.length

            // Transform and upsert videos (filter out reused videos)
            const transformedVideos = projectVideos
              .filter((v: SmartSuiteVideo) => v.productionType !== 'reuse')
              .map((v: SmartSuiteVideo) => ({
                id: v.id,
                project_id: project.id,
                title: v.title || 'Untitled Video',
                main_stream_status: v.mainStreamStatus?.value || null,
                vo_stream_status: v.voStreamStatus?.value || null,
                production_type: v.productionType
              }))

            if (transformedVideos.length > 0) {
              const { error: videoUpsertError } = await supabase
                .from('videos')
                .upsert(transformedVideos, {
                  onConflict: 'id',
                  ignoreDuplicates: false
                })

              if (videoUpsertError) {
                result.errors.push(`Video upsert error for project ${project.id}: ${videoUpsertError.message}`)
              } else {
                result.videosSynced += transformedVideos.length

                // Create empty scripts for new videos (if they don't exist)
                for (const video of transformedVideos) {
                  await supabase
                    .from('scripts')
                    .insert({
                      video_id: video.id,
                      plain_text: '',
                      component_count: 0
                    })
                    .select()
                    .maybeSingle() // Don't fail if already exists
                }
              }
            }
          } catch (videoError) {
            result.errors.push(`Video sync error for project ${project.id}: ${videoError}`)
          }
        }
      }

      // Mark sync as completed successfully
      await supabase
        .from('sync_metadata')
        .update({
          status: 'idle',
          last_sync_completed_at: new Date().toISOString(),
          last_error: null,
          sync_count: lockData.sync_count + 1
        })
        .eq('id', 'singleton')

    } catch (syncError) {
      // Mark sync as failed, release lock
      await supabase
        .from('sync_metadata')
        .update({
          status: 'error',
          last_error: String(syncError)
        })
        .eq('id', 'singleton')

      throw syncError
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({
        error: 'An internal error occurred',
        code: 'INTERNAL_ERROR'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
/**
 * SmartSuite Sync Edge Function - Production Implementation
 *
 * CRITICAL IMPLEMENTATION FIXES from previous failure:
 * 1. Use Deno-specific imports with ?target=deno
 * 2. Use Deno.env.get() instead of process.env
 * 3. Proper CORS handling
 * 4. JWT validation first, before any business logic
 * 5. Input validation using Zod schemas
 * 6. Structured error handling with types
 *
 * TRACED Methodology Applied: Test → Review → Analyze → Consult → Execute → Document
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { validateRequest, type ValidRequest } from "./schemas.ts"
import { validateJWT, checkPermissions } from "./auth.ts"
import { SmartSuiteClient } from "./smartsuite-client.ts"
import { checkUserRateLimit } from "./rate-limiter.ts"
import { createLogger, generateCorrelationId, globalLogger } from "./logger.ts"

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Initialize SmartSuite client with environment configuration
 */
function createSmartSuiteClient(): SmartSuiteClient | null {
  const apiKey = Deno.env.get('SMARTSUITE_API_KEY')
  const workspaceId = Deno.env.get('SMARTSUITE_WORKSPACE_ID')
  const projectsTableId = Deno.env.get('SMARTSUITE_PROJECTS_TABLE')
  const videosTableId = Deno.env.get('SMARTSUITE_VIDEOS_TABLE')

  if (!apiKey || !workspaceId || !projectsTableId || !videosTableId) {
    console.error('Missing SmartSuite configuration:', {
      api_key_available: !!apiKey,
      workspace_id_available: !!workspaceId,
      projects_table_available: !!projectsTableId,
      videos_table_available: !!videosTableId
    })
    return null
  }

  return new SmartSuiteClient({
    apiKey,
    workspaceId,
    projectsTableId,
    videosTableId,
    timeout: 15000, // 15 second timeout for production
    maxRetries: 3
  })
}

/**
 * Handle validated and authenticated actions
 */
async function handleAction(requestBody: ValidRequest, user: any): Promise<Response> {
  console.log(`Handling action: ${requestBody.action} for user: ${user.id}`)

  // Initialize SmartSuite client
  const smartSuiteClient = createSmartSuiteClient()
  if (!smartSuiteClient) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'SmartSuite configuration missing - check environment variables',
        error_type: 'server_error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  switch (requestBody.action) {
    case 'fetch-projects':
      console.log(`Fetching projects for workspace: ${requestBody.workspace_id}`)

      const projectsResult = await smartSuiteClient.fetchProjects()
      if (!projectsResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: projectsResult.error,
            error_type: 'external_api_error'
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          projects: projectsResult.projects,
          count: projectsResult.projects.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

    case 'fetch-videos':
      console.log(`Fetching videos for project: ${requestBody.project_id}`)

      const videosResult = await smartSuiteClient.fetchVideos(requestBody.project_id)
      if (!videosResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: videosResult.error,
            error_type: 'external_api_error'
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          videos: videosResult.videos,
          count: videosResult.videos.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

    case 'upload-component':
      console.log(`Uploading component ${requestBody.component.id} to video: ${requestBody.video_id}`)

      const uploadResult = await smartSuiteClient.uploadComponent(requestBody.video_id, requestBody.component)
      if (!uploadResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: uploadResult.error,
            error_type: 'external_api_error'
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          component_id: uploadResult.component_id
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )

    default:
      // This should never happen due to Zod validation, but TypeScript doesn't know that
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unknown action: ${(requestBody as any).action}`,
          error_type: 'validation_error'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
  }
}

/**
 * Main request handler
 */
serve(async (req: Request) => {
  // Generate correlation ID for this request
  const correlationId = generateCorrelationId()
  const logger = createLogger(correlationId, {
    method: req.method,
    url: req.url
  })

  const startTime = Date.now()

  logger.info('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('User-Agent')
  })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logger.info('CORS preflight request handled')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. PARSE AND VALIDATE REQUEST BODY FIRST
    let rawRequestBody
    try {
      rawRequestBody = await req.json()
    } catch (error) {
      console.log('JSON parsing failed:', error.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body',
          error_type: 'validation_error'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 2. VALIDATE REQUEST SCHEMA
    const validationResult = validateRequest(rawRequestBody)
    if (!validationResult.success) {
      console.log('Request validation failed:', validationResult.error)
      return new Response(
        JSON.stringify({
          success: false,
          error: validationResult.error,
          error_type: 'validation_error'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const requestBody = validationResult.data
    console.log('Request validated successfully:', requestBody.action)

    // 3. HANDLE HEALTH CHECK (No auth required for basic health check)
    if (requestBody.action === 'health-check') {
      const smartsuiteApiKey = Deno.env.get('SMARTSUITE_API_KEY')
      const authHeader = req.headers.get('Authorization')

      console.log('Health check requested - returning status')
      return new Response(
        JSON.stringify({
          status: 'ok',
          env_available: !!smartsuiteApiKey,
          auth_provided: !!authHeader,
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 4. AUTHENTICATION REQUIRED FOR ALL OTHER ACTIONS
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Authentication failed: Missing Authorization header')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Authentication required'
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 5. VALIDATE JWT TOKEN
    const authResult = await validateJWT(authHeader)
    if (!authResult.success) {
      console.log('JWT validation failed:', authResult.error)
      return new Response(
        JSON.stringify({
          success: false,
          error: authResult.error
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 6. CHECK PERMISSIONS
    const permissionResult = checkPermissions(authResult.user, requestBody.action)
    if (!permissionResult.success) {
      console.log('Permission check failed:', permissionResult.error)
      return new Response(
        JSON.stringify({
          success: false,
          error: permissionResult.error
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 7. RATE LIMITING CHECK (CRITICAL: Prevents API exhaustion)
    const rateLimitResult = checkUserRateLimit(authResult.user.id, requestBody.action)
    if (!rateLimitResult.allowed) {
      console.warn(`Rate limit exceeded for user ${authResult.user.id} action ${requestBody.action}: ${rateLimitResult.currentCount} requests`)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Please slow down your requests.',
          rate_limit: {
            current: rateLimitResult.currentCount,
            reset_time: new Date(rateLimitResult.resetTime).toISOString(),
            retry_after: rateLimitResult.retryAfter
          }
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      )
    }

    console.log(`Rate limit check passed for user ${authResult.user.id} action ${requestBody.action}: ${rateLimitResult.currentCount} requests`)

    // 8. ROUTE TO ACTION HANDLER
    return await handleAction(requestBody, authResult.user)

  } catch (error) {
    const duration = Date.now() - startTime
    const errorInstance = error instanceof Error ? error : new Error('Unknown error')

    logger.error('Unexpected error in Edge Function', errorInstance, {
      duration,
      errorType: 'server_error'
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        error_type: 'server_error',
        correlation_id: correlationId // Include for debugging
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } finally {
    const duration = Date.now() - startTime
    logger.info('Request completed', { duration })
  }
})

// Log successful initialization
globalLogger.info('SmartSuite Sync Edge Function initialized successfully')

console.log('SmartSuite Sync Edge Function initialized successfully')
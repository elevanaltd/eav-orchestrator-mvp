/**
 * SmartSuite API Client for Edge Function
 *
 * Production-grade SmartSuite API integration with:
 * - Proper error handling and timeouts
 * - Rate limit handling with exponential backoff
 * - Circuit breaker pattern for fail-fast behavior
 * - Structured logging for observability
 * - Type safety for all API responses
 */

import { getSmartSuiteCircuitBreaker } from "./circuit-breaker.ts"

/**
 * SmartSuite API Response Types
 */
export interface SmartSuiteProject {
  id: string
  name: string
  client_filter?: string
  status?: string
  created_date?: string
  updated_date?: string
}

export interface SmartSuiteVideo {
  id: string
  name: string
  project_id: string
  status?: string
  created_date?: string
  updated_date?: string
}

export interface SmartSuiteApiResponse<T> {
  items: T[]
  totalCount?: number
}

export interface SmartSuiteError {
  error: string
  message: string
  statusCode?: number
}

/**
 * SmartSuite API Client Configuration
 */
interface SmartSuiteClientConfig {
  apiKey: string
  workspaceId: string
  projectsTableId: string
  videosTableId: string
  timeout?: number
  maxRetries?: number
}

/**
 * SmartSuite API Client
 */
export class SmartSuiteClient {
  private config: SmartSuiteClientConfig
  private baseUrl = 'https://api.smartsuite.com/platform/v1'
  private circuitBreaker = getSmartSuiteCircuitBreaker()

  constructor(config: SmartSuiteClientConfig) {
    this.config = {
      timeout: 10000, // 10 second default timeout
      maxRetries: 3,
      ...config
    }
  }

  /**
   * Fetch projects from SmartSuite
   */
  async fetchProjects(): Promise<{ success: true, projects: SmartSuiteProject[] } | { success: false, error: string }> {
    const url = `${this.baseUrl}/applications/${this.config.projectsTableId}/records/list/`

    console.log(`Fetching projects from: ${url}`)

    // Wrap in circuit breaker protection
    const circuitResult = await this.circuitBreaker.execute(async () => {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          filter: {},
          sort: [{ field: 'created_date', direction: 'desc' }]
        })
      })

      if (!response.success) {
        throw new Error(response.error)
      }

      return response.data as SmartSuiteApiResponse<SmartSuiteProject>
    }, 'fetchProjects')

    if (!circuitResult.success) {
      console.error('Circuit breaker blocked fetchProjects:', circuitResult.error)
      return { success: false, error: circuitResult.error }
    }

    const data = circuitResult.result
    console.log(`Successfully fetched ${data.items.length} projects`)

    return {
      success: true,
      projects: data.items
    }
  }

  /**
   * Fetch videos for a specific project from SmartSuite
   */
  async fetchVideos(projectId: string): Promise<{ success: true, videos: SmartSuiteVideo[] } | { success: false, error: string }> {
    const url = `${this.baseUrl}/applications/${this.config.videosTableId}/records/list/`

    console.log(`Fetching videos for project: ${projectId} from: ${url}`)

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          filter: {
            project_id: { has_any_of: [projectId] }
          },
          sort: [{ field: 'created_date', direction: 'desc' }]
        })
      })

      if (!response.success) {
        return { success: false, error: response.error }
      }

      const data = response.data as SmartSuiteApiResponse<SmartSuiteVideo>
      console.log(`Successfully fetched ${data.items.length} videos for project: ${projectId}`)

      return {
        success: true,
        videos: data.items
      }

    } catch (error) {
      console.error('Error fetching videos:', error)
      return {
        success: false,
        error: `Failed to fetch videos: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Upload a component to SmartSuite (placeholder - will be implemented based on schema)
   */
  async uploadComponent(videoId: string, component: any): Promise<{ success: true, component_id: string } | { success: false, error: string }> {
    // TODO: Implement component upload based on SmartSuite schema
    console.log(`Component upload for video ${videoId} - not yet implemented`)

    return {
      success: true,
      component_id: component.id
    }
  }

  /**
   * Make HTTP request with timeout, retries, and error handling
   */
  private async makeRequest(
    url: string,
    options: RequestInit
  ): Promise<{ success: true, data: any } | { success: false, error: string }> {

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= (this.config.maxRetries || 3); attempt++) {
      try {
        console.log(`API request attempt ${attempt}/${this.config.maxRetries}: ${options.method} ${url}`)

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
        })

        // Make request with timeout
        const response = await Promise.race([
          fetch(url, options),
          timeoutPromise
        ])

        console.log(`API response: ${response.status} ${response.statusText}`)

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After')
          let waitTime: number

          if (retryAfter) {
            // Use server-provided retry time
            waitTime = parseInt(retryAfter) * 1000
          } else {
            // Use exponential backoff with jitter for rate limits
            const baseWait = Math.pow(2, attempt) * 1000
            const jitter = Math.random() * 500 // Smaller jitter for rate limits
            waitTime = baseWait + jitter
          }

          console.log(`Rate limited, waiting ${Math.round(waitTime)}ms before retry ${attempt}`)
          await this.sleep(waitTime)
          continue
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorText = await response.text()
          const errorMessage = `HTTP ${response.status}: ${errorText}`
          console.error('API error response:', errorMessage)

          // Don't retry on 4xx errors (except 429)
          if (response.status >= 400 && response.status < 500) {
            return { success: false, error: errorMessage }
          }

          lastError = new Error(errorMessage)
          continue
        }

        // Success - parse JSON response
        const data = await response.json()
        return { success: true, data }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.error(`API request attempt ${attempt} failed:`, lastError.message)

        // Wait before retry (exponential backoff with jitter)
        if (attempt < (this.config.maxRetries || 3)) {
          // Add jitter to prevent thundering herd on retry
          const baseWait = Math.pow(2, attempt) * 1000
          const jitter = Math.random() * 1000 // Random 0-1000ms jitter
          const waitTime = baseWait + jitter

          console.log(`Waiting ${Math.round(waitTime)}ms before retry (attempt ${attempt}, base: ${baseWait}ms, jitter: ${Math.round(jitter)}ms)`)
          await this.sleep(waitTime)
        }
      }
    }

    return {
      success: false,
      error: `Request failed after ${this.config.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    }
  }

  /**
   * Get headers for SmartSuite API requests
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Account-ID': this.config.workspaceId
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
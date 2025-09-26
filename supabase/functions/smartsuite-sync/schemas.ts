/**
 * Input validation schemas for SmartSuite Sync Edge Function
 * Using Zod for runtime type validation
 */

// Import Zod for Deno
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts"

/**
 * Base request schema - all requests must have an action field
 */
export const BaseRequestSchema = z.object({
  action: z.string().min(1, "Action is required")
})

/**
 * Health check request schema
 */
export const HealthCheckRequestSchema = BaseRequestSchema.extend({
  action: z.literal("health-check")
})

/**
 * Fetch projects request schema
 */
export const FetchProjectsRequestSchema = BaseRequestSchema.extend({
  action: z.literal("fetch-projects"),
  workspace_id: z.string().min(1, "Workspace ID is required")
})

/**
 * Fetch videos request schema
 */
export const FetchVideosRequestSchema = BaseRequestSchema.extend({
  action: z.literal("fetch-videos"),
  workspace_id: z.string().min(1, "Workspace ID is required"),
  project_id: z.string().min(1, "Project ID is required")
})

/**
 * Upload component request schema
 */
export const UploadComponentRequestSchema = BaseRequestSchema.extend({
  action: z.literal("upload-component"),
  workspace_id: z.string().min(1, "Workspace ID is required"),
  project_id: z.string().min(1, "Project ID is required"),
  video_id: z.string().min(1, "Video ID is required"),
  component: z.object({
    id: z.string().min(1, "Component ID is required"),
    content: z.string().min(1, "Component content is required"),
    order: z.number().int().min(1, "Component order must be a positive integer"),
    type: z.enum(["paragraph", "heading", "list", "quote"]).default("paragraph")
  })
})

/**
 * Union of all valid request schemas
 */
export const RequestSchema = z.discriminatedUnion("action", [
  HealthCheckRequestSchema,
  FetchProjectsRequestSchema,
  FetchVideosRequestSchema,
  UploadComponentRequestSchema
])

/**
 * Type inference from schemas
 */
export type BaseRequest = z.infer<typeof BaseRequestSchema>
export type HealthCheckRequest = z.infer<typeof HealthCheckRequestSchema>
export type FetchProjectsRequest = z.infer<typeof FetchProjectsRequestSchema>
export type FetchVideosRequest = z.infer<typeof FetchVideosRequestSchema>
export type UploadComponentRequest = z.infer<typeof UploadComponentRequestSchema>
export type ValidRequest = z.infer<typeof RequestSchema>

/**
 * Validation helper function
 */
export function validateRequest(data: unknown): { success: true, data: ValidRequest } | { success: false, error: string } {
  try {
    const result = RequestSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
      return { success: false, error: `Validation error: ${errorMessages}` }
    }
    return { success: false, error: 'Unknown validation error' }
  }
}
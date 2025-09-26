/**
 * Rate Limiting Implementation for SmartSuite Edge Function
 *
 * CRITICAL FIX: Prevents thundering herd and API quota exhaustion
 * Uses in-memory storage for Edge Function (single instance)
 * Production would use Redis/Upstash for distributed rate limiting
 */

interface RateLimitEntry {
  count: number
  windowStart: number
  lastAccess: number
}

interface RateLimitConfig {
  windowSize: number // Window size in milliseconds
  maxRequests: number // Max requests per window
  cleanupInterval: number // Cleanup interval in milliseconds
}

/**
 * Simple in-memory rate limiter for Edge Function
 * PRODUCTION NOTE: Replace with Redis/Upstash for multi-instance deployment
 */
export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig
  private lastCleanup = Date.now()

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  /**
   * Check if request should be allowed based on rate limiting
   */
  checkLimit(key: string): {
    allowed: boolean
    currentCount: number
    resetTime: number
    retryAfter?: number
  } {
    const now = Date.now()

    // Clean up old entries periodically
    this.cleanup(now)

    // Get or create entry for this key
    let entry = this.entries.get(key)
    const windowStart = Math.floor(now / this.config.windowSize) * this.config.windowSize

    if (!entry || entry.windowStart !== windowStart) {
      // New window or first request
      entry = {
        count: 1,
        windowStart,
        lastAccess: now
      }
      this.entries.set(key, entry)

      return {
        allowed: true,
        currentCount: 1,
        resetTime: windowStart + this.config.windowSize
      }
    }

    // Update existing entry
    entry.count++
    entry.lastAccess = now

    if (entry.count > this.config.maxRequests) {
      // Rate limit exceeded
      const resetTime = windowStart + this.config.windowSize
      const retryAfter = Math.ceil((resetTime - now) / 1000) // Convert to seconds

      console.warn(`Rate limit exceeded for key: ${key}, count: ${entry.count}/${this.config.maxRequests}`)

      return {
        allowed: false,
        currentCount: entry.count,
        resetTime,
        retryAfter
      }
    }

    // Request allowed
    return {
      allowed: true,
      currentCount: entry.count,
      resetTime: windowStart + this.config.windowSize
    }
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  private cleanup(now: number) {
    if (now - this.lastCleanup < this.config.cleanupInterval) {
      return
    }

    const cutoff = now - (this.config.windowSize * 2) // Keep 2 windows of history

    for (const [key, entry] of this.entries) {
      if (entry.lastAccess < cutoff) {
        this.entries.delete(key)
      }
    }

    this.lastCleanup = now
    console.log(`Rate limiter cleanup: ${this.entries.size} entries remaining`)
  }

  /**
   * Get current stats for monitoring
   */
  getStats(): { totalKeys: number, lastCleanup: number } {
    return {
      totalKeys: this.entries.size,
      lastCleanup: this.lastCleanup
    }
  }
}

/**
 * Production-grade rate limit configurations
 */
export const RATE_LIMIT_CONFIGS = {
  // Conservative limits to prevent API exhaustion
  'fetch-projects': {
    windowSize: 60000, // 1 minute
    maxRequests: 10, // 10 requests per minute per user
    cleanupInterval: 300000 // 5 minutes
  },
  'fetch-videos': {
    windowSize: 60000,
    maxRequests: 20, // More videos requests expected
    cleanupInterval: 300000
  },
  'upload-component': {
    windowSize: 60000,
    maxRequests: 50, // Components uploaded in batches
    cleanupInterval: 300000
  }
} as const

/**
 * Global rate limiter instances
 */
const rateLimiters = new Map<string, RateLimiter>()

/**
 * Get or create rate limiter for specific action
 */
function getRateLimiter(action: string): RateLimiter {
  if (!rateLimiters.has(action)) {
    const config = RATE_LIMIT_CONFIGS[action as keyof typeof RATE_LIMIT_CONFIGS] || {
      windowSize: 60000,
      maxRequests: 30,
      cleanupInterval: 300000
    }
    rateLimiters.set(action, new RateLimiter(config))
  }
  return rateLimiters.get(action)!
}

/**
 * Check rate limit for user action combination
 */
export function checkUserRateLimit(userId: string, action: string): {
  allowed: boolean
  currentCount: number
  resetTime: number
  retryAfter?: number
} {
  const rateLimiter = getRateLimiter(action)
  const key = `${userId}:${action}`

  return rateLimiter.checkLimit(key)
}
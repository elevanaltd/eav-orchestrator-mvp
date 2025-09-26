/**
 * Structured Logging Implementation
 *
 * HIGH PRIORITY FIX: Enables proper production debugging with correlation IDs
 * Replaces generic console.log calls with structured, searchable logs
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  correlationId: string
  userId?: string
  action?: string
  operationName?: string
  requestId?: string
  [key: string]: any
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
  metadata?: Record<string, any>
}

/**
 * Structured Logger for Edge Function
 */
export class Logger {
  private context: LogContext

  constructor(context: LogContext) {
    this.context = { ...context }
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext
    })
  }

  /**
   * Debug level logging
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  /**
   * Info level logging
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, metadata)
  }

  /**
   * Warning level logging
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, metadata)
  }

  /**
   * Error level logging
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context: this.context,
      metadata
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    console.error(JSON.stringify(logEntry))
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata
    }

    // Use appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(JSON.stringify(logEntry))
        break
      case LogLevel.INFO:
        console.info(JSON.stringify(logEntry))
        break
      case LogLevel.WARN:
        console.warn(JSON.stringify(logEntry))
        break
      case LogLevel.ERROR:
        console.error(JSON.stringify(logEntry))
        break
    }
  }

  /**
   * Log operation start
   */
  startOperation(operationName: string, metadata?: Record<string, any>): Logger {
    const operationLogger = this.child({
      operationName,
      operationStart: new Date().toISOString()
    })

    operationLogger.info(`Starting operation: ${operationName}`, metadata)
    return operationLogger
  }

  /**
   * Log operation completion
   */
  endOperation(operationName: string, success: boolean, duration?: number, metadata?: Record<string, any>): void {
    const logMetadata = {
      ...metadata,
      success,
      duration: duration || 0
    }

    if (success) {
      this.info(`Completed operation: ${operationName}`, logMetadata)
    } else {
      this.warn(`Failed operation: ${operationName}`, logMetadata)
    }
  }

  /**
   * Log HTTP request details
   */
  logHttpRequest(method: string, url: string, statusCode?: number, duration?: number): void {
    this.info('HTTP request', {
      http: {
        method,
        url,
        statusCode,
        duration
      }
    })
  }

  /**
   * Log rate limit information
   */
  logRateLimit(action: string, current: number, limit: number, allowed: boolean): void {
    const level = allowed ? LogLevel.INFO : LogLevel.WARN
    const message = allowed ? 'Rate limit check passed' : 'Rate limit exceeded'

    this.log(level, message, {
      rateLimit: {
        action,
        current,
        limit,
        allowed
      }
    })
  }

  /**
   * Log circuit breaker state
   */
  logCircuitBreaker(state: string, operation: string, metadata?: Record<string, any>): void {
    this.info('Circuit breaker state', {
      circuitBreaker: {
        state,
        operation,
        ...metadata
      }
    })
  }
}

/**
 * Generate correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create logger for Edge Function request
 */
export function createLogger(correlationId: string, additionalContext?: Partial<LogContext>): Logger {
  return new Logger({
    correlationId,
    service: 'smartsuite-sync',
    environment: 'edge-function',
    ...additionalContext
  })
}

/**
 * Global logger for non-request specific logging
 */
export const globalLogger = new Logger({
  correlationId: 'global',
  service: 'smartsuite-sync',
  environment: 'edge-function'
})
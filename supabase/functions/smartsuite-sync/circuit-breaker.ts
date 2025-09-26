/**
 * Circuit Breaker Pattern Implementation
 *
 * HIGH PRIORITY FIX: Prevents cascading failures during SmartSuite API outages
 * Implements fail-fast pattern to avoid waiting for full timeouts
 */

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast, not attempting requests
  HALF_OPEN = 'half-open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures to open circuit
  resetTimeoutMs: number        // Time to wait before trying half-open
  monitoringWindowMs: number    // Time window to track failures
  halfOpenMaxCalls: number      // Max calls to test in half-open state
}

export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime: number
  lastSuccessTime: number
  nextAttemptTime: number
  totalRequests: number
}

/**
 * Production-grade Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures: number = 0
  private successes: number = 0
  private lastFailureTime: number = 0
  private lastSuccessTime: number = 0
  private nextAttemptTime: number = 0
  private halfOpenCalls: number = 0
  private totalRequests: number = 0
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ success: true; result: T } | { success: false; error: string; reason: 'circuit-open' | 'operation-failed' }> {

    const now = Date.now()
    this.totalRequests++

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (now < this.nextAttemptTime) {
        console.warn(`Circuit breaker OPEN for ${operationName}. Next attempt in ${this.nextAttemptTime - now}ms`)
        return {
          success: false,
          error: `Service temporarily unavailable. Circuit breaker is open until ${new Date(this.nextAttemptTime).toISOString()}`,
          reason: 'circuit-open'
        }
      } else {
        // Transition to half-open to test the service
        this.state = CircuitState.HALF_OPEN
        this.halfOpenCalls = 0
        console.log(`Circuit breaker transitioning to HALF-OPEN for ${operationName}`)
      }
    }

    // In half-open state, limit the number of test calls
    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      console.warn(`Circuit breaker HALF-OPEN limit reached for ${operationName}`)
      return {
        success: false,
        error: 'Service is being tested for recovery. Please try again shortly.',
        reason: 'circuit-open'
      }
    }

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++
    }

    // Execute the operation
    try {
      console.log(`Executing ${operationName} with circuit breaker in ${this.state} state`)
      const result = await operation()

      // Operation succeeded
      this.onSuccess()
      console.log(`Circuit breaker SUCCESS for ${operationName}. State: ${this.state}`)

      return { success: true, result }

    } catch (error) {
      // Operation failed
      this.onFailure()
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      console.error(`Circuit breaker FAILURE for ${operationName}: ${errorMessage}. State: ${this.state}`)

      return {
        success: false,
        error: errorMessage,
        reason: 'operation-failed'
      }
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successes++
    this.lastSuccessTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      // Enough successful calls in half-open, close the circuit
      if (this.successes >= this.config.halfOpenMaxCalls) {
        this.state = CircuitState.CLOSED
        this.failures = 0
        console.log('Circuit breaker closed - service recovered')
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failures = 0
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in half-open state, immediately open circuit
      this.openCircuit()
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we should open the circuit
      if (this.failures >= this.config.failureThreshold) {
        this.openCircuit()
      }
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN
    this.nextAttemptTime = Date.now() + this.config.resetTimeoutMs
    this.successes = 0
    console.warn(`Circuit breaker OPENED. Next attempt at: ${new Date(this.nextAttemptTime).toISOString()}`)
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      totalRequests: this.totalRequests
    }
  }

  /**
   * Manually reset circuit breaker (admin operation)
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failures = 0
    this.successes = 0
    this.halfOpenCalls = 0
    this.nextAttemptTime = 0
    console.log('Circuit breaker manually reset')
  }
}

/**
 * Production circuit breaker configuration for SmartSuite API
 */
export const SMARTSUITE_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeoutMs: 30000,    // Wait 30 seconds before testing
  monitoringWindowMs: 60000, // Track failures over 1 minute
  halfOpenMaxCalls: 3       // Test with 3 calls in half-open
}

/**
 * Global circuit breaker instance for SmartSuite API
 */
let smartSuiteCircuitBreaker: CircuitBreaker | null = null

/**
 * Get or create the SmartSuite circuit breaker
 */
export function getSmartSuiteCircuitBreaker(): CircuitBreaker {
  if (!smartSuiteCircuitBreaker) {
    smartSuiteCircuitBreaker = new CircuitBreaker(SMARTSUITE_CIRCUIT_CONFIG)
  }
  return smartSuiteCircuitBreaker
}
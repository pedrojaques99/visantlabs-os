/**
 * AI Resilience Layer
 *
 * Circuit breaker + retry policies for AI provider calls.
 * Prevents cascading failures and provides intelligent retry with backoff.
 */

import {
  circuitBreaker,
  retry,
  wrap,
  handleAll,
  ConsecutiveBreaker,
  ExponentialBackoff,
  CircuitState,
  type IPolicy,
} from 'cockatiel';

// Event emitter for monitoring
type ResilienceEvent = {
  type: 'retry' | 'circuit-open' | 'circuit-close' | 'circuit-half-open';
  provider: string;
  attempt?: number;
  error?: string;
};

const listeners: ((event: ResilienceEvent) => void)[] = [];

export function onResilienceEvent(listener: (event: ResilienceEvent) => void) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function emit(event: ResilienceEvent) {
  listeners.forEach(l => l(event));
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AI-Resilience] ${event.type}`, event);
  }
}

// Retry policy: exponential backoff, max 3 attempts
const createRetryPolicy = (provider: string) => {
  const policy = retry(handleAll, {
    maxAttempts: 3,
    backoff: new ExponentialBackoff({
      initialDelay: 1000,
      maxDelay: 10000,
      exponent: 2,
    }),
  });

  policy.onRetry(({ attempt }) => {
    emit({ type: 'retry', provider, attempt });
  });

  return policy;
};

// Circuit breaker: opens after 3 consecutive failures, half-open after 30s
const createBreakerPolicy = (provider: string) => {
  const policy = circuitBreaker(handleAll, {
    halfOpenAfter: 30_000,
    breaker: new ConsecutiveBreaker(3),
  });

  policy.onStateChange((state) => {
    if (state === CircuitState.Open) {
      emit({ type: 'circuit-open', provider });
    } else if (state === CircuitState.Closed) {
      emit({ type: 'circuit-close', provider });
    } else if (state === CircuitState.HalfOpen) {
      emit({ type: 'circuit-half-open', provider });
    }
  });

  return policy;
};

// Combined policies per provider
const policies: Map<string, IPolicy> = new Map();

function getPolicy(provider: string): IPolicy {
  if (!policies.has(provider)) {
    const retryPolicy = createRetryPolicy(provider);
    const breakerPolicy = createBreakerPolicy(provider);
    // Wrap: retry first, then circuit breaker
    policies.set(provider, wrap(retryPolicy, breakerPolicy));
  }
  return policies.get(provider)!;
}

/**
 * Execute an AI call with circuit breaker + retry protection.
 *
 * @param provider - Provider name for tracking (e.g., 'gemini', 'claude')
 * @param fn - The async function to execute
 * @returns The result of the function
 * @throws If all retries fail or circuit is open
 */
export async function withResilience<T>(
  provider: string,
  fn: () => Promise<T>
): Promise<T> {
  const policy = getPolicy(provider);
  return policy.execute(fn);
}

/**
 * Check if a provider's circuit is currently open (unavailable).
 */
export function isCircuitOpen(provider: string): boolean {
  const policy = policies.get(provider);
  if (!policy) return false;
  // cockatiel doesn't expose state directly, but we track via events
  return false; // TODO: track state internally if needed
}

/**
 * Get circuit breaker stats for monitoring.
 */
export function getResilienceStats(): Record<string, { state: string }> {
  const stats: Record<string, { state: string }> = {};
  for (const [provider] of policies) {
    stats[provider] = { state: 'unknown' }; // Would need internal tracking
  }
  return stats;
}

// Custom error types that should NOT trigger retry
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ModelOverloadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelOverloadedError';
  }
}

/**
 * Determine if an error should trigger a retry.
 * Rate limits and certain errors should fail fast.
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof RateLimitError) return false;

  const message = error instanceof Error ? error.message : String(error);

  // Don't retry rate limits
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    return false;
  }

  // Don't retry auth errors
  if (message.includes('401') || message.includes('403')) {
    return false;
  }

  // Don't retry validation errors
  if (message.includes('400') || message.toLowerCase().includes('invalid')) {
    return false;
  }

  return true;
}

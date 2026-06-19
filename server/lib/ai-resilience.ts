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
  handleWhen,
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
  listeners.forEach((l) => l(event));
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AI-Resilience] ${event.type}`, event);
  }
}

// Retry policy: exponential backoff, max 3 attempts.
// Only retry errors shouldRetry() classifies as transient — rate limits, auth,
// validation (400) and safety/content blocks (422) fail fast so we don't burn
// 3 attempts on a request that is deterministically going to be rejected again.
const createRetryPolicy = (provider: string) => {
  const policy = retry(handleWhen(shouldRetry), {
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

// Live circuit state per provider, tracked off the breaker's onStateChange so
// callers (e.g. the image fallback router) can skip a provider whose circuit is
// open without paying a failed attempt to discover it.
const circuitStateByProvider: Map<string, CircuitState> = new Map();

// Circuit breaker: opens after 3 consecutive failures, half-open after 30s
const createBreakerPolicy = (provider: string) => {
  const policy = circuitBreaker(handleAll, {
    halfOpenAfter: 30_000,
    breaker: new ConsecutiveBreaker(3),
  });

  policy.onStateChange((state) => {
    circuitStateByProvider.set(provider, state);
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
export async function withResilience<T>(provider: string, fn: () => Promise<T>): Promise<T> {
  const policy = getPolicy(provider);
  return policy.execute(fn);
}

/**
 * Check if a provider's circuit is currently open (unavailable).
 * Half-open counts as available — cockatiel will let a probe through.
 */
export function isCircuitOpen(provider: string): boolean {
  return circuitStateByProvider.get(provider) === CircuitState.Open;
}

/**
 * Get circuit breaker stats for monitoring.
 */
export function getResilienceStats(): Record<string, { state: string }> {
  const stats: Record<string, { state: string }> = {};
  for (const [provider] of policies) {
    const state = circuitStateByProvider.get(provider);
    stats[provider] = { state: state ? CircuitState[state] : 'closed' };
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

  // Classify by error name too — services define their own terminal error
  // classes (e.g. geminiService's RateLimitError / ModelOverloadedError /
  // ModelResponseTextError) that can't be reached via instanceof across module
  // boundaries. ModelResponseTextError means the model deterministically
  // returned text instead of an image (refusal / clarifying question) — same
  // prompt will do it again, so don't retry.
  const name = error instanceof Error ? error.name : '';
  if (
    name === 'RateLimitError' ||
    name === 'ModelOverloadedError' ||
    name === 'ModelResponseTextError'
  ) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Don't retry rate limits
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    return false;
  }

  // Don't retry auth errors
  if (message.includes('401') || message.includes('403')) {
    return false;
  }

  // Don't retry billing / insufficient-funds errors (402) — deterministic.
  if (message.includes('402') || message.toLowerCase().includes('insufficient')) {
    return false;
  }

  // Don't retry validation errors
  if (message.includes('400') || message.toLowerCase().includes('invalid')) {
    return false;
  }

  // Don't retry safety / content-policy blocks (422) — the same prompt will be
  // blocked again, so retrying only wastes attempts and latency.
  const lower = message.toLowerCase();
  if (
    message.includes('422') ||
    lower.includes('safety') ||
    lower.includes('blocked') ||
    lower.includes('content policy') ||
    lower.includes('content_policy') ||
    lower.includes('moderation')
  ) {
    return false;
  }

  // Don't retry errors that already came from an exhausted inner retry loop
  // (e.g. geminiService.withRetry throws ModelOverloadedError only after burning
  // all its 503 attempts). Retrying here would re-run that whole loop — a
  // double-retry. We still want the circuit breaker to count the failure, but
  // not the retry policy to repeat it.
  if (lower.includes('overloaded') || (lower.includes('after') && lower.includes('attempts'))) {
    return false;
  }

  return true;
}

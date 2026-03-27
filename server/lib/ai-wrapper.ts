/**
 * AI Wrapper - Unified interface for AI calls with resilience + observability
 *
 * Combines:
 * - Circuit breaker (prevents cascading failures)
 * - Observability (structured logging, metrics)
 * - Request context (tracing)
 *
 * Usage:
 *   const { result } = await aiCall('gemini', () => generateMockup(...));
 */

import { withResilience, onResilienceEvent } from './ai-resilience.js';
import { getRequestId, addContextMetadata } from './request-context.js';
import {
  startTrace,
  endTrace,
  getObservabilityMetrics,
  getRecentTraces,
} from './ai-observability.js';

export interface AICallOptions {
  /** Skip resilience wrapper (for already-protected calls) */
  skipResilience?: boolean;

  /** Metadata for tracing */
  metadata?: Record<string, unknown>;
}

/**
 * Execute an AI call with resilience and observability.
 *
 * @param provider - AI provider name for circuit breaker
 * @param fn - The async function to execute
 * @param options - Configuration options
 */
export async function aiCall<T>(
  provider: 'gemini' | 'claude' | 'openai',
  fn: () => Promise<T>,
  options?: AICallOptions
): Promise<{ result: T; requestId: string }> {
  const requestId = getRequestId();
  const trace = startTrace(provider, options?.metadata?.operation as string || 'ai-call', options?.metadata);

  // Add metadata to context for tracing
  if (options?.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      addContextMetadata(key, value);
    }
  }
  addContextMetadata('ai.provider', provider);

  try {
    const result = options?.skipResilience
      ? await fn()
      : await withResilience(provider, fn);

    endTrace(trace, {});

    return { result, requestId };
  } catch (error) {
    endTrace(trace, { error: error instanceof Error ? error.message : String(error) });
    addContextMetadata('ai.error', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Convenience wrapper for Gemini calls.
 */
export async function geminiCall<T>(
  fn: () => Promise<T>,
  options?: AICallOptions
): Promise<{ result: T; requestId: string }> {
  return aiCall('gemini', fn, options);
}

/**
 * Convenience wrapper for Claude calls.
 */
export async function claudeCall<T>(
  fn: () => Promise<T>,
  options?: AICallOptions
): Promise<{ result: T; requestId: string }> {
  return aiCall('claude', fn, options);
}

// Re-export utilities
export { onResilienceEvent, getRecentTraces };

/**
 * Get AI metrics (observability).
 */
export function getAIMetrics() {
  return getObservabilityMetrics();
}

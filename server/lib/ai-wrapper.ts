/**
 * AI Wrapper - Unified interface for AI calls with resilience + caching
 *
 * Combines:
 * - Circuit breaker (prevents cascading failures)
 * - Semantic cache (reduces costs ~40%)
 * - Request context (tracing)
 *
 * Usage:
 *   const result = await aiCall('gemini', () => generateMockup(...), {
 *     cache: { enabled: true, brandId: 'xxx' },
 *   });
 */

import { withResilience, onResilienceEvent } from './ai-resilience.js';
import {
  withSemanticCache,
  getCacheMetrics,
  clearCache,
} from './semantic-cache.js';
import { getRequestId, addContextMetadata } from './request-context.js';

export interface AICallOptions {
  /** Provider name for circuit breaker tracking */
  provider?: 'gemini' | 'claude' | 'openai';

  /** Semantic cache options */
  cache?: {
    enabled: boolean;
    brandId?: string;
    /** Key to use for cache (defaults to prompt if string result) */
    cacheKey?: string;
  };

  /** Skip resilience wrapper (for already-protected calls) */
  skipResilience?: boolean;

  /** Metadata for tracing */
  metadata?: Record<string, unknown>;
}

/**
 * Execute an AI call with resilience and optional caching.
 *
 * @param provider - AI provider name for circuit breaker
 * @param fn - The async function to execute
 * @param options - Configuration options
 */
export async function aiCall<T>(
  provider: 'gemini' | 'claude' | 'openai',
  fn: () => Promise<T>,
  options?: AICallOptions
): Promise<{ result: T; fromCache: boolean; requestId: string }> {
  const requestId = getRequestId();
  const startTime = Date.now();

  // Add metadata to context for tracing
  if (options?.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      addContextMetadata(key, value);
    }
  }
  addContextMetadata('ai.provider', provider);

  try {
    // If caching is enabled and we have a cache key
    if (options?.cache?.enabled && options.cache.cacheKey) {
      const cacheResult = await withSemanticCache(
        options.cache.cacheKey,
        async () => {
          // Execute with resilience
          const result = options.skipResilience
            ? await fn()
            : await withResilience(provider, fn);
          // Cache only works with string results
          return result as string;
        },
        { brandId: options.cache.brandId }
      );

      addContextMetadata('ai.fromCache', cacheResult.fromCache);
      addContextMetadata('ai.duration', Date.now() - startTime);

      return {
        result: cacheResult.result as T,
        fromCache: cacheResult.fromCache,
        requestId,
      };
    }

    // No caching, just resilience
    const result = options?.skipResilience
      ? await fn()
      : await withResilience(provider, fn);

    addContextMetadata('ai.fromCache', false);
    addContextMetadata('ai.duration', Date.now() - startTime);

    return { result, fromCache: false, requestId };
  } catch (error) {
    addContextMetadata('ai.error', error instanceof Error ? error.message : String(error));
    addContextMetadata('ai.duration', Date.now() - startTime);
    throw error;
  }
}

/**
 * Convenience wrapper for Gemini calls.
 */
export async function geminiCall<T>(
  fn: () => Promise<T>,
  options?: Omit<AICallOptions, 'provider'>
): Promise<{ result: T; fromCache: boolean; requestId: string }> {
  return aiCall('gemini', fn, { ...options, provider: 'gemini' });
}

/**
 * Convenience wrapper for Claude calls.
 */
export async function claudeCall<T>(
  fn: () => Promise<T>,
  options?: Omit<AICallOptions, 'provider'>
): Promise<{ result: T; fromCache: boolean; requestId: string }> {
  return aiCall('claude', fn, { ...options, provider: 'claude' });
}

// Re-export utilities
export { getCacheMetrics, clearCache, onResilienceEvent };

/**
 * Get combined AI metrics (cache + resilience).
 */
export function getAIMetrics() {
  return {
    cache: getCacheMetrics(),
    // resilience stats would go here when implemented
  };
}

/**
 * AI Wrapper Tests
 *
 * Tests the resilience layer:
 * - Circuit breaker (prevents cascading failures)
 * - Request context (tracing, isolation)
 * - Observability (metrics, error handling)
 *
 * CRITICAL PATH: This module handles all AI calls. Failures here cascade.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiCall, geminiCall } from '@server/lib/ai-wrapper';

// Mock dependencies
vi.mock('@server/lib/ai-resilience', () => ({
  withResilience: vi.fn(async (_provider, fn) => fn()),
  onResilienceEvent: vi.fn(),
}));

vi.mock('@server/lib/request-context', () => ({
  getRequestId: vi.fn().mockReturnValue('test-req-123'),
  addContextMetadata: vi.fn(),
  runWithContext: vi.fn(async (_, next) => next()),
}));

vi.mock('@server/lib/ai-observability', () => ({
  startTrace: vi.fn().mockReturnValue({ id: 'trace-123', startTime: Date.now() }),
  endTrace: vi.fn(),
  getObservabilityMetrics: vi.fn().mockReturnValue({
    totalCalls: 0,
    totalTokens: 0,
    estimatedCost: 0,
    avgLatency: 0,
    errorRate: 0,
  }),
  getRecentTraces: vi.fn().mockReturnValue([]),
}));

describe('aiCall (Core AI Wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should execute successfully and return result with requestId', async () => {
      const testResult = 'Generated mockup data';
      const fn = vi.fn().mockResolvedValueOnce(testResult);

      const { result, requestId } = await aiCall('gemini', fn);

      expect(result).toBe(testResult);
      expect(requestId).toBe('test-req-123');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should preserve generic type information', async () => {
      interface MockupOutput {
        id: string;
        content: string;
      }

      const expected: MockupOutput = {
        id: 'mockup-001',
        content: 'Design generated',
      };

      const fn = vi.fn().mockResolvedValueOnce(expected);

      const { result } = await aiCall<MockupOutput>('gemini', fn);

      expect(result.id).toBe('mockup-001');
      expect(result.content).toBe('Design generated');
    });

    it('should add metadata to context when provided', async () => {
      const { addContextMetadata } = await import('@server/lib/request-context');

      const fn = vi.fn().mockResolvedValueOnce('result');
      const metadata = { operation: 'generate_mockup', brandId: 'brand-123' };

      await aiCall('gemini', fn, { metadata });

      expect(addContextMetadata).toHaveBeenCalledWith('ai.provider', 'gemini');
      expect(addContextMetadata).toHaveBeenCalledWith('operation', 'generate_mockup');
      expect(addContextMetadata).toHaveBeenCalledWith('brandId', 'brand-123');
    });
  });

  describe('Error Handling', () => {
    it('should catch and re-throw errors', async () => {
      const testError = new Error('Gemini API timeout');
      const fn = vi.fn().mockRejectedValueOnce(testError);

      await expect(aiCall('gemini', fn)).rejects.toThrow('Gemini API timeout');
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should handle non-Error objects as errors', async () => {
      const fn = vi.fn().mockRejectedValueOnce('String error');

      await expect(aiCall('gemini', fn)).rejects.toMatch('String error');
    });

    it('should log errors to context on failure', async () => {
      const { addContextMetadata } = await import('@server/lib/request-context');

      const error = new Error('Rate limit exceeded');
      const fn = vi.fn().mockRejectedValueOnce(error);

      try {
        await aiCall('gemini', fn);
      } catch {
        // Expected
      }

      expect(addContextMetadata).toHaveBeenCalledWith('ai.error', 'Rate limit exceeded');
    });
  });

  describe('Circuit Breaker Bypass', () => {
    it('should skip resilience when skipResilience is true', async () => {
      const { withResilience } = await import('@server/lib/ai-resilience');

      const fn = vi.fn().mockResolvedValueOnce('direct result');

      await aiCall('gemini', fn, { skipResilience: true });

      expect(withResilience).not.toHaveBeenCalled();
      expect(fn).toHaveBeenCalledOnce();
    });

    it('should apply resilience by default', async () => {
      const { withResilience } = await import('@server/lib/ai-resilience');

      const fn = vi.fn().mockResolvedValueOnce('resilient result');

      await aiCall('gemini', fn);

      expect(withResilience).toHaveBeenCalledOnce();
    });
  });

  describe('Provider Routing', () => {
    it('should route to correct provider (gemini)', async () => {
      const fn = vi.fn().mockResolvedValueOnce('gemini result');

      const { result } = await aiCall('gemini', fn);

      expect(result).toBe('gemini result');
    });

    it('should route to correct provider (claude)', async () => {
      const fn = vi.fn().mockResolvedValueOnce('claude result');

      const { result } = await aiCall('claude', fn);

      expect(result).toBe('claude result');
    });

    it('should route to correct provider (openai)', async () => {
      const fn = vi.fn().mockResolvedValueOnce('openai result');

      const { result } = await aiCall('openai', fn);

      expect(result).toBe('openai result');
    });
  });
});

describe('geminiCall (Convenience Wrapper)', () => {
  it('should delegate to aiCall with gemini provider', async () => {
    const fn = vi.fn().mockResolvedValueOnce('mockup data');

    const { result, requestId } = await geminiCall(fn);

    expect(result).toBe('mockup data');
    expect(requestId).toBe('test-req-123');
  });

  it('should support metadata option', async () => {
    const { addContextMetadata } = await import('@server/lib/request-context');

    const fn = vi.fn().mockResolvedValueOnce('result');
    const metadata = { operation: 'analyze_brand' };

    await geminiCall(fn, { metadata });

    expect(addContextMetadata).toHaveBeenCalledWith('operation', 'analyze_brand');
  });
});

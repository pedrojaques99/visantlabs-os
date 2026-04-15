import { describe, it, expect } from 'vitest';
import {
  withResilience,
  shouldRetry,
  RateLimitError,
  ModelOverloadedError,
  onResilienceEvent,
  getResilienceStats,
} from '../../../../server/lib/ai-resilience.js';

describe('shouldRetry', () => {
  it('does NOT retry RateLimitError', () => {
    expect(shouldRetry(new RateLimitError('quota'))).toBe(false);
  });

  it('does NOT retry 429 / rate-limit messages', () => {
    expect(shouldRetry(new Error('HTTP 429 Too Many Requests'))).toBe(false);
    expect(shouldRetry(new Error('rate limit exceeded'))).toBe(false);
  });

  it('does NOT retry auth errors (401/403)', () => {
    expect(shouldRetry(new Error('401 Unauthorized'))).toBe(false);
    expect(shouldRetry(new Error('403 Forbidden'))).toBe(false);
  });

  it('does NOT retry 400 / validation errors', () => {
    expect(shouldRetry(new Error('400 Bad Request'))).toBe(false);
    expect(shouldRetry(new Error('invalid prompt'))).toBe(false);
  });

  it('retries everything else (network, 500, timeout)', () => {
    expect(shouldRetry(new Error('ECONNRESET'))).toBe(true);
    expect(shouldRetry(new Error('500 Internal Server Error'))).toBe(true);
    expect(shouldRetry(new Error('timeout'))).toBe(true);
  });
});

describe('ModelOverloadedError', () => {
  it('is a typed Error with correct name', () => {
    const err = new ModelOverloadedError('gemini busy');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ModelOverloadedError');
    expect(err.message).toBe('gemini busy');
  });
});

describe('withResilience', () => {
  it('passes result through on success', async () => {
    const result = await withResilience('test-ok', async () => 42);
    expect(result).toBe(42);
  });

  it('retries transient errors and eventually succeeds', async () => {
    let calls = 0;
    const result = await withResilience('test-retry', async () => {
      calls++;
      if (calls < 2) throw new Error('transient 500');
      return 'success';
    });
    expect(result).toBe('success');
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('surfaces the original error when all retries fail', async () => {
    await expect(
      withResilience('test-fail', async () => {
        throw new Error('persistent 500');
      })
    ).rejects.toThrow(/500/);
  });
});

describe('getResilienceStats', () => {
  it('returns an object keyed by provider', () => {
    const stats = getResilienceStats();
    expect(stats).toBeTypeOf('object');
  });
});

describe('onResilienceEvent', () => {
  it('accepts listeners without throwing', () => {
    expect(() => onResilienceEvent(() => {})).not.toThrow();
  });
});

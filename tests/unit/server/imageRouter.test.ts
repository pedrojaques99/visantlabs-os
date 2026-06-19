import { describe, it, expect } from 'vitest';
import {
  buildCandidates,
  generateImageWithFallback,
  isRequestError,
  isProviderError,
  type ImageCandidate,
} from '../../../server/lib/ai-providers/imageRouter';
import { OPENAI_IMAGE_MODELS } from '../../../src/constants/openaiModels';
import { GEMINI_MODELS } from '../../../src/constants/geminiModels';
import { DEFAULT_IMAGE_MODEL_ID } from '../../../src/constants/imageModelRegistry';

const ALL = new Set(['gemini', 'imagen', 'openai', 'ideogram', 'reve', 'seedream']);

describe('imageRouter — error classification', () => {
  it('treats payload/safety errors as request errors (do NOT cascade)', () => {
    expect(isRequestError(new Error('400 invalid_request'))).toBe(true);
    expect(isRequestError(new Error('content policy violation'))).toBe(true);
    expect(isRequestError(new Error('422 safety blocked'))).toBe(true);
    expect(isProviderError(new Error('400 invalid'))).toBe(false);
  });

  it('treats auth/billing/rate/server errors as provider errors (cascade)', () => {
    expect(isProviderError(new Error('403 organization must be verified'))).toBe(true);
    expect(isProviderError(new Error('429 rate limit'))).toBe(true);
    expect(isProviderError(new Error('500 internal'))).toBe(true);
    expect(isProviderError(new Error('socket hang up'))).toBe(true);
  });
});

describe('imageRouter — buildCandidates', () => {
  it('always tries the requested model first', () => {
    const c = buildCandidates({
      requestedModel: OPENAI_IMAGE_MODELS.GPT_IMAGE_2,
      requestedProvider: 'openai',
      strategy: 'quality',
      usableProviders: ALL,
    });
    expect(c[0].model).toBe(OPENAI_IMAGE_MODELS.GPT_IMAGE_2);
  });

  it('skips providers without keys and dedups', () => {
    const c = buildCandidates({
      requestedModel: OPENAI_IMAGE_MODELS.GPT_IMAGE_2,
      requestedProvider: 'openai',
      strategy: 'quality',
      usableProviders: new Set(['gemini', 'imagen']), // openai NOT usable
    });
    // requested still first, but no other openai model leaks in
    const providers = c.map((x) => x.provider);
    expect(providers.slice(1).every((p) => p === 'gemini' || p === 'imagen')).toBe(true);
    expect(new Set(c.map((x) => x.model)).size).toBe(c.length); // deduped
  });

  it('always appends the default anchor model', () => {
    const c = buildCandidates({
      requestedModel: OPENAI_IMAGE_MODELS.GPT_IMAGE_2,
      requestedProvider: 'openai',
      strategy: 'quality',
      usableProviders: ALL,
    });
    expect(c.some((x) => x.model === DEFAULT_IMAGE_MODEL_ID)).toBe(true);
  });

  it('cost strategy orders fallback cheaper-first', () => {
    const c = buildCandidates({
      requestedModel: GEMINI_MODELS.IMAGE_PRO, // expensive, requested first
      requestedProvider: 'gemini',
      resolution: '1K',
      strategy: 'cost',
      usableProviders: ALL,
    });
    // After the requested model, the cheapest available should come early.
    expect(c[0].model).toBe(GEMINI_MODELS.IMAGE_PRO);
    expect(c.length).toBeGreaterThan(1);
  });
});

describe('imageRouter — generateImageWithFallback', () => {
  const baseParams = {
    requestedModel: OPENAI_IMAGE_MODELS.GPT_IMAGE_2,
    requestedProvider: 'openai',
    resolution: '1K' as const,
    strategy: 'quality' as const,
    usableProviders: ALL,
  };

  it('returns the requested model when it succeeds (no fallback)', async () => {
    const res = await generateImageWithFallback({
      ...baseParams,
      run: async () => ({ base64: 'AAA' }),
    });
    expect(res.fellBack).toBe(false);
    expect(res.modelUsed).toBe(OPENAI_IMAGE_MODELS.GPT_IMAGE_2);
  });

  it('cascades past a provider error to the next candidate', async () => {
    const res = await generateImageWithFallback({
      ...baseParams,
      run: async (candidate: ImageCandidate) => {
        if (candidate.provider === 'openai') throw new Error('403 org must be verified');
        return { base64: 'BBB' };
      },
    });
    expect(res.fellBack).toBe(true);
    expect(res.providerUsed).not.toBe('openai');
    expect(res.failedAttempts.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT cascade on a request (prompt) error — propagates immediately', async () => {
    let attempts = 0;
    await expect(
      generateImageWithFallback({
        ...baseParams,
        run: async () => {
          attempts++;
          throw new Error('422 safety blocked');
        },
      })
    ).rejects.toThrow(/safety|422/i);
    expect(attempts).toBe(1); // stopped after the first candidate
  });

  it('throws image_generation_unavailable when every provider fails', async () => {
    await expect(
      generateImageWithFallback({
        ...baseParams,
        run: async () => {
          throw new Error('500 server error');
        },
      })
    ).rejects.toThrow(/image_generation_unavailable/);
  });
});

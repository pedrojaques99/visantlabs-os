import { describe, it, expect } from 'vitest';
import { resolveProvider, resolveGenerationContext } from '@/utils/canvas/generationContext';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { GEMINI_MODELS } from '@/constants/geminiModels';
import { SEEDREAM_MODELS } from '@/constants/seedreamModels';
import { OPENAI_IMAGE_MODELS } from '@/constants/openaiModels';

describe('resolveProvider', () => {
  it('returns gemini for gemini image models', () => {
    expect(resolveProvider(GEMINI_MODELS.IMAGE_FLASH)).toBe('gemini');
    expect(resolveProvider(GEMINI_MODELS.IMAGE_NB2)).toBe('gemini');
    expect(resolveProvider(GEMINI_MODELS.IMAGE_PRO)).toBe('gemini');
  });

  it('returns seedream for seedream models', () => {
    expect(resolveProvider(SEEDREAM_MODELS.SD_4_5)).toBe('seedream');
    expect(resolveProvider(SEEDREAM_MODELS.SD_4_0)).toBe('seedream');
    expect(resolveProvider(SEEDREAM_MODELS.SD_3_T2I)).toBe('seedream');
    expect(resolveProvider(SEEDREAM_MODELS.SE_3_I2I)).toBe('seedream');
  });

  it('returns openai for gpt-image-2', () => {
    expect(resolveProvider(OPENAI_IMAGE_MODELS.GPT_IMAGE_2)).toBe('openai');
  });

  it('never returns openai for gemini or seedream models', () => {
    const models = [GEMINI_MODELS.IMAGE_FLASH, GEMINI_MODELS.IMAGE_NB2, SEEDREAM_MODELS.SD_4_5];
    for (const m of models) {
      expect(resolveProvider(m)).not.toBe('openai');
    }
  });
});

describe('resolveGenerationContext — OpenAI', () => {
  it('returns openai provider with default resolution', () => {
    const ctx = resolveGenerationContext(OPENAI_IMAGE_MODELS.GPT_IMAGE_2);
    expect(ctx.provider).toBe('openai');
    expect(ctx.resolution).toBe('1K');
  });

  it('respects resolution override', () => {
    const ctx = resolveGenerationContext(OPENAI_IMAGE_MODELS.GPT_IMAGE_2, { resolution: '2K' });
    expect(ctx.resolution).toBe('2K');
    expect(ctx.provider).toBe('openai');
  });
});

describe('getCreditsRequired — OpenAI', () => {
  it('returns 2 credits for 1K (medium quality)', () => {
    expect(getCreditsRequired(OPENAI_IMAGE_MODELS.GPT_IMAGE_2, '1K', 'openai')).toBe(2);
  });

  it('returns 4 credits for 2K (high quality)', () => {
    expect(getCreditsRequired(OPENAI_IMAGE_MODELS.GPT_IMAGE_2, '2K', 'openai')).toBe(4);
  });

  it('returns 4 credits for 4K (high quality)', () => {
    expect(getCreditsRequired(OPENAI_IMAGE_MODELS.GPT_IMAGE_2, '4K', 'openai')).toBe(4);
  });

  it('resolves correctly via provider string alone', () => {
    // Even if model ID is unknown, provider='openai' routes correctly
    expect(getCreditsRequired('gpt-image-2', '1K', 'openai')).toBe(2);
  });

  it('gemini and seedream credits are unaffected', () => {
    expect(getCreditsRequired(GEMINI_MODELS.IMAGE_FLASH, undefined, 'gemini')).toBe(1);
    expect(getCreditsRequired(SEEDREAM_MODELS.SD_4_5, '2K', 'seedream')).toBe(3);
    expect(getCreditsRequired(SEEDREAM_MODELS.SD_4_5, '4K', 'seedream')).toBe(5);
  });
});

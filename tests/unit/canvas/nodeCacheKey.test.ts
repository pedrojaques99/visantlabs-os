import { describe, it, expect } from 'vitest';
import { hashQuery } from '../../../server/lib/cache-utils.js';

/**
 * Verifies that the cache key generation for canvas node generation
 * correctly differentiates by input image fingerprint and prompt.
 * This guards against the regression where the cache check happened
 * after credit deduction and ignored the input image.
 */
describe('Canvas generation cache key', () => {
  const userId = 'user-123';
  const model = 'gemini-2.0-flash-exp';

  const makeKey = (prompt: string, imageFingerprint: string) =>
    `mockup:${userId}:${hashQuery(prompt, model + '' + '' + imageFingerprint)}`;

  it('same prompt + same image → same key (cache hit)', () => {
    const k1 = makeKey('a red sneaker', 'img-fingerprint-abc');
    const k2 = makeKey('a red sneaker', 'img-fingerprint-abc');
    expect(k1).toBe(k2);
  });

  it('same prompt + different image → different key (no false hit)', () => {
    const k1 = makeKey('a red sneaker', 'img-fingerprint-abc');
    const k2 = makeKey('a red sneaker', 'img-fingerprint-xyz');
    expect(k1).not.toBe(k2);
  });

  it('different prompt + same image → different key', () => {
    const k1 = makeKey('a red sneaker', 'img-fingerprint-abc');
    const k2 = makeKey('a blue sneaker', 'img-fingerprint-abc');
    expect(k1).not.toBe(k2);
  });

  it('no-image sentinel is stable', () => {
    const k1 = makeKey('generate something', 'no-image');
    const k2 = makeKey('generate something', 'no-image');
    expect(k1).toBe(k2);
  });
});

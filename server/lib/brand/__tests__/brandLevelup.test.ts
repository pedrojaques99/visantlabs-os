import { describe, it, expect } from 'vitest';
import { hexToRgb, colorDistance, computeColorUsage, collectAssetSources } from '../colorUsage.js';
import { inferGender, brandImageryHint } from '../personaPhotos.js';
import { aggregateVisualSignature, hasSignature } from '../visualSignature.js';
import { assetVectorId, isVectorSearchConfigured } from '../assetVectors.js';
import { createAnalysisJob } from '../../brandAssetAnalysisJobs.js';
import { sha256Of, hamming, findDuplicate, NEAR_DUP_THRESHOLD } from '../assetFingerprint.js';

describe('colorUsage helpers', () => {
  it('parses 6- and 3-digit hex (with/without #)', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('not-a-color')).toBeNull();
  });

  it('redmean distance is zero for identical colors and grows with difference', () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    expect(colorDistance(black, black)).toBe(0);
    expect(colorDistance(black, white)).toBeGreaterThan(colorDistance(black, { r: 10, g: 10, b: 10 }));
  });

  it('collectAssetSources weights logos > designed media > stock, skips pdfs', () => {
    const sources = collectAssetSources({
      media: [
        { url: 'https://x/stock.png', type: 'image', category: 'stock' },
        { url: 'https://x/graphic.png', type: 'image', category: 'graphic' },
        { url: 'https://x/plain.png', type: 'image' },
        { url: 'https://x/doc.pdf', type: 'pdf' },
      ],
      logos: [{ url: 'https://x/logo.svg' }, { url: undefined as any }],
    });
    // logo first at full weight, pdf dropped
    expect(sources.map((s) => s.url)).toEqual([
      'https://x/logo.svg',
      'https://x/stock.png',
      'https://x/graphic.png',
      'https://x/plain.png',
    ]);
    const w = Object.fromEntries(sources.map((s) => [s.url, s.weight]));
    expect(w['https://x/logo.svg']).toBe(1.0);
    expect(w['https://x/stock.png']).toBeLessThan(w['https://x/graphic.png']);
    expect(w['https://x/graphic.png']).toBeLessThanOrEqual(1.0);
  });

  it('down-weights photographic assets and keeps vector marks intentional (analysis-aware)', () => {
    const sources = collectAssetSources({
      media: [
        { url: 'https://x/photo.jpg', type: 'image', category: 'graphic',
          analysis: { dimensions: { medium: ['Photography'] } } },
        { url: 'https://x/vector.svg', type: 'image', category: 'graphic',
          analysis: { dimensions: { medium: ['vector', 'flat'] } } },
      ],
    });
    const w = Object.fromEntries(sources.map((s) => [s.url, s.weight]));
    // same base category (graphic 0.8), but photo halved and vector boosted+clamped
    expect(w['https://x/photo.jpg']).toBeCloseTo(0.4, 5);
    expect(w['https://x/vector.svg']).toBeGreaterThan(w['https://x/photo.jpg']);
    expect(w['https://x/vector.svg']).toBeLessThanOrEqual(1);
  });

  it('computeColorUsage returns input unchanged when there are no assets', async () => {
    const colors = [{ hex: '#ff0000', name: 'Red' }];
    const out = await computeColorUsage(colors, []);
    expect(out).toEqual(colors);
  });
});

describe('brandImageryHint', () => {
  it('prefers the brand imagery direction (first sentence, capped)', () => {
    expect(
      brandImageryHint({ guidelines: { imagery: 'Warm, muted documentary tones. Avoid stock.' } })
    ).toBe('Warm, muted documentary tones');
  });

  it('falls back to tone-of-voice titles, then undefined', () => {
    expect(
      brandImageryHint({ strategy: { voiceValues: [{ title: 'Bold' }, { title: 'Human' }] } })
    ).toBe('Bold, Human');
    expect(brandImageryHint({})).toBeUndefined();
  });
});

describe('aggregateVisualSignature', () => {
  it('ranks tags by frequency across assets (top 5, lowercased)', () => {
    const sig = aggregateVisualSignature([
      { analysis: { dimensions: { vibe: ['Premium', 'bold'], aesthetic: ['minimalist'] } } },
      { analysis: { dimensions: { vibe: ['premium'], aesthetic: ['minimalist', 'editorial'] } } },
      { analysis: { dimensions: { vibe: ['premium'] } } },
      {}, // un-analyzed asset is ignored
    ]);
    expect(sig.vibe[0]).toBe('premium'); // 3× → most frequent first
    expect(sig.aesthetic).toContain('minimalist');
    expect(hasSignature(sig)).toBe(true);
  });

  it('reports an empty signature as not present', () => {
    expect(hasSignature(aggregateVisualSignature([{}, { analysis: {} }]))).toBe(false);
  });
});

describe('assetVectors helpers', () => {
  it('builds a stable, brand-scoped vector id', () => {
    expect(assetVectorId('g1', 'a1')).toBe('brand-asset:g1:a1');
    // same inputs → same id (overwrite, not duplicate)
    expect(assetVectorId('g1', 'a1')).toBe(assetVectorId('g1', 'a1'));
  });

  it('reports configuration from the Pinecone env keys', () => {
    const orig = { a: process.env.PINECONE_API_KEY, b: process.env.PINECONE_KEY };
    delete process.env.PINECONE_API_KEY;
    delete process.env.PINECONE_KEY;
    expect(isVectorSearchConfigured()).toBe(false);
    process.env.PINECONE_API_KEY = 'x';
    expect(isVectorSearchConfigured()).toBe(true);
    if (orig.a) process.env.PINECONE_API_KEY = orig.a;
    else delete process.env.PINECONE_API_KEY;
    if (orig.b) process.env.PINECONE_KEY = orig.b;
  });
});

describe('assetFingerprint dedup', () => {
  it('sha256Of is deterministic and content-sensitive', () => {
    const a = sha256Of(Buffer.from('hello'));
    expect(a).toBe(sha256Of(Buffer.from('hello')));
    expect(a).not.toBe(sha256Of(Buffer.from('hellp')));
  });

  it('hamming: 0 for identical, counts bit diffs, 64 for mismatched length', () => {
    expect(hamming('ffffffffffffffff', 'ffffffffffffffff')).toBe(0);
    expect(hamming('0000000000000000', '0000000000000001')).toBe(1);
    expect(hamming('00ff', '00ffffffffffffff')).toBe(64); // length mismatch
  });

  it('findDuplicate: exact by hash, near by phash, null when new', () => {
    const existing = [
      { id: 'a', label: 'Key Visual', hash: 'abc', phash: '0000000000000000' },
      { id: 'b', label: 'Logo', hash: 'def', phash: 'ffffffffffffffff' },
    ];
    // exact hash match wins
    expect(findDuplicate({ sha256: 'abc', size: 1 }, existing)).toMatchObject({ kind: 'exact' });
    // near phash within threshold (1 bit off 'a')
    const near = findDuplicate({ sha256: 'zzz', size: 1, phash: '0000000000000001' }, existing);
    expect(near).toMatchObject({ kind: 'similar', asset: { id: 'a' } });
    // brand-new asset
    expect(findDuplicate({ sha256: 'zzz', size: 1, phash: '0f0f0f0f0f0f0f0f' }, existing)).toBeNull();
    expect(NEAR_DUP_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('createAnalysisJob', () => {
  it('starts a pending job with zeroed progress and a unique id', () => {
    const a = createAnalysisJob({ guidelineId: 'g1', userId: 'u1' });
    expect(a).toMatchObject({
      guidelineId: 'g1',
      userId: 'u1',
      status: 'pending',
      processed: 0,
      total: 0,
      analyzed: 0,
    });
    expect(a.jobId).toBeTruthy();
    expect(createAnalysisJob({ guidelineId: 'g1', userId: 'u1' }).jobId).not.toBe(a.jobId);
  });
});

describe('inferGender', () => {
  it('honors an explicit gender field (incl. PT synonyms)', () => {
    expect(inferGender({ gender: 'female' })).toBe('female');
    expect(inferGender({ gender: 'masculino' })).toBe('male');
    expect(inferGender({ gender: 'mulher' })).toBe('female');
  });

  it('matches common names case- and accent-insensitively', () => {
    expect(inferGender({ name: 'João Silva' })).toBe('male');
    expect(inferGender({ name: 'maria' })).toBe('female');
  });

  it('falls back to the PT ending heuristic, then neutral', () => {
    expect(inferGender({ name: 'Fernanda' })).toBe('female'); // ends in "a"
    expect(inferGender({ name: 'Rodrigo' })).toBe('male'); // ends in "o"
    expect(inferGender({ name: 'Kael' })).toBe('neutral');
    expect(inferGender({})).toBe('neutral');
  });
});

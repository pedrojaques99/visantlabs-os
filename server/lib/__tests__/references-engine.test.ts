import { describe, it, expect } from 'vitest';
import {
  buildReferenceFilter,
  escapeRegex,
  visibilityFilter,
  parseBrandTerms,
} from '../references/engine.js';

describe('references engine — visibility', () => {
  it('public = admin-curated OR opted-in, never hidden', () => {
    expect(visibilityFilter('public')).toEqual({
      hiddenFromPublic: { $ne: true },
      $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }],
    });
  });

  it('curated excludes user uploads entirely', () => {
    const f = visibilityFilter('curated');
    expect(f.isAdminCurated).toBe(true);
    expect(f.$or).toBeUndefined();
  });

  it('defaults to public when unspecified', () => {
    expect(buildReferenceFilter({}).$or).toEqual(visibilityFilter('public').$or);
  });
});

describe('references engine — regex safety', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegex('a.*+?^${}()|[]\\b')).toBe('a\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\b');
  });

  // The bug this module exists to kill: user input used to reach $regex raw.
  it('never lets user input reach $regex unescaped', () => {
    const filter = buildReferenceFilter({ search: '.*(a+)+$' });
    const clause = filter.$and[0].$or[0].name.$regex;
    expect(clause).toBe('\\.\\*\\(a\\+\\)\\+\\$');
    expect(clause).not.toContain('.*');
  });

  it('keeps search in $and so it cannot clobber the visibility $or', () => {
    const filter = buildReferenceFilter({ search: 'kyoto', visibility: 'public' });
    expect(filter.$or).toHaveLength(2); // visibility survives
    expect(filter.$and).toHaveLength(1); // search lives separately
  });

  it('omits $and when there is no search', () => {
    expect(buildReferenceFilter({ country: 'Japan' }).$and).toBeUndefined();
  });
});

describe('references engine — filters', () => {
  it('normalizes country and passes region through', () => {
    const filter = buildReferenceFilter({ country: '  japan ', region: ' east-asia ' });
    expect(filter.country).toBe('Japan');
    expect(filter.region).toBe('east-asia');
  });

  it('lowercases and splits comma-joined tags', () => {
    expect(buildReferenceFilter({ tag: 'Kinfolk, MUJI ' }).tags).toEqual({
      $in: ['kinfolk', 'muji'],
    });
  });

  it('maps kind to the dimension presence probe', () => {
    expect(buildReferenceFilter({ kind: 'branding' })['dimensions.brand_artifact.0']).toEqual({
      $exists: true,
    });
    expect(buildReferenceFilter({ kind: 'mockup' })['dimensions.mockup_type.0']).toEqual({
      $exists: true,
    });
    expect(buildReferenceFilter({ kind: 'all' })['dimensions.brand_artifact.0']).toBeUndefined();
  });

  it('accepts dimensions as string or array, ignoring unknown keys', () => {
    const filter = buildReferenceFilter({
      dimensions: { aesthetic: 'brutalist,minimalist', vibe: ['premium'], bogus: 'x' },
    });
    expect(filter['dimensions.aesthetic']).toEqual({ $in: ['brutalist', 'minimalist'] });
    expect(filter['dimensions.vibe']).toEqual({ $in: ['premium'] });
    expect(filter['dimensions.bogus']).toBeUndefined();
  });

  it('scopes to an uploader for the /mine shape', () => {
    expect(buildReferenceFilter({ userId: '42', isAdminCurated: false })).toMatchObject({
      userId: '42',
      isAdminCurated: false,
    });
  });
});

describe('references engine — brand terms (ranking only)', () => {
  it('normalizes, drops 1-char noise, caps at 40', () => {
    expect(parseBrandTerms(' Minimal, A, MUJI ')).toEqual(new Set(['minimal', 'muji']));
    expect(parseBrandTerms(Array.from({ length: 60 }, (_, i) => `tok${i}`).join(','))?.size).toBe(
      40
    );
  });

  it('returns undefined for empty or non-string input', () => {
    expect(parseBrandTerms('')).toBeUndefined();
    expect(parseBrandTerms('  ')).toBeUndefined();
    expect(parseBrandTerms(null)).toBeUndefined();
  });
});

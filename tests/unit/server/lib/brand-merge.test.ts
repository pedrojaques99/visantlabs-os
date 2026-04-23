import { describe, it, expect } from 'vitest';
import { mergeBrandGuidelines } from '../../../../server/lib/brand-merge.js';
import type { BrandGuideline } from '../../../../server/types/brandGuideline.js';

const base = (overrides: Partial<BrandGuideline> = {}): BrandGuideline =>
  ({
    identity: { name: 'Acme' },
    colors: [],
    typography: [],
    logos: [],
    tags: {},
    ...overrides,
  }) as BrandGuideline;

describe('mergeBrandGuidelines', () => {
  it('keeps existing identity fields (no overwrite)', () => {
    const existing = base({ identity: { name: 'Acme', website: 'acme.com' } as any });
    const merged = mergeBrandGuidelines(existing, { identity: { name: 'NotAcme', tagline: 'hi' } as any });
    expect(merged.identity?.name).toBe('Acme');
    expect((merged.identity as any)?.website).toBe('acme.com');
    expect((merged.identity as any)?.tagline).toBe('hi');
  });

  it('fills empty identity fields from incoming', () => {
    const existing = base({ identity: { name: 'Acme' } as any });
    const merged = mergeBrandGuidelines(existing, { identity: { name: 'X', tagline: 'fresh' } as any });
    expect((merged.identity as any)?.tagline).toBe('fresh');
  });

  it('dedups colors by hex (case-insensitive)', () => {
    const existing = base({ colors: [{ hex: '#FF0000', name: 'red' } as any] });
    const merged = mergeBrandGuidelines(existing, {
      colors: [
        { hex: '#ff0000', name: 'duplicate' } as any,
        { hex: '#00FF00', name: 'green' } as any,
      ],
    });
    expect(merged.colors).toHaveLength(2);
    expect(merged.colors?.map((c) => c.hex.toUpperCase())).toEqual(['#FF0000', '#00FF00']);
  });

  it('dedups typography by family+style', () => {
    const existing = base({ typography: [{ family: 'Inter', style: 'Regular' } as any] });
    const merged = mergeBrandGuidelines(existing, {
      typography: [
        { family: 'Inter', style: 'Regular' } as any, // dup
        { family: 'Inter', style: 'Bold' } as any, // new variant
      ],
    });
    expect(merged.typography).toHaveLength(2);
  });
});

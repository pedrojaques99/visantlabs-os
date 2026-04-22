/**
 * BrandReadOnlyView — contrast & theme unit tests
 *
 * Validates that extractBrandTheme always produces WCAG AA-compliant contrast
 * for every combination of brand palette and display mode. This guards against
 * regressions where a new brand with an unusual accent (navy, cream, pastels)
 * would render illegible text.
 */
import { describe, it, expect } from 'vitest';
import {
  extractBrandTheme,
  getContrastRatio,
  getRelativeLuminance,
} from '../../../src/components/brand/BrandReadOnlyView';
import type { BrandGuideline } from '../../../src/lib/figma-types';

const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3.0;

function contrastBetween(hex1: string, hex2: string) {
  return getContrastRatio(getRelativeLuminance(hex1), getRelativeLuminance(hex2));
}

// Representative brand palettes that historically caused issues
const fixtures: Array<{ name: string; guideline: Partial<BrandGuideline> }> = [
  {
    name: 'dark accent (navy)',
    guideline: {
      colors: [
        { hex: '#1a1a2e', name: 'Primary', role: 'PRIMARY' },
        { hex: '#16213e', name: 'Background', role: 'BACKGROUND' },
        { hex: '#ffffff', name: 'Text', role: 'TEXT' },
      ],
    },
  },
  {
    name: 'light accent (cream/beige)',
    guideline: {
      colors: [
        { hex: '#f5e6c8', name: 'Primary', role: 'PRIMARY' },
        { hex: '#faf7f0', name: 'Background', role: 'BACKGROUND' },
        { hex: '#1a1a1a', name: 'Text', role: 'TEXT' },
      ],
    },
  },
  {
    name: 'construction brand (orange + dark)',
    guideline: {
      colors: [
        { hex: '#D4491B', name: 'Lava', role: 'PRIMARY' },
        { hex: '#0a0a0a', name: 'Background', role: 'BACKGROUND' },
        { hex: '#ffffff', name: 'Text', role: 'TEXT' },
      ],
    },
  },
  {
    name: 'cyan accent (Visant default)',
    guideline: {
      colors: [
        { hex: '#00E5FF', name: 'Cyan', role: 'PRIMARY' },
        { hex: '#050505', name: 'Background', role: 'BACKGROUND' },
        { hex: '#ffffff', name: 'Text', role: 'TEXT' },
      ],
    },
  },
  {
    name: 'white accent',
    guideline: {
      colors: [
        { hex: '#ffffff', name: 'White', role: 'PRIMARY' },
        { hex: '#000000', name: 'Black', role: 'BACKGROUND' },
        { hex: '#eeeeee', name: 'Light', role: 'TEXT' },
      ],
    },
  },
  {
    name: 'black accent',
    guideline: {
      colors: [
        { hex: '#000000', name: 'Black', role: 'PRIMARY' },
        { hex: '#ffffff', name: 'White', role: 'BACKGROUND' },
        { hex: '#111111', name: 'Dark', role: 'TEXT' },
      ],
    },
  },
  {
    name: 'no palette (null fallback)',
    guideline: {},
  },
];

describe('extractBrandTheme — WCAG AA contrast', () => {
  for (const mode of ['brand', 'light', 'dark'] as const) {
    describe(`mode: ${mode}`, () => {
      for (const fixture of fixtures) {
        it(`${fixture.name} — bg/text contrast >= ${WCAG_AA_NORMAL}`, () => {
          const theme = extractBrandTheme(fixture.guideline as BrandGuideline, mode);
          const ratio = contrastBetween(theme.bg, theme.text);
          expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
        });

        it(`${fixture.name} — accentText on accent contrast >= ${WCAG_AA_NORMAL}`, () => {
          const theme = extractBrandTheme(fixture.guideline as BrandGuideline, mode);
          const ratio = contrastBetween(theme.accent, theme.accentText);
          expect(ratio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
        });

        it(`${fixture.name} — accentText is either #000000 or #ffffff`, () => {
          const theme = extractBrandTheme(fixture.guideline as BrandGuideline, mode);
          expect(['#000000', '#ffffff']).toContain(theme.accentText);
        });
      }
    });
  }
});

describe('extractBrandTheme — structure', () => {
  it('returns all required fields', () => {
    const theme = extractBrandTheme(null);
    expect(theme).toHaveProperty('accent');
    expect(theme).toHaveProperty('accentText');
    expect(theme).toHaveProperty('accentRgb');
    expect(theme).toHaveProperty('bg');
    expect(theme).toHaveProperty('surface');
    expect(theme).toHaveProperty('text');
    expect(theme).toHaveProperty('isCustomBg');
  });

  it('accentRgb is comma-separated integers', () => {
    const theme = extractBrandTheme({ colors: [{ hex: '#D4491B', role: 'PRIMARY' }] } as any);
    expect(theme.accentRgb).toMatch(/^\d+, \d+, \d+$/);
  });
});

describe('contrast utilities', () => {
  it('black on white = 21:1', () => {
    expect(contrastBetween('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('white on white = 1:1', () => {
    expect(contrastBetween('#ffffff', '#ffffff')).toBeCloseTo(1, 0);
  });

  it('WCAG AA passes for known-good pair', () => {
    // #D4491B (lava orange) on #000000 black
    expect(contrastBetween('#D4491B', '#000000')).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });
});

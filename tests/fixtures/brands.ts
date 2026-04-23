/**
 * Brand fixtures for testing
 * Factory functions for consistent test data
 */

import type { BrandGuideline } from '@/lib/figma-types';

/**
 * Minimal valid BrandGuideline for testing
 */
export function mockBrandGuideline(overrides?: Partial<BrandGuideline>): BrandGuideline {
  return {
    id: 'test-brand-001',
    name: 'Test Brand',
    publicSlug: 'test-brand',
    isPublic: false,
    identity: {
      name: 'Acme Corp',
      tagline: 'Innovation through design',
      website: 'https://acme.example.com',
    },
    colors: [
      {
        name: 'primary',
        hex: '#00bcd4',
        rgb: 'rgb(0, 188, 212)',
        role: 'primary',
      },
      {
        name: 'secondary',
        hex: '#ff4081',
        rgb: 'rgb(255, 64, 129)',
        role: 'secondary',
      },
    ],
    typography: [
      {
        role: 'heading',
        family: 'Inter',
        style: 'Bold',
        size: 32,
        lineHeight: 1.2,
        weights: [400, 600, 700],
      },
      {
        role: 'body',
        family: 'Inter',
        style: 'Regular',
        size: 16,
        lineHeight: 1.5,
        weights: [400, 500],
      },
    ],
    guidelines: {
      voice: 'professional yet approachable',
      dos: ['Use simple language', 'Show real examples'],
      donts: ['Be overly technical', 'Use jargon without explanation'],
      imagery: 'Modern, clean, human-focused photography',
    },
    strategy: {
      positioning: ['Innovation leader', 'Trusted partner'],
      archetypes: [
        { name: 'The Innovator', role: 'primary' },
        { name: 'The Sage', role: 'secondary' },
      ],
      voiceValues: [
        { title: 'Clear', subtitle: 'We speak in plain terms' },
        { title: 'Confident', subtitle: 'We believe in our vision' },
      ],
    },
    logos: [
      {
        variant: 'full',
        url: 'https://example.com/logo-full.png',
        label: 'Full logo with wordmark',
      },
      {
        variant: 'icon',
        url: 'https://example.com/logo-icon.png',
        label: 'Icon only',
      },
    ],
    media: [
      {
        type: 'hero',
        url: 'https://example.com/hero.jpg',
        label: 'Hero image',
      },
    ],
    tokens: {
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
      },
      radius: {
        sm: 4,
        md: 8,
        lg: 12,
        full: 999,
      },
    },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as BrandGuideline;
}

/**
 * Minimal brand with only required fields
 */
export function minimalBrandGuideline(): BrandGuideline {
  return {
    id: 'minimal-brand',
    name: 'Minimal',
    identity: {
      name: 'Minimal Brand',
    },
    colors: [],
    typography: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as BrandGuideline;
}

/**
 * Brand with rich metadata for complex scenarios
 */
export function richBrandGuideline(): BrandGuideline {
  return mockBrandGuideline({
    guidelines: {
      voice: 'Premium, sophisticated, detail-oriented',
      dos: [
        'Emphasize craftsmanship',
        'Use rich imagery',
        'Tell stories',
        'Celebrate quality',
      ],
      donts: [
        'Cut corners',
        'Use generic stock photos',
        'Over-explain features',
      ],
      imagery: 'High-quality, editorial-style photography with natural lighting',
    },
    tokens: {
      spacing: {
        xs: 2,
        sm: 4,
        md: 8,
        lg: 16,
        xl: 24,
        '2xl': 32,
        '3xl': 48,
      },
      radius: {
        none: 0,
        xs: 2,
        sm: 4,
        md: 8,
        lg: 12,
        xl: 16,
        full: 999,
      },
    },
  });
}

/**
 * Rich brand fixture for the creative-fidelity eval harness.
 * Realistic enough that the LLM has named tokens to pick from instead of
 * inventing values. Aspect-ratio hints in `media[].label` let the
 * media-first selector pick a per-format match without remote inspection.
 */
import type { BrandGuideline } from '../../src/lib/figma-types';

export const fidelityBrand: BrandGuideline = {
  id: 'fixture-fidelity-001',
  name: 'Aurora Fitness',
  identity: {
    name: 'Aurora Fitness',
    tagline: 'Movement that lasts',
    website: 'https://aurora.example',
    description: 'Performance apparel and wellness for the long run.',
  },
  colors: [
    { name: 'Aurora Black', hex: '#0a0a0a', role: 'primary' },
    { name: 'Aurora White', hex: '#fafafa', role: 'background' },
    { name: 'Signal Lime', hex: '#c6ff3b', role: 'accent' },
    { name: 'Deep Plum', hex: '#3d1f4f', role: 'secondary' },
    { name: 'Mist Gray', hex: '#9aa0a6', role: 'text' },
  ],
  typography: [
    {
      role: 'heading',
      family: 'Space Grotesk',
      style: 'Bold',
      size: 64,
      lineHeight: 1.05,
      weights: [500, 700],
    },
    {
      role: 'body',
      family: 'Inter',
      style: 'Regular',
      size: 18,
      lineHeight: 1.5,
      weights: [400, 600],
    },
  ],
  guidelines: {
    voice: 'Direct, energetic, never preachy. Speaks to athletes who already train.',
    dos: ['Talk in cadence', 'Reference real movement', 'Honor consistency over hype'],
    donts: ['Empty motivation clichés', 'Fitness-bro shouting', 'Diet talk'],
    imagery: 'High-contrast action shots with negative space for type.',
  },
  logos: [
    { id: 'l1', url: 'https://cdn.example/aurora/logo-primary.svg', variant: 'primary', label: 'Wordmark + monogram' },
    { id: 'l2', url: 'https://cdn.example/aurora/logo-light.svg', variant: 'light', label: 'For dark backgrounds' },
    { id: 'l3', url: 'https://cdn.example/aurora/logo-dark.svg', variant: 'dark', label: 'For light backgrounds' },
    { id: 'l4', url: 'https://cdn.example/aurora/icon.svg', variant: 'icon', label: 'Monogram only' },
  ],
  media: [
    {
      type: 'photo',
      url: 'https://cdn.example/aurora/hero-square-runner.jpg',
      label: 'Runner sunrise — 1:1 square',
    },
    {
      type: 'photo',
      url: 'https://cdn.example/aurora/hero-portrait-lifter.jpg',
      label: 'Lifter chalk — 9:16 portrait',
    },
    {
      type: 'photo',
      url: 'https://cdn.example/aurora/hero-landscape-trail.jpg',
      label: 'Trail dawn — 16:9 landscape',
    },
    {
      type: 'photo',
      url: 'https://cdn.example/aurora/hero-feed-stretch.jpg',
      label: 'Yoga studio — 4:5 feed',
    },
  ] as any,
  tags: {
    industry: ['fitness', 'apparel', 'wellness'],
    audience: ['runners', 'lifters', 'yogis'],
  },
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-04-28').toISOString(),
} as BrandGuideline;

/**
 * Hostile brand: deliberately weird fonts, sparse colors, no media.
 * Stress-tests whether the LLM stays in-bounds when the brand has no easy
 * outs (no obvious "Inter" to fall back to, no media to lean on).
 */
export const hostileBrand: BrandGuideline = {
  id: 'fixture-hostile-001',
  name: 'Vellum Press',
  identity: { name: 'Vellum Press', tagline: 'Editorial in motion' },
  colors: [
    { name: 'Vellum Ink', hex: '#1c1816', role: 'primary' },
    { name: 'Bone', hex: '#f3eee5', role: 'background' },
  ], // only 2 colors — no obvious accent
  typography: [
    { role: 'heading', family: "Suisse Int'l", style: 'Medium', size: 56, weights: [500, 700] },
    { role: 'body', family: 'Söhne Buch', style: 'Regular', size: 16, weights: [400] },
  ], // unusual non-Google font names — LLM is biased toward "Inter"/"Helvetica"
  guidelines: { voice: 'Spare, considered, never loud.' },
  logos: [
    { id: 'l1', url: 'https://cdn.example/vellum/wordmark.svg', variant: 'primary', label: 'Wordmark' },
  ],
  // NO media at all — engine should return pickedMedia=null and the client
  // should fall through to AI gen.
  media: [],
  createdAt: new Date('2026-01-01').toISOString(),
  updatedAt: new Date('2026-04-28').toISOString(),
} as BrandGuideline;

export interface FidelityCase {
  name: string;
  prompt: string;
  format: '1:1' | '9:16' | '16:9' | '4:5';
  brand?: BrandGuideline;
  /** When true, scoring treats `media=0` as a success because the brand has none. */
  expectNoMedia?: boolean;
}

export const fidelityCases: FidelityCase[] = [
  { name: 'launch-square',  prompt: 'Launch announcement for the spring training collection.', format: '1:1' },
  { name: 'story-portrait', prompt: 'Recovery week reminder for our community.',                format: '9:16' },
  { name: 'wide-landing',   prompt: 'New trail running shoe — built for early miles.',         format: '16:9' },

  // Hostile #1 — deliberately vague prompt: model has nothing creative to lean
  // on, so it must default to brand assets to fill the layout.
  { name: 'vague-prompt',   prompt: 'Faça algo legal.',                                         format: '1:1' },

  // Hostile #2 — prompt actively pulls toward off-brand colors and tone.
  { name: 'conflicting-style', prompt: 'Make it dramatic crimson red, ornate baroque framing.', format: '4:5' },

  // Hostile #3 — rare-font brand with no media. Tests whether LLM tries to
  // substitute "Inter" for "Suisse Int'l" / "Söhne Buch" (clamper safety net),
  // and whether media-first correctly returns null.
  {
    name: 'rare-fonts-no-media',
    prompt: 'A quiet announcement for our spring catalog.',
    format: '1:1',
    brand: hostileBrand,
    expectNoMedia: true,
  },

  // Hostile #4 — brand has no matching aspect for 9:16; selector returns the
  // closest, but raw match is mediocre. Validates the selector's tie-breaking.
  {
    name: 'rare-fonts-portrait',
    prompt: 'Story drop for the rebound collection.',
    format: '9:16',
    brand: hostileBrand,
    expectNoMedia: true,
  },
];

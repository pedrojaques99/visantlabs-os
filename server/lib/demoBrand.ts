/**
 * Demo brand seed — Fase 3 (onboarding brand-first).
 *
 * When a user picks "explore first" in the wizard, we clone this in-code
 * example brand for them with `isDemo: true` so their FIRST generation is
 * still on-brand (aha-moment), just with the demo brand instead of theirs.
 *
 * Rules:
 * - Lives in code (no manual DB seed dependency).
 * - Never counts toward the active-brand quota (see brandQuota.ACTIVE_BRAND_WHERE).
 * - Generation with it costs credits normally (plan §Fase 3 edge cases).
 */

import { prisma } from '../db/prisma.js';

/**
 * Complete enough for buildBrandContext / image generation to produce a
 * clearly branded output: identity + palette with roles + typography + voice.
 */
export const DEMO_BRAND_SEED = {
  identity: {
    name: 'Aurora Coffee',
    tagline: 'Slow mornings, bright ideas.',
    description:
      'Specialty coffee roaster for people who treat the first cup as a ritual. ' +
      'Warm, artisanal and quietly confident — never corporate, never shouty.',
    website: 'https://aurora.coffee',
  },
  colors: [
    { name: 'Aurora Amber', hex: '#D97706', role: 'primary' },
    { name: 'Roast Brown', hex: '#3F2A1D', role: 'secondary' },
    { name: 'Morning Cream', hex: '#FAF3E7', role: 'background' },
    { name: 'Leaf Green', hex: '#4D7C4A', role: 'accent' },
    { name: 'Charcoal', hex: '#1F1B16', role: 'text' },
  ],
  typography: [
    { family: 'Fraunces', style: 'SemiBold', role: 'heading', size: 40 },
    { family: 'Inter', style: 'Regular', role: 'body', size: 16 },
  ],
  guidelines: {
    voice:
      'Warm and unhurried, like a good barista: knowledgeable without jargon, ' +
      'playful without memes. Short sentences. Sensory words (aroma, bloom, velvet).',
    dos: [
      'Talk about origin, farmers and process',
      'Use sensory, tactile language',
      'Keep layouts airy with generous whitespace',
    ],
    donts: [
      'No discount-driven urgency ("LAST CHANCE!")',
      'No stock-photo corporate imagery',
      'Never use pure black backgrounds',
    ],
    imagery:
      'Natural light, close-up textures of beans and pours, warm film-like grain, ' +
      'hands and ceramics over faces and logos.',
  },
  tags: {
    vibe: ['warm', 'artisanal', 'calm'],
    industry: ['coffee', 'food & beverage'],
    aesthetic: ['organic', 'editorial', 'craft'],
  },
} as const;

/**
 * Idempotent clone: returns the user's existing demo brand when present,
 * otherwise creates one from DEMO_BRAND_SEED. Deliberately NOT gated by the
 * brand quota — the demo never occupies a slot.
 */
export async function ensureDemoBrand(
  userId: string
): Promise<{ guideline: any; created: boolean }> {
  const existing = await prisma.brandGuideline.findFirst({
    where: { userId, isDemo: true },
  });
  if (existing) return { guideline: existing, created: false };

  const guideline = await prisma.brandGuideline.create({
    data: {
      userId,
      isDemo: true,
      identity: DEMO_BRAND_SEED.identity as any,
      colors: DEMO_BRAND_SEED.colors as any,
      typography: DEMO_BRAND_SEED.typography as any,
      guidelines: DEMO_BRAND_SEED.guidelines as any,
      tags: DEMO_BRAND_SEED.tags as any,
      extraction: {
        sources: [{ type: 'demo_seed', ref: 'aurora-coffee', date: new Date().toISOString() }],
        completeness: 70,
      } as any,
    },
  });
  return { guideline, created: true };
}

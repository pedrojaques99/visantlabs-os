/**
 * Brand Context Builder
 *
 * Converts a BrandGuideline into a text context string for LLM prompts.
 * Used by:
 * - Figma Plugin (plugin.ts)
 * - Mockup Machine (mockups.ts)
 * - Future: Any AI generation feature that needs brand context
 */

import type { BrandGuideline } from '../../src/lib/figma-types.js';

/**
 * Build a human-readable brand context string from a BrandGuideline.
 * This context is prepended to AI prompts to ensure brand consistency.
 *
 * @param bg - The BrandGuideline object
 * @param options - Optional configuration
 * @returns Formatted string for LLM context injection
 */
export function buildBrandContext(
  bg: BrandGuideline,
  options?: {
    /** Include logo URLs (default: true for Figma, false for image gen) */
    includeLogos?: boolean;
    /** Include media kit assets (default: true for Figma, false for image gen) */
    includeMedia?: boolean;
    /** Compact mode for shorter prompts (default: false) */
    compact?: boolean;
  }
): string {
  const { includeLogos = true, includeMedia = true, compact = false } = options || {};
  const lines: string[] = [];
  const name = bg.identity?.name || 'Brand';

  lines.push(`═══ BRAND: ${name} ═══`);
  if (bg.identity?.tagline) lines.push(`"${bg.identity.tagline}"`);
  if (!compact && bg.identity?.website) lines.push(`Site: ${bg.identity.website}`);
  lines.push('');

  // Colors - always include, critical for visual consistency
  if (bg.colors?.length) {
    lines.push('COLORS:');
    for (const c of bg.colors) {
      lines.push(`  ${c.name}: ${c.hex}${c.role ? ` (${c.role})` : ''}`);
    }
    lines.push('');
  }

  // Typography - important for text-based generations
  if (bg.typography?.length) {
    lines.push('FONTS:');
    for (const t of bg.typography) {
      const parts = [t.family, t.style].filter(Boolean).join(' ');
      const size = t.size ? ` ${t.size}` : '';
      const lh = t.lineHeight ? `/${t.lineHeight}` : '';
      lines.push(`  ${t.role}: ${parts}${size}${lh}`);
    }
    lines.push('');
  }

  // Guidelines - voice and dos/donts
  if (bg.guidelines) {
    if (bg.guidelines.voice) lines.push(`TONE: ${bg.guidelines.voice}`);
    if (bg.guidelines.dos?.length) lines.push(`DO: ${bg.guidelines.dos.join(' | ')}`);
    if (bg.guidelines.donts?.length) lines.push(`AVOID: ${bg.guidelines.donts.join(' | ')}`);
    if (bg.guidelines.imagery) lines.push(`IMAGERY: ${bg.guidelines.imagery}`);
    lines.push('');
  }

  // Strategy - archetypes and positioning (compact mode skips this)
  if (!compact && bg.strategy) {
    if (bg.strategy.positioning?.length) {
      lines.push(`POSITIONING: ${bg.strategy.positioning.join(' | ')}`);
    }
    if (bg.strategy.archetypes?.length) {
      const archs = bg.strategy.archetypes.map(a => `${a.name}${a.role === 'primary' ? '*' : ''}`).join(', ');
      lines.push(`ARCHETYPES: ${archs}`);
    }
    if (bg.strategy.voiceValues?.length) {
      const voice = bg.strategy.voiceValues.map(v => v.title).join(', ');
      lines.push(`VOICE VALUES: ${voice}`);
    }
    lines.push('');
  }

  // Logos - optional, useful for Figma but not for image generation
  if (includeLogos && bg.logos?.length) {
    lines.push('LOGOS:');
    for (const l of bg.logos) {
      lines.push(`  ${l.variant}: ${l.url}${l.label ? ` (${l.label})` : ''}`);
    }
    lines.push('');
  }

  // Media Kit - optional, useful for Figma reference
  if (includeMedia && bg.media?.length) {
    lines.push('MEDIA KIT (reference assets):');
    for (const m of bg.media) {
      lines.push(`  [${m.type}] ${m.url}${m.label ? ` — ${m.label}` : ''}`);
    }
    lines.push('');
  }

  // Tokens - spacing and radius
  if (bg.tokens?.spacing) {
    lines.push(`SPACING: ${Object.entries(bg.tokens.spacing).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  if (bg.tokens?.radius) {
    lines.push(`RADIUS: ${Object.entries(bg.tokens.radius).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }

  return lines.join('\n');
}

/**
 * Build a compact brand context optimized for image generation prompts.
 * Focuses on colors, typography, and tone - excludes URLs and detailed assets.
 *
 * @param bg - The BrandGuideline object
 * @returns Compact formatted string for image generation context
 */
export function buildBrandContextForImageGen(bg: BrandGuideline): string {
  return buildBrandContext(bg, {
    includeLogos: false,
    includeMedia: false,
    compact: true,
  });
}

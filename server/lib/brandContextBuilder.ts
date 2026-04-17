/**
 * Brand Context Builder
 *
 * Converts a BrandGuideline into context for LLM prompts.
 * Supports both text format (legacy) and JSON format (modern, more robust).
 *
 * Used by:
 * - Figma Plugin (plugin.ts)
 * - Mockup Machine (mockups.ts)
 * - AI generation features
 */

import type { BrandGuideline } from '../../src/lib/figma-types.js';
import type { TokenRegistry } from './tokenRegistry.js';
import { redisClient } from './redis.js';
import { CACHE_TTL, CacheKey } from './cache-utils.js';

// ═══════════════════════════════════════════
// Hex to RGB conversion utility
// ═══════════════════════════════════════════

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

// ═══════════════════════════════════════════
// JSON Structured Context (Modern)
// ═══════════════════════════════════════════

export interface BrandContextJSON {
  brand: {
    name: string;
    tagline?: string;
    website?: string;
  };
  colors: Array<{
    name: string;
    hex: string;
    rgb: { r: number; g: number; b: number };
    role?: string;
  }>;
  typography: Array<{
    role: string;
    family: string;
    style?: string;
    size?: number;
    lineHeight?: number;
  }>;
  voice?: {
    tone?: string;
    dos?: string[];
    donts?: string[];
    imagery?: string;
  };
  tokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
  };
}

/**
 * Build structured JSON context from a BrandGuideline.
 * Modern approach - better for function calling and structured outputs.
 *
 * @param bg - The BrandGuideline object
 * @returns Structured JSON object for LLM context
 */
export function buildBrandContextJSON(bg: BrandGuideline): BrandContextJSON {
  return {
    brand: {
      name: bg.identity?.name || 'Brand',
      tagline: bg.identity?.tagline,
      website: bg.identity?.website,
    },
    colors: (bg.colors || []).map(c => ({
      name: c.name,
      hex: c.hex,
      rgb: hexToRgb(c.hex) || { r: 0, g: 0, b: 0 },
      role: c.role,
    })),
    typography: (bg.typography || []).map(t => ({
      role: t.role,
      family: t.family,
      style: t.style,
      size: t.size,
      lineHeight: t.lineHeight,
    })),
    voice: bg.guidelines ? {
      tone: bg.guidelines.voice,
      dos: bg.guidelines.dos,
      donts: bg.guidelines.donts,
      imagery: bg.guidelines.imagery,
    } : undefined,
    tokens: bg.tokens ? {
      spacing: bg.tokens.spacing as Record<string, number>,
      radius: bg.tokens.radius as Record<string, number>,
    } : undefined,
  };
}

/**
 * Build JSON string context for system prompt injection.
 * Wraps buildBrandContextJSON in a descriptive format.
 */
export function buildBrandContextJSONString(bg: BrandGuideline): string {
  const json = buildBrandContextJSON(bg);
  return `<brand_context>
${JSON.stringify(json, null, 2)}
</brand_context>

INSTRUCTIONS: Use ONLY the colors and typography from brand_context.
Primary color should be used for main actions, secondary for accents.`;
}

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

/**
 * Build enforced prompt with pre-calculated RGB values and strict rules.
 * Replaces soft brand context with strict token enforcement.
 */
export function buildEnforcedPrompt(registry: TokenRegistry): string {
  const lines: string[] = [];

  lines.push('═══ DESIGN TOKENS (OBRIGATÓRIO) ═══');
  lines.push('');
  lines.push('REGRAS ABSOLUTAS:');
  lines.push('1. Use SOMENTE cores desta lista (já em RGB 0-1)');
  lines.push('2. Use SOMENTE fontSize/fontFamily desta lista');
  lines.push('3. Use SOMENTE spacing/radius desta lista');
  lines.push('4. Valores fora serão corrigidos automaticamente');
  lines.push('');

  // Colors with RGB
  if (registry.colors.size > 0) {
    lines.push('CORES (use em fills/strokes - valores RGB 0-1):');
    for (const [name, token] of registry.colors) {
      if (token.rgb) {
        const rgb = `{ r: ${token.rgb.r.toFixed(3)}, g: ${token.rgb.g.toFixed(3)}, b: ${token.rgb.b.toFixed(3)} }`;
        const usage = token.usage ? ` <- ${token.usage}` : '';
        lines.push(`  ${name}: ${rgb}${usage}`);
      }
    }
    lines.push('');
  }

  // Typography
  if (registry.typography.size > 0) {
    lines.push('TIPOGRAFIA:');
    for (const [name, token] of registry.typography) {
      const v = token.value;
      const parts = [`${v.family} ${v.style || 'Regular'}`];
      if (v.size) parts.push(`${v.size}px`);
      lines.push(`  ${name}: ${parts.join(' ')}`);
    }
    lines.push('');
  }

  // Spacing
  if (registry.spacing.size > 0) {
    const values = Array.from(registry.spacing.values()).map(t => t.value).sort((a: number, b: number) => a - b);
    lines.push(`SPACING (itemSpacing, padding): ${values.join(' | ')}`);
    lines.push('');
  }

  // Radius
  if (registry.radius.size > 0) {
    const entries = Array.from(registry.radius.entries()).map(([k, v]) => `${k}=${v.value}`);
    lines.push(`RADIUS (cornerRadius): ${entries.join(' | ')}`);
    lines.push('');
  }

  // Components
  if (registry.components.size > 0) {
    lines.push('COMPONENTES:');
    for (const [name, token] of registry.components) {
      const v = token.value;
      const parts: string[] = [];
      if (v.height) parts.push(`height=${v.height}`);
      if (v.paddingH) parts.push(`paddingH=${v.paddingH}`);
      if (v.radius) parts.push(`radius=${v.radius}`);
      if (v.font) parts.push(`font=${v.font}`);
      if (v.bg) parts.push(`bg=${v.bg}`);
      lines.push(`  ${name}: ${parts.join(', ')}`);
    }
    lines.push('');
  }

  // Few-shot example
  if (registry.colors.size > 0) {
    const primaryColor = registry.colors.get('primary') || registry.colors.values().next().value;
    if (primaryColor?.rgb) {
      lines.push('═══ EXEMPLO CORRETO ═══');
      lines.push('');
      lines.push('Botão:');
      lines.push('{');
      lines.push('  "type": "CREATE_FRAME",');
      lines.push('  "props": {');
      lines.push('    "name": "Button",');
      lines.push('    "height": 40,');
      lines.push('    "layoutMode": "HORIZONTAL",');
      lines.push('    "paddingLeft": 16, "paddingRight": 16,');
      lines.push(`    "fills": [{ "type": "SOLID", "color": { "r": ${primaryColor.rgb.r.toFixed(3)}, "g": ${primaryColor.rgb.g.toFixed(3)}, "b": ${primaryColor.rgb.b.toFixed(3)} } }],`);
      lines.push('    "cornerRadius": 8');
      lines.push('  }');
      lines.push('}');
    }
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════
// Cache Wrapper for buildBrandContext
// ═══════════════════════════════════════════
const originalBuildBrandContext = buildBrandContext;

export async function buildBrandContextCached(
  bg: BrandGuideline,
  options?: {
    includeLogos?: boolean;
    includeMedia?: boolean;
    compact?: boolean;
  }
): Promise<string> {
  const format = JSON.stringify(options) || 'default';
  const cacheKey = CacheKey.brandContext(bg.id, format);

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`[Cache] HIT context:${bg.id.slice(0, 8)}`);
      return cached;
    }
  } catch (err) {
    console.warn(`[Cache] Redis GET failed, skipping cache:`, (err as Error).message);
  }

  const result = originalBuildBrandContext(bg, options);

  try {
    await redisClient.setex(
      cacheKey,
      CACHE_TTL.BRAND_CTX,
      result
    );
    console.log(`[Cache] SET context:${bg.id.slice(0, 8)} (24h)`);
  } catch (err) {
    console.warn(`[Cache] Redis SET failed:`, (err as Error).message);
  }

  return result;
}

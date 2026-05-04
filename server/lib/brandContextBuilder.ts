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
    description?: string;
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
    accessibility?: string;
    values?: Array<{ title: string; description: string; example: string }>;
  };
  strategy?: {
    manifesto?: string | { provocation?: string; tension?: string; promise?: string; full?: string };
    positioning?: string[];
    coreMessage?: { product: string; differential: string; emotionalBond: string };
    pillars?: Array<{ value: string; description: string }>;
    archetypes?: Array<{ name: string; role?: string; description: string; examples?: string[] }>;
    personas?: Array<{ name: string; age?: number; occupation?: string; traits?: string[]; bio?: string; desires?: string[]; painPoints?: string[] }>;
    marketResearch?: { competitors?: string[]; gaps?: string[]; opportunities?: string[]; notes?: string };
    graphicSystem?: { patterns?: string[]; grafisms?: string[]; imageRules?: string[]; editorialGrid?: string };
  };
  tokens?: {
    spacing?: Record<string, number>;
    radius?: Record<string, number>;
    shadows?: Record<string, any>;
    components?: Record<string, any>;
  };
  tags?: Record<string, string[]>;
  knowledge?: Array<{ fileName: string; source: string }>;
  colorThemes?: Array<{ name: string; bg: string; text: string; primary: string; accent: string }>;
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
      description: bg.identity?.description,
    },
    colors: (bg.colors || []).map(c => ({
      name: c.name,
      hex: c.hex,
      rgb: hexToRgb(c.hex) || { r: 0, g: 0, b: 0 },
      role: c.role,
    })),
    typography: (bg.typography || []).map((t: any) => ({
      role: t.role || t.name || 'body',
      family: t.family || t.fontFamily || '',
      style: t.style || t.fontStyle,
      size: t.size || t.fontSize,
      lineHeight: t.lineHeight,
    })).filter((t: any) => t.family),
    voice: (bg.guidelines || bg.strategy?.voiceValues) ? {
      tone: bg.guidelines?.voice,
      dos: bg.guidelines?.dos,
      donts: bg.guidelines?.donts,
      imagery: bg.guidelines?.imagery,
      accessibility: bg.guidelines?.accessibility,
      values: bg.strategy?.voiceValues,
    } : undefined,
    strategy: bg.strategy ? {
      manifesto: bg.strategy.manifesto,
      positioning: bg.strategy.positioning,
      coreMessage: bg.strategy.coreMessage,
      pillars: bg.strategy.pillars,
      archetypes: bg.strategy.archetypes?.map(a => ({
        name: a.name,
        role: a.role,
        description: a.description,
        examples: a.examples,
      })),
      personas: bg.strategy.personas?.map(p => ({
        name: p.name,
        age: p.age,
        occupation: p.occupation,
        traits: p.traits,
        bio: p.bio,
        desires: p.desires,
        painPoints: p.painPoints,
      })),
      marketResearch: bg.strategy.marketResearch,
      graphicSystem: bg.strategy.graphicSystem,
    } : undefined,
    tokens: bg.tokens ? {
      spacing: bg.tokens.spacing as Record<string, number>,
      radius: bg.tokens.radius as Record<string, number>,
      shadows: bg.tokens.shadows,
      components: bg.tokens.components,
    } : undefined,
    colorThemes: bg.colorThemes?.length
      ? bg.colorThemes.map(t => ({ name: t.name, bg: t.bg, text: t.text, primary: t.primary, accent: t.accent }))
      : undefined,
    tags: bg.tags,
    knowledge: bg.knowledgeFiles?.length
      ? bg.knowledgeFiles.map((f: any) => ({ fileName: f.fileName, source: f.source }))
      : undefined,
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

INSTRUCTIONS:
- Use ONLY the colors and typography from brand_context. Primary color for main actions, secondary for accents.
- If strategy.coreMessage exists, use it as the brand's positioning foundation (product + differential + emotional bond).
- If strategy.pillars exist, ensure all creative output aligns with these fundamental values.
- If strategy.archetypes exist, reflect the primary archetype's personality in layout and visual tone.
- If strategy.personas exist, design for the primary persona's context and expectations.
- If strategy.manifesto exists (structured or text), let the provocation→tension→promise arc guide the narrative.
- If strategy.marketResearch exists, leverage gaps and opportunities for differentiation.
- If strategy.graphicSystem exists, follow patterns, grafisms, and image rules for visual consistency.
- If voice.values exist, apply them to any copy or text elements.
- If tokens (spacing, radius) exist, use them for consistent layout rhythm.`;
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
    for (const t of bg.typography as any[]) {
      const role = t.role || t.name || 'body';
      const family = t.family || t.fontFamily || '';
      const style = t.style || t.fontStyle || '';
      if (!family) continue;
      const parts = [family, style].filter(Boolean).join(' ');
      const size = t.size || t.fontSize;
      lines.push(`  ${role}: ${parts}${size ? ` ${size}px` : ''}`);
    }
    lines.push('');
  }

  // Guidelines - voice, dos/donts, imagery, accessibility
  if (bg.guidelines) {
    if (bg.guidelines.voice) lines.push(`TONE: ${bg.guidelines.voice}`);
    if (bg.guidelines.dos?.length) lines.push(`DO: ${bg.guidelines.dos.join(' | ')}`);
    if (bg.guidelines.donts?.length) lines.push(`AVOID: ${bg.guidelines.donts.join(' | ')}`);
    if (bg.guidelines.imagery) lines.push(`IMAGERY: ${bg.guidelines.imagery}`);
    if (!compact && bg.guidelines.accessibility) lines.push(`ACCESSIBILITY: ${bg.guidelines.accessibility}`);
    lines.push('');
  }

  // Strategy - archetypes, personas, positioning, manifesto, voice values (compact skips)
  if (!compact && bg.strategy) {
    if (bg.strategy.coreMessage) {
      const cm = bg.strategy.coreMessage;
      lines.push(`CORE MESSAGE: Product: ${cm.product} | Differential: ${cm.differential} | Emotional Bond: ${cm.emotionalBond}`);
    } else if (bg.strategy.positioning?.length) {
      lines.push(`POSITIONING: ${bg.strategy.positioning.join(' | ')}`);
    }
    if (bg.strategy.pillars?.length) {
      lines.push('BRAND PILLARS:');
      for (const p of bg.strategy.pillars) {
        lines.push(`  ${p.value}: ${p.description}`);
      }
    }
    if (bg.strategy.manifesto) {
      const m = bg.strategy.manifesto;
      if (typeof m === 'object') {
        if (m.provocation) lines.push(`MANIFESTO — Provocation: ${m.provocation}`);
        if (m.tension) lines.push(`MANIFESTO — Tension: ${m.tension}`);
        if (m.promise) lines.push(`MANIFESTO — Promise: ${m.promise}`);
        if (m.full) lines.push(`MANIFESTO: "${m.full}"`);
      } else {
        lines.push(`MANIFESTO: "${m}"`);
      }
    }
    if (bg.strategy.archetypes?.length) {
      lines.push('BRAND ARCHETYPES:');
      for (const a of bg.strategy.archetypes) {
        const tag = a.role === 'primary' ? ' [PRIMARY]' : '';
        lines.push(`  ${a.name}${tag}: ${a.description}`);
        if (a.examples?.length) lines.push(`    Examples: ${a.examples.join(', ')}`);
      }
    }
    if (bg.strategy.voiceValues?.length) {
      lines.push('VOICE & TONE VALUES:');
      for (const v of bg.strategy.voiceValues) {
        lines.push(`  ${v.title}: ${v.description}`);
        if (v.example) lines.push(`    e.g. "${v.example}"`);
      }
    }
    if (bg.strategy.personas?.length) {
      lines.push('TARGET PERSONAS:');
      for (const p of bg.strategy.personas) {
        const meta = [p.age ? `${p.age}y` : null, p.occupation].filter(Boolean).join(', ');
        lines.push(`  ${p.name}${meta ? ` (${meta})` : ''}`);
        if (p.bio) lines.push(`    Bio: ${p.bio}`);
        if (p.traits?.length) lines.push(`    Traits: ${p.traits.join(', ')}`);
        if (p.desires?.length) lines.push(`    Desires: ${p.desires.join(' | ')}`);
        if (p.painPoints?.length) lines.push(`    Pain Points: ${p.painPoints.join(' | ')}`);
      }
    }
    if (bg.strategy.marketResearch) {
      const mr = bg.strategy.marketResearch;
      if (mr.competitors?.length) lines.push(`COMPETITORS: ${mr.competitors.join(', ')}`);
      if (mr.gaps?.length) lines.push(`MARKET GAPS: ${mr.gaps.join(' | ')}`);
      if (mr.opportunities?.length) lines.push(`OPPORTUNITIES: ${mr.opportunities.join(' | ')}`);
      if (mr.notes) lines.push(`MARKET NOTES: ${mr.notes}`);
    }
    if (bg.strategy.graphicSystem) {
      const gs = bg.strategy.graphicSystem;
      if (gs.patterns?.length) lines.push(`GRAPHIC PATTERNS: ${gs.patterns.join(' | ')}`);
      if (gs.grafisms?.length) lines.push(`GRAFISMS: ${gs.grafisms.join(' | ')}`);
      if (gs.imageRules?.length) lines.push(`IMAGE RULES: ${gs.imageRules.join(' | ')}`);
      if (gs.editorialGrid) lines.push(`EDITORIAL GRID: ${gs.editorialGrid}`);
    }
    lines.push('');
  }

  // Tags — industry/keyword context
  if (!compact && bg.tags && Object.keys(bg.tags).length > 0) {
    const allTags = Object.values(bg.tags).flat().filter(Boolean);
    if (allTags.length) lines.push(`TAGS: ${allTags.join(', ')}`);
    lines.push('');
  }

  // Color Themes — curated bg/text/primary/accent combos
  if (bg.colorThemes?.length) {
    lines.push('COLOR THEMES:');
    for (const t of bg.colorThemes) {
      lines.push(`  ${t.name}: bg=${t.bg} text=${t.text} primary=${t.primary} accent=${t.accent}`);
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
      const cat = m.category ? ` [${m.category}]` : '';
      lines.push(`  [${m.type}]${cat} ${m.url}${m.label ? ` — ${m.label}` : ''}`);
    }
    lines.push('');
  }

  // Design tokens
  if (bg.tokens?.spacing) {
    lines.push(`SPACING: ${Object.entries(bg.tokens.spacing).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  if (bg.tokens?.radius) {
    lines.push(`RADIUS: ${Object.entries(bg.tokens.radius).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  }
  if (!compact && bg.tokens?.shadows) {
    const shadowEntries = Object.entries(bg.tokens.shadows).map(([k, v]: [string, any]) =>
      `${k}=(x:${v.x} y:${v.y} blur:${v.blur} color:${v.color} opacity:${v.opacity})`
    );
    if (shadowEntries.length) lines.push(`SHADOWS: ${shadowEntries.join(' | ')}`);
  }
  if (!compact && bg.tokens?.components) {
    const compKeys = Object.keys(bg.tokens.components);
    if (compKeys.length) lines.push(`COMPONENT TOKENS: ${compKeys.join(', ')}`);
  }
  if (!compact && bg.knowledgeFiles?.length) {
    const names = (bg.knowledgeFiles as any[]).map((f: any) => f.fileName).filter(Boolean);
    if (names.length) lines.push(`KNOWLEDGE BASE: ${names.join(', ')} (use as brand reference)`);
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
  // Full context (not compact) so strategy, voice, tone, imagery guidelines are included.
  // Logos and media are excluded from TEXT — they are injected as referenceImages by the caller.
  return buildBrandContext(bg, {
    includeLogos: false,
    includeMedia: false,
    compact: false,
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
  const cacheKey = CacheKey.brandContext(bg.id!, format);

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`[Cache] HIT context:${bg.id!.slice(0, 8)}`);
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
    console.log(`[Cache] SET context:${bg.id!.slice(0, 8)} (24h)`);
  } catch (err) {
    console.warn(`[Cache] Redis SET failed:`, (err as Error).message);
  }

  return result;
}

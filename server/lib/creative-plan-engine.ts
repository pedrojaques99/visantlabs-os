/**
 * Creative plan engine — pure function the route + the eval harness both call.
 *
 * Owns: brand-context construction, Gemini call (with retry/circuit breaker),
 * Zod validation, bounds clamp, brand-fidelity post-processing (snap fonts +
 * colors to nearest brand value, force logo when brand has one), and brand
 * media-first background selection.
 *
 * Does NOT own: HTTP plumbing, Brand-Learning insights fetching (the route
 * passes that in as `learnedBiasLine`), persistence.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import {
  CreativeAIResponseSchema,
  clampLayerBounds,
  type CreativeAIResponseValidated,
} from './creative-schema.js';
import { withResilience } from './ai-resilience.js';
import { buildBrandContextJSON } from './brandContextBuilder.js';
import type { BrandGuideline } from '../../src/lib/figma-types.js';

// Lazy init so scripts that call dotenv after import order still work.
let _model: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']> | null = null;
function getModel() {
  if (_model) return _model;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  _model = new GoogleGenerativeAI(key).getGenerativeModel({
    model: GEMINI_MODELS.TEXT,
    generationConfig: { responseMimeType: 'application/json' },
  });
  return _model;
}

export type CreativeFormat = '1:1' | '9:16' | '16:9' | '4:5';

export const FORMAT_RULES: Record<CreativeFormat, string> = {
  '1:1': 'Square layout. Balance elements centrally.',
  '9:16':
    'Vertical/portrait layout. Stack elements top-to-bottom. Keep headline above 0.5y. CTA near bottom (y > 0.75). Avoid overcrowding the sides.',
  '16:9':
    'Horizontal/landscape layout. Use left half for text (x < 0.5), right half for visual breathing room and background focus.',
  '4:5':
    'Slightly vertical. Headline in upper third, subheadline mid, CTA/logo in lower third.',
};

const FORMAT_RATIOS: Record<CreativeFormat, number> = {
  '1:1': 1,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '4:5': 4 / 5,
};

export const SYSTEM_PROMPT = `You are a creative director assembling layered marketing creatives.

The creative editor is for ASSEMBLY — text, shape, and logo layers — not for image generation. The background image is supplied separately (brand media or, only if necessary, AI-gen). Your job is the LAYOUT and the COPY using the brand's existing assets.

Return STRICT JSON matching this schema:

{
  "background": { "prompt": "<brief fallback prompt for AI image gen, only used if brand has no media>" },
  "overlay": { "type": "gradient", "direction": "bottom", "opacity": 0.5, "color": "#000000" } | null,
  "layers": [
    { "type": "text", "content": "HEADLINE WITH <accent>WORD</accent>", "role": "headline", "position": {"x":0.08,"y":0.6}, "size": {"w":0.84,"h":0.18}, "align": "left", "fontSize": 96, "fontFamily": "<EXACT BRAND FONT>", "color": "<EXACT BRAND HEX>", "bold": true },
    { "type": "text", "content": "Subheadline copy", "role": "subheadline", "position": {"x":0.08,"y":0.8}, "size": {"w":0.6,"h":0.06}, "align": "left", "fontSize": 36, "fontFamily": "<EXACT BRAND FONT>", "color": "<EXACT BRAND HEX>", "bold": false },
    { "type": "shape", "shape": "rect", "color": "<EXACT BRAND HEX>", "position": {"x":0.0,"y":0.85}, "size": {"w":0.12,"h":0.15} },
    { "type": "logo", "position": {"x":0.8,"y":0.05}, "size": {"w":0.15,"h":0.08} }
  ]
}

MANDATORY BRAND FIDELITY (this is the most important rule — violations are auto-corrected, but you should never need correction):
- Every text \`fontFamily\` MUST be copied character-for-character from \`brand.typography[].family\`. Pick the family whose \`role\` matches the layer's \`role\` (heading→headline, body→subheadline). NEVER invent or substitute.
- Every text and shape \`color\` MUST be a hex copied character-for-character from \`brand.colors[].hex\`. Pick by role: headline color from a high-contrast brand color, accent shapes from \`accent\`/\`secondary\`, body text from \`text\` or a brand color readable against the overlay. NEVER invent hexes (no #ffffff unless white is explicitly in the brand palette).
- If the brand has logos (\`brand.logos.length > 0\`), include exactly one \`logo\` layer. The renderer attaches the right URL — you only emit the layer with position+size.
- If the brand has no logos, do NOT emit a logo layer.

LAYOUT:
- Coordinates are 0-1 normalized (top-left origin).
- fontSize is in px assuming a 1080px tall canvas — scale proportionally for other formats.
- LOGO PLACEMENT: corner only (top-right ≈ x:0.82,y:0.04 / bottom-right ≈ x:0.82,y:0.88 / bottom-left ≈ x:0.04,y:0.88). Max size {w:0.12,h:0.07}. Never overlap headline.
- HEADLINE: punchy, specific to the prompt, max 6 words. Use <accent>WORD</accent> on 1-2 important words.
- SUBHEADLINE: 1 short phrase supporting the headline, max 12 words.

OUTPUT: only the JSON object. No markdown fences, no commentary.`;

export class PlanValidationError extends Error {
  constructor(public reason: string, public raw: string) {
    super(reason);
    this.name = 'PlanValidationError';
  }
}

// Strip C0/C1 control chars + role-injection markers before interpolating into prompts.
export function sanitizeForPrompt(s: string | undefined | null, maxLen = 2000): string {
  if (!s) return '';
  let out = '';
  for (let i = 0; i < s.length && out.length < maxLen; i++) {
    const code = s.charCodeAt(i);
    out += code < 0x20 || code === 0x7f ? ' ' : s[i];
  }
  return out.replace(/<\/?(system|model|assistant|user)>/gi, '').slice(0, maxLen);
}

interface PlanInput {
  prompt: string;
  format: CreativeFormat;
  brandGuideline?: BrandGuideline | null;
  learnedBiasLine?: string;
  /** Skip post-LLM brand-fidelity clampers. Eval/diagnostics use this to see
   *  the raw LLM output. Production keeps the default `false`. */
  skipFidelityPasses?: boolean;
}

export async function planFromBrand({
  prompt,
  format,
  brandGuideline,
  learnedBiasLine,
  skipFidelityPasses,
}: PlanInput): Promise<{
  plan: CreativeAIResponseValidated;
  rawPlan: CreativeAIResponseValidated;
  raw: string;
  pickedMedia: { url: string; type?: string; label?: string } | null;
}> {
  const safePrompt = sanitizeForPrompt(prompt);
  const formatRule = FORMAT_RULES[format] ?? '';

  let brandLine = '';
  let hasLogosFlag = false;
  if (brandGuideline) {
    brandLine = `Brand: ${JSON.stringify(buildBrandContextJSON(brandGuideline))}`;
    hasLogosFlag = (brandGuideline.logos ?? []).length > 0;
  }

  const userMessage = [
    `User prompt: ${safePrompt}`,
    `Format: ${format}`,
    `Layout Strategy: ${formatRule}`,
    brandLine,
    `Available Brand Logos: ${hasLogosFlag ? 'YES' : 'NO'}`,
    learnedBiasLine ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const { plan: rawPlan, raw } = await callGemini(userMessage);
  const plan =
    !skipFidelityPasses && brandGuideline
      ? applyBrandFidelityPasses(rawPlan, brandGuideline)
      : rawPlan;
  const pickedMedia = brandGuideline ? pickBrandMedia(brandGuideline, format) : null;
  return { plan, rawPlan, raw, pickedMedia };
}

async function callGemini(
  userMessage: string,
  attempt = 1
): Promise<{ plan: CreativeAIResponseValidated; raw: string }> {
  const result = await withResilience('gemini', () =>
    getModel().generateContent([{ text: SYSTEM_PROMPT }, { text: userMessage }])
  );
  const raw = result.response.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (attempt === 1) {
      return callGemini(
        `${userMessage}\n\nPREVIOUS ATTEMPT FAILED: response was not valid JSON. Output ONLY the JSON object — no markdown fences.`,
        attempt + 1
      );
    }
    throw new PlanValidationError('invalid JSON', raw);
  }

  const validated = CreativeAIResponseSchema.safeParse(parsed);
  if (!validated.success) {
    if (attempt === 1) {
      const issues = validated.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      return callGemini(
        `${userMessage}\n\nPREVIOUS ATTEMPT FAILED schema: ${issues}. Fix and output ONLY valid JSON.`,
        attempt + 1
      );
    }
    throw new PlanValidationError(
      `schema validation failed: ${validated.error.issues
        .slice(0, 3)
        .map((i) => i.message)
        .join('; ')}`,
      raw
    );
  }

  return { plan: clampLayerBounds(validated.data), raw };
}

// ── Brand fidelity post-processing ─────────────────────────────────────────────

interface BrandFonts {
  heading: string | null;
  body: string | null;
  all: string[];
}

interface BrandColors {
  hexes: string[];
  byRole: Record<string, string>;
}

function indexFonts(brand: BrandGuideline): BrandFonts {
  const typography = brand.typography ?? [];
  const heading =
    typography.find((t) => /head|display|primary/i.test(t.role || ''))?.family ??
    typography[0]?.family ??
    null;
  const body =
    typography.find((t) => /body|secondary|caption/i.test(t.role || ''))?.family ??
    typography[1]?.family ??
    typography[0]?.family ??
    null;
  return {
    heading,
    body,
    all: typography.map((t) => t.family).filter(Boolean) as string[],
  };
}

function indexColors(brand: BrandGuideline): BrandColors {
  const colors = brand.colors ?? [];
  const byRole: Record<string, string> = {};
  for (const c of colors) {
    if (c.role && c.hex) byRole[c.role.toLowerCase()] = c.hex;
  }
  return {
    hexes: colors.map((c) => c.hex).filter(Boolean) as string[],
    byRole,
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  const dr = ra[0] - rb[0];
  const dg = ra[1] - rb[1];
  const db = ra[2] - rb[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function nearestBrandColor(invented: string, palette: string[]): string | null {
  if (!palette.length) return null;
  let best = palette[0];
  let bestD = colorDistance(invented, best);
  for (let i = 1; i < palette.length; i++) {
    const d = colorDistance(invented, palette[i]);
    if (d < bestD) {
      bestD = d;
      best = palette[i];
    }
  }
  return best;
}

/**
 * Snap any LLM-invented font/color to the nearest brand value, and force-inject
 * a logo layer if the brand has logos but the model omitted one. This is the
 * safety net — the prompt also tells the model to obey, but we do not trust it.
 */
export function applyBrandFidelityPasses(
  plan: CreativeAIResponseValidated,
  brand: BrandGuideline
): CreativeAIResponseValidated {
  const fonts = indexFonts(brand);
  const colors = indexColors(brand);
  const palette = colors.hexes;

  const layers = plan.layers.map((layer) => {
    if (layer.type === 'text') {
      const wantedFont =
        layer.role === 'headline'
          ? fonts.heading
          : layer.role === 'subheadline' || layer.role === 'body'
            ? fonts.body
            : fonts.heading || fonts.body;
      const fontFamily =
        layer.fontFamily && fonts.all.includes(layer.fontFamily)
          ? layer.fontFamily
          : wantedFont ?? layer.fontFamily;

      const colorIsBrand = palette.some(
        (h) => h.toLowerCase() === layer.color.toLowerCase()
      );
      const color = colorIsBrand ? layer.color : nearestBrandColor(layer.color, palette) ?? layer.color;

      return { ...layer, fontFamily: fontFamily ?? layer.fontFamily, color };
    }
    if (layer.type === 'shape') {
      const colorIsBrand = palette.some(
        (h) => h.toLowerCase() === layer.color.toLowerCase()
      );
      const color = colorIsBrand ? layer.color : nearestBrandColor(layer.color, palette) ?? layer.color;
      return { ...layer, color };
    }
    return layer;
  });

  // Force a logo layer if brand has logos but the model omitted one.
  const hasLogos = (brand.logos ?? []).length > 0;
  const hasLogoLayer = layers.some((l) => l.type === 'logo');
  if (hasLogos && !hasLogoLayer) {
    layers.push({
      type: 'logo',
      position: { x: 0.82, y: 0.04 },
      size: { w: 0.12, h: 0.07 },
    });
  }

  return { ...plan, layers };
}

// ── Media-first background selection ───────────────────────────────────────────

/**
 * Pick the best-fit image from `brand.media` for the requested format.
 * Strategy: prefer items whose declared/inferred aspect ratio is closest to
 * the target ratio. Returns `null` if the brand has no usable media.
 */
export function pickBrandMedia(
  brand: BrandGuideline,
  format: CreativeFormat
): { url: string; type?: string; label?: string } | null {
  const media = (brand.media ?? []).filter((m) => !!m.url);
  if (!media.length) return null;
  const target = FORMAT_RATIOS[format];

  const scored = media.map((m) => {
    const declared = inferAspectRatio(m as { url: string; type?: string; label?: string });
    // Without a known ratio we can't be sure — give it a middling score so a
    // ratio-known match wins, but the unknown still beats no-media.
    if (declared == null) return { m, score: Math.abs(target - 1) + 0.5 };
    return { m, score: Math.abs(target - declared) };
  });
  scored.sort((a, b) => a.score - b.score);
  const best = scored[0].m;
  return { url: best.url, type: (best as any).type, label: (best as any).label };
}

function inferAspectRatio(m: { url: string; label?: string; type?: string }): number | null {
  const haystack = `${m.label ?? ''} ${m.type ?? ''} ${m.url}`.toLowerCase();
  if (/\b(1[:_-]1|square)\b/.test(haystack)) return 1;
  if (/\b(9[:_-]16|story|reel|portrait)\b/.test(haystack)) return 9 / 16;
  if (/\b(16[:_-]9|landscape|wide)\b/.test(haystack)) return 16 / 9;
  if (/\b(4[:_-]5)\b/.test(haystack)) return 4 / 5;
  return null;
}

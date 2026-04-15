import type { ColorVariable, FontVariable } from '@/lib/figma-types';
import type { ColorEntry, LogoSlot, TypographySlot } from '../store/types';

/**
 * Heuristic mappers: raw Figma library extraction → brand tab slots.
 * Pure functions — unit-testable, no store/IO.
 */

// ── Color role detection ──────────────────────────────────────────────

/**
 * Common naming conventions across design systems:
 *   `brand/primary/500`, `semantic/success`, `neutral/100`, `color-primary`
 */
const COLOR_ROLE_RULES: Array<{ role: string; match: RegExp; weight: number }> = [
  { role: 'primary',    match: /\b(primary|brand|main)\b/i,             weight: 10 },
  { role: 'secondary',  match: /\b(secondary|sub|alt)\b/i,              weight: 9 },
  { role: 'accent',     match: /\b(accent|highlight|pop)\b/i,           weight: 9 },
  { role: 'success',    match: /\b(success|positive|ok|confirm)\b/i,    weight: 8 },
  { role: 'warning',    match: /\b(warn|warning|caution|attention)\b/i, weight: 8 },
  { role: 'danger',     match: /\b(error|danger|destructive|fail|negative)\b/i, weight: 8 },
  { role: 'info',       match: /\b(info|informational)\b/i,             weight: 7 },
  { role: 'background', match: /\b(bg|background|surface|canvas)\b/i,   weight: 6 },
  { role: 'foreground', match: /\b(fg|foreground|text|on-surface|ink)\b/i, weight: 6 },
  { role: 'neutral',    match: /\b(neutral|grey|gray|stone|slate|zinc)\b/i, weight: 5 }
];

/**
 * Figma variables are usually scaled (e.g. primary/100..900). Prefer the
 * "mid" token (400-600) when multiple candidates exist.
 */
function scaleAffinity(name: string): number {
  const m = name.match(/\b(\d{2,4})\b/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const dist = Math.abs(500 - n);
  return Math.max(0, 10 - dist / 50); // peaks at 500
}

export function detectColorRoles(colors: ColorVariable[]): Map<string, ColorEntry> {
  const buckets: Record<string, Array<{ color: ColorVariable; score: number }>> = {};
  for (const c of colors) {
    for (const rule of COLOR_ROLE_RULES) {
      if (rule.match.test(c.name)) {
        const score = rule.weight + scaleAffinity(c.name);
        (buckets[rule.role] ??= []).push({ color: c, score });
        break; // first rule wins — avoids duplicate classification
      }
    }
  }
  const out = new Map<string, ColorEntry>();
  for (const [role, items] of Object.entries(buckets)) {
    items.sort((a, b) => b.score - a.score);
    const best = items[0].color;
    out.set(role, { role, hex: best.value || '', name: best.name });
  }
  return out;
}

// ── Typography role detection ─────────────────────────────────────────

const TYPE_ROLE_RULES: Array<{ slot: 'primary' | 'secondary'; match: RegExp; weight: number }> = [
  { slot: 'primary',   match: /\b(display|h1|heading|headline|title|hero)\b/i,      weight: 10 },
  { slot: 'primary',   match: /\b(h[2-3]|subtitle|lead)\b/i,                        weight: 6 },
  { slot: 'secondary', match: /\b(body|paragraph|p|text|content|copy|caption|label|default)\b/i, weight: 10 }
];

export function detectTypographyRoles(fonts: FontVariable[]): TypographySlot[] {
  const scored: Record<'primary' | 'secondary', Array<{ font: FontVariable; score: number }>> = {
    primary: [],
    secondary: []
  };

  for (const f of fonts) {
    if (!f.family) continue;
    for (const rule of TYPE_ROLE_RULES) {
      if (rule.match.test(f.name)) {
        scored[rule.slot].push({ font: f, score: rule.weight });
      }
    }
  }

  // Positional fallback: largest style → primary, next distinct family → secondary
  const sortedBySize = [...fonts].filter((f) => !!f.family);
  if (scored.primary.length === 0 && sortedBySize[0]) {
    scored.primary.push({ font: sortedBySize[0], score: 1 });
  }
  if (scored.secondary.length === 0) {
    const primaryFamily = scored.primary[0]?.font.family;
    const alt = sortedBySize.find((f) => f.family !== primaryFamily);
    if (alt) scored.secondary.push({ font: alt, score: 1 });
  }

  return (['primary', 'secondary'] as const).map((slot) => {
    const best = scored[slot].sort((a, b) => b.score - a.score)[0]?.font;
    return {
      name: slot,
      fontFamily: best?.family,
      fontStyle: best?.style
    };
  });
}

// ── Logo detection (from component list) ──────────────────────────────

export interface LogoCandidate {
  id: string;
  name: string;
  thumbnail?: string;
  folderPath?: string[];
}

const LOGO_VARIANT_RULES: Array<{ slot: 'light' | 'dark' | 'accent'; match: RegExp; weight: number }> = [
  { slot: 'light',  match: /\b(light|white|on-dark|inverse|reverse)\b/i, weight: 10 },
  { slot: 'dark',   match: /\b(dark|black|on-light|mono)\b/i,            weight: 10 },
  { slot: 'accent', match: /\b(color|colou?red|primary|full|rgb)\b/i,    weight: 9 }
];

export function isLogoComponent(name: string, folderPath?: string[]): boolean {
  const joined = [name, ...(folderPath || [])].join('/').toLowerCase();
  return /\blogo(s|marks|type)?\b/.test(joined) || /\bbrand[-_ ]?mark\b/.test(joined);
}

export function detectLogoSlots(candidates: LogoCandidate[]): LogoSlot[] {
  const picked: Partial<Record<'light' | 'dark' | 'accent', LogoCandidate>> = {};

  // First pass: explicit variant via naming
  for (const c of candidates) {
    for (const rule of LOGO_VARIANT_RULES) {
      if (rule.match.test(c.name) && !picked[rule.slot]) {
        picked[rule.slot] = c;
        break;
      }
    }
  }

  // Second pass: positional fallback for unclaimed slots
  const leftover = candidates.filter((c) => !Object.values(picked).some((p) => p?.id === c.id));
  const slots = ['accent', 'dark', 'light'] as const; // accent first (usually the hero logo)
  slots.forEach((slot, i) => {
    if (!picked[slot] && leftover[i]) picked[slot] = leftover[i];
  });

  return (['light', 'dark', 'accent'] as const).map((slot) => ({
    name: slot,
    src: picked[slot]?.thumbnail,
    loaded: !!picked[slot]?.thumbnail
  }));
}

// ── Merge strategy ────────────────────────────────────────────────────

export interface BrandImportResult {
  colors: Map<string, ColorEntry>;
  typography: TypographySlot[];
  logos: LogoSlot[];
}

export interface MergeOptions {
  /** If true, overwrite existing slot values. Default: fill-only. */
  overwrite?: boolean;
}

/**
 * Combine detected values with existing store state.
 * Default behavior fills empty slots only — non-destructive.
 */
export function mergeImportIntoBrand(
  detected: BrandImportResult,
  existing: { selectedColors: Map<string, ColorEntry>; typography: TypographySlot[]; logos: LogoSlot[] },
  opts: MergeOptions = {}
): BrandImportResult {
  const colors = new Map(existing.selectedColors);
  for (const [role, entry] of detected.colors) {
    if (opts.overwrite || !colors.has(role)) colors.set(role, entry);
  }

  const typography = existing.typography.map((slot) => {
    const found = detected.typography.find((t) => t.name === slot.name);
    if (!found) return slot;
    if (opts.overwrite || !slot.fontFamily) return { ...slot, ...found };
    return slot;
  });

  const logos = existing.logos.map((slot) => {
    const found = detected.logos.find((l) => l.name === slot.name);
    if (!found) return slot;
    if (opts.overwrite || !slot.src) return { ...slot, ...found };
    return slot;
  });

  return { colors, typography, logos };
}

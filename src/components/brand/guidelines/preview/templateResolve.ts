/**
 * Pure resolvers for the Figma-template sync renderer — no React, unit-testable.
 *
 * The schema is brand-agnostic: fills reference a `Brand` VARIABLE (not a color) and
 * text may reference a `#slot`. These functions bind those references to the live
 * brand: variable → `roleTheme` color, slot → resolved content. Keeping them pure
 * (and separate from the React component) makes the mapping testable in isolation.
 */
import type { RoleTheme } from './mockTokens';
import type { TemplateFill } from '@/lib/figma-template-schema';

/** Brand variable name → the key on the resolved `RoleTheme`. */
export const VAR_TO_ROLE: Record<string, keyof RoleTheme> = {
  bg: 'bg',
  surface: 'surface',
  text: 'text',
  'text-muted': 'textMuted',
  accent: 'accent',
  'accent-text': 'accentText',
  primary: 'primary',
  secondary: 'secondary',
};

/** Figma font-style name → CSS font-weight. */
export const WEIGHTS: Record<string, number> = {
  Thin: 100,
  ExtraLight: 200,
  Light: 300,
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
  Black: 900,
};

export function hexWithOpacity(hex: string, opacity: number): string {
  if (opacity >= 1) return hex;
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** A bound variable resolves to the brand's live token; a literal keeps its hex. */
export function resolveFill(fill: TemplateFill | undefined, t: RoleTheme): string | undefined {
  if (!fill) return undefined;
  const base = fill.varName && VAR_TO_ROLE[fill.varName] ? t[VAR_TO_ROLE[fill.varName]] : fill.hex;
  if (!base) return undefined;
  return hexWithOpacity(base, fill.opacity);
}

/** Resolved display content a `#slot` can bind to. */
export interface TemplateContent {
  name: string;
  headline: string;
  body: string;
  caption: string;
  tagL: string;
  tagR: string;
  keywords: string[];
  tagline: string;
  description: string;
}

type SlotGetter = (c: TemplateContent) => string;

/**
 * Convention pipeline: a normalized slot id → a brand content field, by ALIAS (EN+PT)
 * — first match wins. Designers name slots naturally (`#headline`, `#manchete`, `#title`,
 * `#marca`, `#slogan`…) with NO code change per slot. Indexed keywords (`#kw1`, `#tag2`)
 * are handled separately, and unknown slots fall back to the layer's own drawn text, so
 * a preview is never blank. Extend the map (data), not a switch.
 */
const SLOT_ALIASES: Array<[RegExp, SlotGetter]> = [
  [/^(h1|headline|title|hero|heading|manchete|titulo)$/, (c) => c.headline],
  [/^(brand|name|wordmark|logotype|marca|nome)$/, (c) => c.name],
  [/^(tagline|slogan|eyebrow|kicker)$/, (c) => c.tagline || c.caption],
  [/^(caption|legenda|label)$/, (c) => c.caption],
  [/^(body|desc|description|paragraph|subtitle|subhead|corpo|texto|descricao)$/, (c) => c.body || c.description],
  [/^tagl(eft)?$/, (c) => c.tagL],
  [/^tagr(ight)?$/, (c) => c.tagR],
];

const normalizeSlot = (id: string) => id.toLowerCase().replace(/[\s_-]/g, '');

/**
 * Resolve a `#slot` id to brand content via the alias pipeline. `fallback` (the layer's
 * literal Figma text) is returned when nothing maps or the mapped field is empty — so
 * unknown/unfilled slots keep what the designer drew instead of going blank.
 */
export function resolveSlot(id: string, c: TemplateContent, fallback = ''): string {
  const key = normalizeSlot(id);
  const kw = key.match(/^(?:kw|keyword|tag|palavra)(\d+)$/);
  if (kw) return c.keywords[Number(kw[1]) - 1] || fallback;
  for (const [re, get] of SLOT_ALIASES) {
    if (re.test(key)) return get(c) || fallback;
  }
  return fallback;
}

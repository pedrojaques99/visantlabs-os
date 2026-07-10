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
}

/** Slot id → the brand's content (mirrors the hand-coded mocks' content mapping). */
export function resolveSlot(id: string, c: TemplateContent): string {
  switch (id) {
    case 'h1':
      return c.headline;
    case 'body':
      return c.body;
    case 'brand':
      return c.name;
    case 'caption':
      return c.caption;
    case 'tagL':
      return c.tagL;
    case 'tagR':
      return c.tagR;
    case 'tagline':
      return c.caption;
    default:
      if (/^kw\d+$/.test(id)) return c.keywords[Number(id.slice(2)) - 1] || '';
      return '';
  }
}

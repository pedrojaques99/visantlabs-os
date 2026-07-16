import type { BrandManifesto } from './figma-types';

/**
 * The manifesto is stored in two shapes: a flat string (what ingest harvests from
 * running text) or the structured provocação/tensão/promessa arc (what the deck
 * spells out, or the owner fills in). Anywhere that just needs *the text* should
 * call this instead of re-deriving it — one of those call sites used to pass the
 * raw object straight into JSX.
 */
export function manifestoText(raw: string | BrandManifesto | null | undefined): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return (
    raw.full || [raw.provocation, raw.tension, raw.promise].filter(Boolean).join('\n\n') || ''
  );
}

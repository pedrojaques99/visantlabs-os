/**
 * Image power for presets — resolve a brand's REAL assets into preset image slots,
 * deterministically. Logos by variant/contrast; photos by semantic relevance.
 *
 * Reuses what already exists: the brand's `logos[]` (variant + R2 url) and analyzed
 * `media[]`, plus `searchAssets` (the Pinecone semantic retrieval from #162). The
 * plugin's FILL_TEMPLATE then pulls each url via `createImageAsync`.
 */
import type { BrandGuideline } from '../types/brandGuideline.js';
import { searchAssets } from './brand/assetVectors.js';
import { compileFigmaVariables } from './figma-variable-compiler.js';

type Asset = { id?: string; url?: string; variant?: string; label?: string; type?: string };

/** WCAG-ish luminance of an RGB(0–1) triple. */
function lum(c: { r: number; g: number; b: number }): number {
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

/** Is the brand's background light? (decides which logo variant reads.) */
export function brandBgIsLight(brand: BrandGuideline): boolean {
  const bg = compileFigmaVariables(brand).values.find((v) => v.name === 'bg');
  if (bg && typeof bg.value === 'object') return lum(bg.value as any) > 0.5;
  return true; // default to light
}

/** Pick the best logo url for a slot: explicit variant wins, else by bg contrast. */
export function pickLogoUrl(
  logos: Asset[],
  opts: { variant?: string; bgIsLight?: boolean } = {}
): string | undefined {
  if (!logos.length) return undefined;
  const byVariant = (v: string) => logos.find((l) => `${l.variant || ''}`.toLowerCase() === v);
  if (opts.variant) return (byVariant(opts.variant.toLowerCase()) || logos[0])?.url;
  // Light bg → a dark/primary logo reads; dark bg → a light logo reads.
  const order = opts.bgIsLight
    ? ['dark', 'primary', 'accent', 'light']
    : ['light', 'primary', 'accent', 'dark'];
  for (const v of order) {
    const hit = byVariant(v);
    if (hit?.url) return hit.url;
  }
  return logos[0]?.url;
}

const photoIndex = (slotId: string): number => {
  const m = /(\d+)$/.exec(slotId);
  return m ? Math.max(0, parseInt(m[1], 10) - 1) : 0;
};

export interface ImageSlotSpec {
  id: string;
  variant?: string;
}

/**
 * Resolve image slots → `{ slotId: { imageUrl } }` from the brand's real assets.
 * - `logo*` → logo by variant / bg-contrast.
 * - `icon`  → an icon logo or icon-tagged media.
 * - `photo*`/`image*` → semantic search over media (brief), else media in order.
 * Unknown/absent slots are simply skipped.
 */
export async function resolveImageSlots(
  brand: BrandGuideline,
  slots: ImageSlotSpec[],
  opts: { brief?: string; bgIsLight?: boolean } = {}
): Promise<Record<string, { imageUrl: string }>> {
  const out: Record<string, { imageUrl: string }> = {};
  const logos = ((brand.logos as Asset[]) || []).filter((l) => l?.url);
  const media = ((brand.media as Asset[]) || []).filter((m) => m?.url);
  const photos = media.filter((m) => (m.type || 'image') === 'image');
  const bgIsLight = opts.bgIsLight ?? brandBgIsLight(brand);

  let photoHits: Array<{ assetId: string }> | null = null;
  const urlById = new Map<string, string>();
  for (const a of [...logos, ...media]) if (a.id && a.url) urlById.set(a.id, a.url);

  for (const slot of slots) {
    const id = slot.id.toLowerCase();
    if (id.startsWith('logo')) {
      const url = pickLogoUrl(logos, { variant: slot.variant, bgIsLight });
      if (url) out[slot.id] = { imageUrl: url };
      continue;
    }
    if (id === 'icon') {
      const ic =
        logos.find((l) => `${l.variant || ''}`.toLowerCase() === 'icon') ||
        media.find((m) => /icon|symbol|mark/i.test(m.label || ''));
      if (ic?.url) out[slot.id] = { imageUrl: ic.url };
      continue;
    }
    if (id.startsWith('photo') || id.startsWith('image')) {
      // Semantic pick (lazy) — the right media for the brief; else media in order.
      if (photoHits === null && opts.brief && brand.id) {
        photoHits = await searchAssets(brand.id, opts.brief, 8).catch(() => []);
      }
      const i = photoIndex(slot.id);
      const fromSearch = photoHits?.[i] ? urlById.get(photoHits[i].assetId) : undefined;
      const url = fromSearch || photos[i]?.url || photos[0]?.url;
      if (url) out[slot.id] = { imageUrl: url };
    }
  }
  return out;
}

/** The deterministic FILL_TEMPLATE op (server-resolved colors + images). */
export interface PresetFillOp {
  type: 'FILL_TEMPLATE';
  templateName?: string;
  templateNodeId?: string;
  clone: boolean;
  slots: Record<string, unknown>;
  brandMode: ReturnType<typeof compileFigmaVariables>;
}

/**
 * Build a complete FILL_TEMPLATE op from a brand + template + text content + brief.
 * Colors come from `compileFigmaVariables`; images from `resolveImageSlots`. The
 * agent supplies only text + a brief — never URLs or geometry.
 */
export async function buildPresetFillOp(params: {
  brand: BrandGuideline;
  templateName?: string;
  templateNodeId?: string;
  /** Text slot content keyed by slot id (h1, infos, …). */
  text?: Record<string, string | string[] | null>;
  /** Image slots to resolve (default: logo, photo1, photo2, icon). */
  imageSlots?: ImageSlotSpec[];
  brief?: string;
  clone?: boolean;
}): Promise<PresetFillOp> {
  const { brand, text = {}, brief, clone = true } = params;
  const targets =
    params.imageSlots && params.imageSlots.length
      ? params.imageSlots
      : [{ id: 'logo' }, { id: 'photo1' }, { id: 'photo2' }, { id: 'icon' }];
  const images = await resolveImageSlots(brand, targets, { brief });
  return {
    type: 'FILL_TEMPLATE',
    templateName: params.templateName,
    templateNodeId: params.templateNodeId,
    clone,
    slots: { ...text, ...images },
    brandMode: compileFigmaVariables(brand),
  };
}

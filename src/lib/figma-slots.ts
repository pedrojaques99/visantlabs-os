/**
 * Figma preset CONVENTION — the single contract both a human designer and any AI
 * use to author and fill templates. The naming convention IS the API:
 *
 *   • A FRAME named `[Template] <Name>` is a preset.
 *   • A layer named `#<slot>` is a fillable SLOT. Type is inferred from the node:
 *       TEXT node            → text slot   (e.g. `#h1`, `#h2`)
 *       image-capable node   → image slot  (e.g. `#photo1`, `#logo`)
 *     Suffix `?` = optional  (`#h2?`), suffix `[]` = list/repeating (`#infos[]`).
 *   • Variables in a collection (recommended name `Brand`) named with the semantic
 *     token roles below (`accent`, `bg`, `heading-font`, …) carry the THEME. Swapping
 *     their values per a brand mode rethemes the whole preset — deterministically.
 *
 * A designer only NAMES layers + binds variables. The plugin scans this into a
 * `TemplateManifest`; an AI reads the manifest and fills slots — never touching
 * geometry. Pure + dependency-free so the plugin, server, and tests all share it.
 */

export type SlotType = 'text' | 'image';

export interface TemplateSlot {
  /** Stable id from the layer name after `#` (e.g. `h1`, `photo1`). */
  id: string;
  type: SlotType;
  /** `#logo:dark` — an explicit asset variant hint (logo variant, etc.). */
  variant?: string;
  /** `#name?` — may be omitted; the filler hides the layer when absent. */
  optional: boolean;
  /** `#name[]` — repeating/multi-line content (e.g. a list of infos). */
  list: boolean;
  /** Figma node id (filled in by the plugin scan). */
  nodeId?: string;
  /** Current/sample content, so an AI can see the intended tone/length. */
  sample?: string;
}

export interface TemplateVariableInfo {
  /** Variable name = semantic token role (e.g. `accent`, `heading-font`). */
  name: string;
  type: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  collectionId?: string;
  collectionName?: string;
}

export interface TemplateManifest {
  id: string;
  name: string;
  width: number;
  height: number;
  /** e.g. "1:1", "4:5", "9:16" — derived from width/height. */
  aspect: string;
  slots: TemplateSlot[];
  variables: TemplateVariableInfo[];
}

/** What an AI/human supplies to fill a slot. `null` skips an optional slot. */
export type SlotValue = string | string[] | { imageUrl?: string; imageHash?: string } | null;
export type SlotFills = Record<string, SlotValue>;

export const SLOT_PREFIX = '#';

// Layer name → slot descriptor. Returns null for non-slot layers, so scanning is
// a simple filter. `#h1`, `#h2?`, `#infos[]`, `#photo1[]?`, `#logo:dark` all parse.
// Optional `:variant` (e.g. `#logo:dark`) hints which asset variant to resolve.
const SLOT_RE = /^#([a-zA-Z][a-zA-Z0-9_-]*)(?::([a-zA-Z][a-zA-Z0-9_-]*))?(\[\])?(\?)?$/;

export function parseSlotName(
  layerName: string
): { id: string; variant?: string; optional: boolean; list: boolean } | null {
  const m = SLOT_RE.exec((layerName || '').trim());
  if (!m) return null;
  return { id: m[1], variant: m[2] || undefined, optional: !!m[4], list: !!m[3] };
}

export function isSlotLayer(layerName: string): boolean {
  return parseSlotName(layerName) !== null;
}

/** The semantic variable names a preset binds to — the SSoT for brand theming.
 * Templates bind fills/text to these; `compileFigmaVariables` emits these names. */
export const BRAND_TOKEN_VARS = {
  color: ['accent', 'accent-text', 'primary', 'secondary', 'bg', 'surface', 'text', 'text-muted'],
  font: ['heading-font', 'body-font'],
  number: ['radius-sm', 'radius-md', 'radius-lg'],
} as const;

export type BrandColorVar = (typeof BRAND_TOKEN_VARS.color)[number];
export type BrandFontVar = (typeof BRAND_TOKEN_VARS.font)[number];

/** Greatest-common aspect label for a width×height, snapped to the common set. */
export function aspectLabel(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const ratio = width / height;
  const common: Array<[string, number]> = [
    ['1:1', 1],
    ['4:5', 4 / 5],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
  ];
  let best = common[0];
  for (const c of common) if (Math.abs(c[1] - ratio) < Math.abs(best[1] - ratio)) best = c;
  return best[0];
}

/** Deterministic validation of a fill payload against a manifest — catches an AI
 * that omitted a required slot or sent the wrong type, BEFORE touching Figma. */
export function validateSlotFills(
  manifest: Pick<TemplateManifest, 'slots'>,
  fills: SlotFills
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const byId = new Map(manifest.slots.map((s) => [s.id, s]));

  for (const slot of manifest.slots) {
    const v = fills[slot.id];
    const present = v !== undefined && v !== null;
    if (!present) {
      if (!slot.optional) errors.push(`missing required slot "${slot.id}"`);
      continue;
    }
    if (slot.type === 'text') {
      const isText =
        typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
      if (!isText) errors.push(`slot "${slot.id}" expects text${slot.list ? ' list' : ''}`);
    } else {
      const isImage =
        typeof v === 'object' &&
        !Array.isArray(v) &&
        (!!(v as any).imageUrl || !!(v as any).imageHash);
      if (!isImage) errors.push(`slot "${slot.id}" expects an image { imageUrl | imageHash }`);
    }
  }
  for (const id of Object.keys(fills)) {
    if (!byId.has(id)) errors.push(`unknown slot "${id}" (not in template)`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * tagHarmonizer — deixa a seleção de tags coerente antes de virar prompt.
 *
 * Três funções:
 *  1. DEDUP + validação contra os pools (AVAILABLE_*) via fuzzy lookup.
 *  2. RESOLVE CONFLITOS (ex. Golden Hour + Night Scene → escolhe o último).
 *  3. GAP FILL por arquétipo de branding (se lighting vazio e branding=Luxury,
 *     injeta Chiaroscuro+Rim Light).
 *
 * Retorna também um `rationale: string[]` explicando cada mudança —
 * útil pra debug em dev e pra eventualmente expor no front ("a IA ajustou
 * suas escolhas porque X").
 *
 * Função pura. Zero deps externas. Usa os pools estáticos como referência;
 * se o DB tiver pools expandidos, passar via param `pools` override.
 */

import {
  AVAILABLE_BRANDING_TAGS,
  AVAILABLE_LOCATION_TAGS,
  AVAILABLE_ANGLE_TAGS,
  AVAILABLE_LIGHTING_TAGS,
  AVAILABLE_EFFECT_TAGS,
  AVAILABLE_MATERIAL_TAGS,
} from '../../../src/utils/mockupConstants.js';

export interface RawTags {
  brandingTags: string[];
  locationTags: string[];
  angleTags: string[];
  lightingTags: string[];
  effectTags: string[];
  materialTags: string[];
}

export interface HarmonizedTags extends RawTags {
  rationale: string[];
}

/** Conflitos conhecidos: se a chave está presente, o valor não pode coexistir. */
const LIGHTING_CONFLICTS: Record<string, string[]> = {
  'Night Scene':   ['Golden Hour', 'Direct Sunlight', 'Hard Sunlight', 'Blue Hour', 'Overcast', 'North-Window Daylight'],
  'Golden Hour':   ['Night Scene', 'Blue Hour', 'Neon Accent Glow'],
  'Blue Hour':     ['Golden Hour', 'Direct Sunlight', 'Hard Sunlight'],
  'Studio Lighting': ['Golden Hour', 'Direct Sunlight', 'Overcast', 'Dappled Leaf Light'],
  'Hard Sunlight': ['Overcast', 'Diffused', 'Soft Light'],
  'Overcast':      ['Hard Sunlight', 'Direct Sunlight', 'Chiaroscuro'],
};

const EFFECT_CONFLICTS: Record<string, string[]> = {
  Monochrome: ['Teal & Amber Grade', 'Warm Color Grade'],
  'Teal & Amber Grade': ['Monochrome', 'Warm Color Grade'],
  'Warm Color Grade':   ['Monochrome', 'Teal & Amber Grade'],
};

/**
 * Defaults por arquétipo de branding — usados só pra preencher slots vazios.
 * Nunca sobrescrevem escolha explícita do usuário.
 * Valores precisam existir nos pools AVAILABLE_*.
 */
const ARCHETYPE_DEFAULTS: Record<
  string,
  Partial<{ locations: string[]; lighting: string[]; angles: string[]; effects: string[]; materials: string[] }>
> = {
  Luxury: {
    locations: ['Black Marble Slab', 'Limestone Surfaces'],
    lighting:  ['Chiaroscuro', 'Rim Light'],
    angles:    ['Close-Up', 'Macro 100mm'],
    effects:   ['Subsurface Scattering', 'Ray-tracing'],
    materials: ['Polished Gold', 'Frosted Glass'],
  },
  Premium: {
    locations: ['Minimalist Studio', 'Modern Office'],
    lighting:  ['Large Softbox Key', 'Soft Light'],
    angles:    ['Three-Quarter View', 'Hero Angle'],
    effects:   ['Micro-contrast', '8k Resolution'],
    materials: ['Brushed Aluminum', 'Tactile Paper Grain'],
  },
  Sport: {
    locations: ['Brutalist Concrete', 'Urban City'],
    lighting:  ['Hard Rim Light', 'Direct Sunlight'],
    angles:    ['Low Angle', 'Hero Angle'],
    effects:   ['Motion Blur', 'High Contrast'],
    materials: ['Brushed Aluminum', 'Carbon Fiber Weave'],
  },
  Tech: {
    locations: ['Modern Office', 'Workspace'],
    lighting:  ['Cinematic', 'Rim Light'],
    angles:    ['Three-Quarter View', 'Hero Angle'],
    effects:   ['Ray-tracing', 'Anamorphic Flare'],
    materials: ['Brushed Aluminum', 'Liquid Chrome'],
  },
  Minimalist: {
    locations: ['Minimalist Studio', 'Seamless Paper Backdrop'],
    lighting:  ['Soft Light', 'Diffused'],
    angles:    ['Eye-Level', 'Top-Down (Flat Lay)'],
    effects:   ['Micro-contrast'],
    materials: ['Uncoated Cotton Paper', 'Tactile Paper Grain'],
  },
  'Eco-friendly': {
    locations: ['Wild Botanical Scene', 'Wooden Table'],
    lighting:  ['Natural Light', 'Golden Hour', 'Dappled Leaf Light'],
    angles:    ['Top-Down (Flat Lay)', 'Close-Up'],
    effects:   ['Bokeh'],
    materials: ['Recycled Kraft', 'Raw Linen'],
  },
  Sustainable: {
    locations: ['Wild Botanical Scene', 'Linen Tabletop'],
    lighting:  ['Natural Light', 'Diffused'],
    angles:    ['Top-Down (Flat Lay)'],
    effects:   ['Bokeh'],
    materials: ['Recycled Kraft', 'Raw Linen'],
  },
  Handmade: {
    locations: ['Wooden Table', 'Linen Tabletop'],
    lighting:  ['Golden Hour', 'Warm Practical Tungsten'],
    angles:    ['Close-Up', 'Top-Down (Flat Lay)'],
    effects:   ['35mm Film Grain'],
    materials: ['Letterpress Cardstock', 'Raw Linen'],
  },
  Playful: {
    locations: ['Light Box', 'Seamless Paper Backdrop'],
    lighting:  ['Studio Lighting', 'Hard Sunlight'],
    angles:    ['Dutch Angle', 'Eye-Level'],
    effects:   ['High Contrast', 'Halftone'],
    materials: ['Soft-touch Plastic', 'Glossy Lamination'],
  },
  Vintage: {
    locations: ['Weathered Concrete Wall', 'Painted Brick Alley'],
    lighting:  ['Overcast', 'Warm Practical Tungsten'],
    angles:    ['Eye-Level'],
    effects:   ['Vintage Film', '35mm Film Grain', 'Halation Glow'],
    materials: ['Recycled Kraft'],
  },
  Editorial: {
    locations: ['Seamless Paper Backdrop', 'Cyclorama Studio'],
    lighting:  ['Large Softbox Key', 'Soft Light'],
    angles:    ['Three-Quarter View', 'Knolling Layout'],
    effects:   ['Micro-contrast'],
    materials: ['Uncoated Cotton Paper', 'Embossed'],
  },
  Corporate: {
    locations: ['Modern Office', 'Workspace'],
    lighting:  ['Studio Lighting', 'North-Window Daylight'],
    angles:    ['Eye-Level', 'Three-Quarter View'],
    effects:   ['Micro-contrast'],
    materials: ['Brushed Aluminum', 'Tactile Paper Grain'],
  },
  Food: {
    locations: ['Wooden Table', 'Linen Tabletop'],
    lighting:  ['Golden Hour', 'Natural Light'],
    angles:    ['Top-Down (Flat Lay)', 'Close-Up'],
    effects:   ['Shallow Depth of Field'],
    materials: ['Ceramic', 'Raw Linen'],
  },
};

/**
 * Procura uma tag no pool: exact → case-insensitive → includes parcial.
 * Retorna o valor canônico do pool, ou null se não achar.
 */
const fuzzyLookup = (tag: string, pool: readonly string[]): string | null => {
  if (!tag) return null;
  const trimmed = tag.trim();
  if (pool.includes(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  const ci = pool.find(p => p.toLowerCase() === lower);
  if (ci) return ci;
  const partial = pool.find(
    p => p.toLowerCase().includes(lower) || lower.includes(p.toLowerCase()),
  );
  return partial ?? null;
};

const normalizeAgainstPool = (
  tags: string[],
  pool: readonly string[],
  rationale: string[],
  label: string,
): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const canonical = fuzzyLookup(raw, pool);
    if (!canonical) {
      rationale.push(`[${label}] descartada tag desconhecida: "${raw}"`);
      continue;
    }
    if (seen.has(canonical)) continue;
    if (canonical !== raw) {
      rationale.push(`[${label}] "${raw}" normalizada para "${canonical}"`);
    }
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
};

const resolveConflicts = (
  tags: string[],
  conflictMap: Record<string, string[]>,
  rationale: string[],
  label: string,
): string[] => {
  // Estratégia: percorre na ordem fornecida e remove quaisquer conflitos
  // posteriores. A primeira escolha do usuário ganha precedência.
  const kept: string[] = [];
  const banned = new Set<string>();
  for (const tag of tags) {
    if (banned.has(tag)) {
      rationale.push(`[${label}] "${tag}" removida — conflita com escolha anterior`);
      continue;
    }
    kept.push(tag);
    (conflictMap[tag] ?? []).forEach(b => banned.add(b));
  }
  return kept;
};

const fillIfEmpty = (
  current: string[],
  defaults: string[] | undefined,
  pool: readonly string[],
  rationale: string[],
  label: string,
  archetype: string,
): string[] => {
  if (current.length > 0 || !defaults || defaults.length === 0) return current;
  const valid = defaults.filter(d => pool.includes(d));
  if (valid.length === 0) return current;
  rationale.push(
    `[${label}] vazio → preenchido com [${valid.join(', ')}] a partir do arquétipo "${archetype}"`,
  );
  return valid;
};

/**
 * Harmoniza as tags: dedup, normaliza, resolve conflitos, preenche gaps
 * a partir dos arquétipos de branding. Não toca em escolhas explícitas.
 */
export function harmonizeTags(raw: RawTags): HarmonizedTags {
  const rationale: string[] = [];

  // 1. Normalização contra os pools.
  let branding = normalizeAgainstPool(raw.brandingTags, AVAILABLE_BRANDING_TAGS, rationale, 'branding');
  let locations = normalizeAgainstPool(raw.locationTags, AVAILABLE_LOCATION_TAGS, rationale, 'location');
  let angles = normalizeAgainstPool(raw.angleTags, AVAILABLE_ANGLE_TAGS, rationale, 'angle');
  let lighting = normalizeAgainstPool(raw.lightingTags, AVAILABLE_LIGHTING_TAGS, rationale, 'lighting');
  let effects = normalizeAgainstPool(raw.effectTags, AVAILABLE_EFFECT_TAGS, rationale, 'effect');
  let materials = normalizeAgainstPool(raw.materialTags, AVAILABLE_MATERIAL_TAGS, rationale, 'material');

  // 2. Resolve conflitos em lighting e effects.
  lighting = resolveConflicts(lighting, LIGHTING_CONFLICTS, rationale, 'lighting');
  effects = resolveConflicts(effects, EFFECT_CONFLICTS, rationale, 'effect');

  // 3. Gap fill por arquétipo — usa o primeiro branding tag que tem defaults.
  const matchedArchetype = branding.find(b => ARCHETYPE_DEFAULTS[b]);
  if (matchedArchetype) {
    const defaults = ARCHETYPE_DEFAULTS[matchedArchetype];
    locations = fillIfEmpty(locations, defaults.locations, AVAILABLE_LOCATION_TAGS, rationale, 'location', matchedArchetype);
    lighting  = fillIfEmpty(lighting,  defaults.lighting,  AVAILABLE_LIGHTING_TAGS, rationale, 'lighting', matchedArchetype);
    angles    = fillIfEmpty(angles,    defaults.angles,    AVAILABLE_ANGLE_TAGS,    rationale, 'angle',    matchedArchetype);
    effects   = fillIfEmpty(effects,   defaults.effects,   AVAILABLE_EFFECT_TAGS,   rationale, 'effect',   matchedArchetype);
    materials = fillIfEmpty(materials, defaults.materials, AVAILABLE_MATERIAL_TAGS, rationale, 'material', matchedArchetype);
  }

  return {
    brandingTags: branding,
    locationTags: locations,
    angleTags: angles,
    lightingTags: lighting,
    effectTags: effects,
    materialTags: materials,
    rationale,
  };
}

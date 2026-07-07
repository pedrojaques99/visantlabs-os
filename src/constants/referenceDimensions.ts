export const REFERENCE_DIMENSIONS = {
  niche: ['luxury', 'tech', 'food', 'fashion', 'beauty', 'sports'],
  aesthetic: ['minimalist', 'brutalist', 'organic', 'retro', 'editorial', 'swiss'],
  vibe: ['premium', 'playful', 'corporate', 'edgy', 'warm', 'serene'],
  lighting: ['soft studio', 'golden hour', 'neon', 'flat', 'dramatic', 'rim'],
  texture: ['marble', 'concrete', 'wood', 'fabric', 'glossy', 'matte'],
  material: ['vinyl', 'metal', 'glass', 'paper', 'cardboard', 'ceramic'],
  angle: ['top-down', 'isometric', 'hero', 'close-up', 'eye-level', '45-degree'],
  color_mood: ['warm', 'cold', 'monochrome', 'vibrant', 'pastel', 'earth-tones'],
  mockup_type: ['packaging', 'stationery', 'apparel', 'signage', 'device', 'bottle'],
  // Branding/logo refs — filled only when the image is a logo, identity, or brand system
  // (a flat product mockup leaves these empty; a logo leaves lighting/material/angle empty).
  brand_artifact: [
    'logo',
    'brand-system',
    'typography-spec',
    'color-palette',
    'iconography',
    'pattern',
    'editorial-layout',
    'stationery',
    'guideline',
  ],
  logo_construction: [
    'wordmark',
    'lettermark',
    'monogram',
    'pictorial-mark',
    'abstract-mark',
    'emblem',
    'combination-mark',
    'mascot',
  ],
  type_style: [
    'serif',
    'grotesque-sans',
    'geometric-sans',
    'humanist-sans',
    'display',
    'script',
    'mono',
    'custom-lettering',
  ],
} as const;

export type ReferenceDimensionKey = keyof typeof REFERENCE_DIMENSIONS;
export type ReferenceDimensionValue<K extends ReferenceDimensionKey> =
  (typeof REFERENCE_DIMENSIONS)[K][number];

// ─── Derived SSoT — shared by backend filters, facets, MCP, and the UI ───────

/** Every dimension key — used for filtering `dimensions.<key>` across all surfaces. */
export const REFERENCE_DIMENSION_KEYS = Object.keys(
  REFERENCE_DIMENSIONS
) as ReferenceDimensionKey[];

/**
 * Curated subset surfaced as facets / designer-facing filters.
 * Skips the photographic-only dims (lighting/texture/angle) that don't help browsing.
 */
export const FACET_DIMENSION_KEYS = [
  'brand_artifact',
  'logo_construction',
  'type_style',
  'aesthetic',
  'vibe',
  'color_mood',
  'niche',
  'mockup_type',
  'material',
] as const satisfies readonly ReferenceDimensionKey[];
export type FacetDimensionKey = (typeof FACET_DIMENSION_KEYS)[number];

/** Human labels (pt-BR) for the facet dimensions. */
export const DIMENSION_LABELS: Record<FacetDimensionKey, string> = {
  brand_artifact: 'Tipo de peça',
  logo_construction: 'Construção',
  type_style: 'Tipografia',
  aesthetic: 'Estética',
  vibe: 'Vibe',
  color_mood: 'Cor',
  niche: 'Nicho',
  mockup_type: 'Mockup',
  material: 'Material',
};

/** Which facet groups to surface for the current kind toggle (keeps the UI intuitive). */
export const DIMENSION_GROUPS_BY_KIND: Record<'all' | 'branding' | 'mockup', FacetDimensionKey[]> =
  {
    all: ['aesthetic', 'vibe', 'color_mood', 'type_style', 'brand_artifact', 'niche'],
    branding: ['brand_artifact', 'logo_construction', 'type_style', 'aesthetic', 'vibe', 'color_mood'],
    mockup: ['mockup_type', 'material', 'aesthetic', 'vibe', 'color_mood'],
  };

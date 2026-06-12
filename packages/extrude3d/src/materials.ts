export interface MaterialPresetDef {
  label: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  emissiveIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: string;
  transmission?: number;
  thickness?: number;
  ior?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  reflectivity?: number;
}

export const materialPresets: Record<string, MaterialPresetDef> = {
  default: { label: 'Default', metalness: 0.15, roughness: 0.35, opacity: 1, transparent: false },
  plastic: { label: 'Plastic', metalness: 0, roughness: 0.3, opacity: 1, transparent: false },
  metal: { label: 'Metal', metalness: 0.9, roughness: 0.2, opacity: 1, transparent: false },
  glass: { label: 'Glass', metalness: 0.1, roughness: 0.05, opacity: 0.35, transparent: true },
  rubber: { label: 'Rubber', metalness: 0, roughness: 0.9, opacity: 1, transparent: false },
  chrome: {
    label: 'Chrome',
    metalness: 1,
    roughness: 0.05,
    opacity: 1,
    transparent: false,
    reflectivity: 1,
  },
  gold: {
    label: 'Gold',
    metalness: 1,
    roughness: 0.1,
    opacity: 1,
    transparent: false,
    reflectivity: 1,
  },
  clay: { label: 'Clay', metalness: 0, roughness: 1, opacity: 1, transparent: false },
  emissive: {
    label: 'Emissive',
    metalness: 0,
    roughness: 0.5,
    opacity: 1,
    transparent: false,
    emissiveIntensity: 0.8,
  },
  holographic: {
    label: 'Holo',
    metalness: 0.8,
    roughness: 0.1,
    opacity: 0.7,
    transparent: true,
    clearcoat: 1,
  },
  brushedSteel: {
    label: 'Brushed Steel',
    metalness: 1,
    roughness: 0.35,
    opacity: 1,
    transparent: false,
    reflectivity: 1,
  },
  aluminum: {
    label: 'Aluminum',
    metalness: 0.9,
    roughness: 0.25,
    opacity: 1,
    transparent: false,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
    iridescence: 0.3,
    iridescenceIOR: 1.5,
  },
  copper: {
    label: 'Copper',
    metalness: 1,
    roughness: 0.15,
    opacity: 1,
    transparent: false,
    reflectivity: 1,
  },
  roseGold: {
    label: 'Rose Gold',
    metalness: 1,
    roughness: 0.12,
    opacity: 1,
    transparent: false,
    reflectivity: 1,
  },
  platinum: {
    label: 'Platinum',
    metalness: 1,
    roughness: 0.08,
    opacity: 1,
    transparent: false,
    reflectivity: 1,
  },
  ceramic: {
    label: 'Ceramic',
    metalness: 0,
    roughness: 0.1,
    opacity: 1,
    transparent: false,
    clearcoat: 0.8,
    clearcoatRoughness: 0.05,
    ior: 1.52,
    reflectivity: 0.5,
  },
  marble: {
    label: 'Marble',
    metalness: 0,
    roughness: 0.2,
    opacity: 1,
    transparent: false,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
    ior: 1.486,
    reflectivity: 0.5,
  },
  concrete: {
    label: 'Concrete',
    metalness: 0,
    roughness: 0.95,
    opacity: 1,
    transparent: false,
    reflectivity: 0.35,
  },
  wood: {
    label: 'Wood',
    metalness: 0,
    roughness: 0.35,
    opacity: 1,
    transparent: false,
    clearcoat: 0.5,
    clearcoatRoughness: 0.1,
    ior: 1.516,
    reflectivity: 0.5,
  },
  velvet: {
    label: 'Velvet',
    metalness: 0,
    roughness: 0.9,
    opacity: 1,
    transparent: false,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: '#ffffff',
    reflectivity: 0.35,
  },
  leather: {
    label: 'Leather',
    metalness: 0,
    roughness: 0.6,
    opacity: 1,
    transparent: false,
    sheen: 0.3,
    sheenRoughness: 0.8,
    sheenColor: '#332211',
    reflectivity: 0.4,
  },
  frostedGlass: {
    label: 'Frosted Glass',
    metalness: 0,
    roughness: 0.4,
    opacity: 0.6,
    transparent: true,
    transmission: 0.95,
    thickness: 1,
    ior: 1.5,
    reflectivity: 0.5,
  },
  diamond: {
    label: 'Diamond',
    metalness: 0,
    roughness: 0,
    opacity: 0.5,
    transparent: true,
    transmission: 0.95,
    thickness: 2,
    ior: 2.418,
    iridescence: 0.15,
    iridescenceIOR: 1.8,
    reflectivity: 1,
  },
  pearl: {
    label: 'Pearl',
    metalness: 0,
    roughness: 0.2,
    opacity: 1,
    transparent: false,
    clearcoat: 0.6,
    clearcoatRoughness: 0.05,
    sheen: 0.4,
    sheenRoughness: 0.3,
    sheenColor: '#ffeedd',
    iridescence: 1,
    iridescenceIOR: 1.34,
    ior: 1.53,
    reflectivity: 0.6,
  },
  carbonFiber: {
    label: 'Carbon Fiber',
    metalness: 0.1,
    roughness: 0.35,
    opacity: 1,
    transparent: false,
    clearcoat: 0.8,
    clearcoatRoughness: 0.05,
    reflectivity: 0.5,
  },
  carPaint: {
    label: 'Car Paint',
    metalness: 0,
    roughness: 0.4,
    opacity: 1,
    transparent: false,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    reflectivity: 0.5,
  },
  ice: {
    label: 'Ice',
    metalness: 0,
    roughness: 0.15,
    opacity: 0.7,
    transparent: true,
    transmission: 0.9,
    thickness: 1.5,
    ior: 1.31,
    reflectivity: 0.5,
  },
  obsidian: {
    label: 'Obsidian',
    metalness: 0,
    roughness: 0.05,
    opacity: 1,
    transparent: false,
    reflectivity: 0.5,
  },
  wax: {
    label: 'Wax',
    metalness: 0,
    roughness: 0.5,
    opacity: 0.95,
    transparent: false,
    transmission: 0.3,
    thickness: 2,
    ior: 1.445,
    reflectivity: 0.4,
  },
  mattePaint: {
    label: 'Matte Paint',
    metalness: 0,
    roughness: 0.9,
    opacity: 1,
    transparent: false,
    reflectivity: 0.5,
  },
  y2kGloss: {
    label: 'Y2K Gloss',
    metalness: 0.35,
    roughness: 0.08,
    opacity: 1,
    transparent: false,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    iridescence: 0.4,
    iridescenceIOR: 1.6,
    reflectivity: 0.85,
  },
  liquidChrome: {
    label: 'Liquid Chrome',
    metalness: 1,
    roughness: 0.02,
    opacity: 1,
    transparent: false,
    clearcoat: 0.6,
    clearcoatRoughness: 0.01,
    reflectivity: 1,
    iridescence: 0.15,
    iridescenceIOR: 1.8,
  },
  candyInflate: {
    label: 'Candy Inflate',
    metalness: 0,
    roughness: 0.15,
    opacity: 1,
    transparent: false,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    sheen: 0.3,
    sheenRoughness: 0.2,
    sheenColor: '#ffffff',
    reflectivity: 0.7,
    ior: 1.45,
  },
  soapBubble: {
    label: 'Soap Bubble',
    metalness: 0,
    roughness: 0.02,
    opacity: 0.15,
    transparent: true,
    transmission: 0.98,
    thickness: 0.1,
    ior: 1.33,
    iridescence: 1,
    iridescenceIOR: 1.3,
    clearcoat: 1,
    clearcoatRoughness: 0,
    reflectivity: 0.8,
  },
  opal: {
    label: 'Opal',
    metalness: 0,
    roughness: 0.12,
    opacity: 1,
    transparent: false,
    clearcoat: 0.8,
    clearcoatRoughness: 0.03,
    sheen: 0.6,
    sheenRoughness: 0.25,
    sheenColor: '#c4b5fd',
    iridescence: 1,
    iridescenceIOR: 1.45,
    ior: 1.45,
    reflectivity: 0.65,
  },
  neonTube: {
    label: 'Neon Tube',
    metalness: 0,
    roughness: 0.08,
    opacity: 0.85,
    transparent: true,
    emissiveIntensity: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    ior: 1.5,
    reflectivity: 0.6,
  },
  resin: {
    label: 'Resin',
    metalness: 0,
    roughness: 0.05,
    opacity: 1,
    transparent: false,
    transmission: 0.4,
    thickness: 3,
    ior: 1.52,
    clearcoat: 0.6,
    clearcoatRoughness: 0.04,
    reflectivity: 0.55,
  },
  titanium: {
    label: 'Titanium',
    metalness: 0.75,
    roughness: 0.22,
    opacity: 1,
    transparent: false,
    clearcoat: 0.2,
    clearcoatRoughness: 0.1,
    reflectivity: 0.7,
  },
};

// ── Single source for the material library ────────────────────────────────
// The PBR values above (`materialPresets`) are the physical source of truth.
// The UI layer (category grouping, ordering, swatch color, and the rare label
// override) lives here so the Studio3D store no longer re-declares a parallel
// material list. `MATERIAL_PRESETS` (consumed by the panels) is derived from
// this — see `studio3dStore.ts`. Keep `id` values in sync with `materialPresets`
// keys (the type system enforces it via `MaterialUiId`).

export type MaterialUiId = keyof typeof materialPresets;
export type MaterialCategory = 'basic' | 'metals' | 'surfaces' | 'glass' | 'special';

export interface MaterialUiEntry {
  id: MaterialUiId;
  category: MaterialCategory;
  /** Swatch / default color applied on selection. Optional. */
  color?: string;
  /** Display label override; defaults to `materialPresets[id].label`. */
  label?: string;
}

/**
 * Curated, ordered subset of materials surfaced in the Studio3D UI, grouped by
 * category. Ordering and grouping are intentional and load-bearing for the UI.
 */
export const MATERIAL_UI: MaterialUiEntry[] = [
  // Basic
  { id: 'default', category: 'basic' },
  { id: 'plastic', category: 'basic' },
  { id: 'clay', category: 'basic', color: '#e8ddd3' },
  { id: 'emissive', category: 'basic' },
  // Metals
  { id: 'chrome', category: 'metals', color: '#cccccc' },
  { id: 'brushedSteel', category: 'metals', color: '#c0c0c0' },
  { id: 'gold', category: 'metals', color: '#ffd891' },
  { id: 'roseGold', category: 'metals', color: '#e8a090' },
  { id: 'copper', category: 'metals', color: '#f7bc9e' },
  // Surfaces
  { id: 'marble', category: 'surfaces', color: '#e8e0d8' },
  { id: 'wood', category: 'surfaces', color: '#8b6a4a' },
  { id: 'leather', category: 'surfaces', color: '#6b4226' },
  { id: 'carbonFiber', category: 'surfaces', color: '#222222' },
  { id: 'carPaint', category: 'surfaces' },
  // Glass & Gem
  { id: 'glass', category: 'glass' },
  { id: 'frostedGlass', category: 'glass', label: 'Frosted' },
  { id: 'diamond', category: 'glass', color: '#ffffff' },
  // Special
  { id: 'pearl', category: 'special', color: '#fef0e0' },
  { id: 'obsidian', category: 'special', color: '#1a1a1a' },
  { id: 'holographic', category: 'special' },
  { id: 'y2kGloss', category: 'special', label: 'Y2K Gloss' },
  { id: 'liquidChrome', category: 'metals', color: '#e0e0e0' },
  { id: 'titanium', category: 'metals', color: '#8a8a8a' },
  { id: 'candyInflate', category: 'special', label: 'Candy' },
  { id: 'soapBubble', category: 'glass' },
  { id: 'opal', category: 'special', color: '#e8dff5' },
  { id: 'neonTube', category: 'special' },
  { id: 'resin', category: 'glass' },
];

export interface MaterialLibEntry extends MaterialUiEntry {
  label: string;
}

/**
 * Fully-resolved UI material list: every entry carries a concrete `label`
 * (override or the PBR-derived default). This is the single list the Studio3D
 * panels iterate over.
 */
export const MATERIAL_LIB: MaterialLibEntry[] = MATERIAL_UI.map((entry) => ({
  ...entry,
  label: entry.label ?? materialPresets[entry.id].label,
}));

export interface ResolvedMaterial {
  preset: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  wireframe: boolean;
  emissiveIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: string;
  transmission?: number;
  thickness?: number;
  ior?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  reflectivity?: number;
}

export interface MaterialOverrides {
  metalness?: number;
  roughness?: number;
  opacity?: number;
  emissiveIntensity?: number;
  wireframe?: boolean;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenRoughness?: number;
  sheenColor?: string;
  transmission?: number;
  thickness?: number;
  ior?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  reflectivity?: number;
}

export function resolveMaterial(preset: string, overrides: MaterialOverrides): ResolvedMaterial {
  const base = materialPresets[preset] ?? materialPresets.default;
  const opacity = overrides.opacity ?? base.opacity;
  return {
    preset,
    metalness: overrides.metalness ?? base.metalness,
    roughness: overrides.roughness ?? base.roughness,
    opacity,
    transparent: base.transparent || opacity < 1,
    wireframe: overrides.wireframe ?? false,
    emissiveIntensity: overrides.emissiveIntensity ?? base.emissiveIntensity,
    clearcoat: overrides.clearcoat ?? base.clearcoat,
    clearcoatRoughness: overrides.clearcoatRoughness ?? base.clearcoatRoughness,
    sheen: overrides.sheen ?? base.sheen,
    sheenRoughness: overrides.sheenRoughness ?? base.sheenRoughness,
    sheenColor: overrides.sheenColor ?? base.sheenColor,
    transmission: overrides.transmission ?? base.transmission,
    thickness: overrides.thickness ?? base.thickness,
    ior: overrides.ior ?? base.ior,
    iridescence: overrides.iridescence ?? base.iridescence,
    iridescenceIOR: overrides.iridescenceIOR ?? base.iridescenceIOR,
    reflectivity: overrides.reflectivity ?? base.reflectivity,
  };
}

/**
 * Flat prop bag for a `<meshPhysicalMaterial>` rendered from a preset + color,
 * with no texture maps, shaders, blend modes, or shape-specific tweaks. This is
 * the "light" material path used by simple consumers (e.g. the Playground 3D
 * scene) that want preset-driven PBR without the full `ExtrudedSVG` pipeline
 * (which is store-coupled and carries texture/fresnel/blend logic).
 *
 * Single source of truth for the preset→material-prop mapping so consumers stop
 * re-deriving it inline. Pure: depends only on `materialPresets` data.
 */
export interface SimpleMaterialProps {
  color: string;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
  emissiveIntensity: number;
  emissive: string;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
  transmission: number;
  ior: number;
  iridescence: number;
}

export function getSimpleMaterialProps(preset: string, color: string): SimpleMaterialProps {
  const base = materialPresets[preset] ?? materialPresets.default;
  const emissiveIntensity = base.emissiveIntensity || 0;
  return {
    color,
    metalness: base.metalness,
    roughness: base.roughness,
    opacity: base.opacity,
    transparent: base.transparent,
    emissiveIntensity,
    emissive: emissiveIntensity ? color : '#000000',
    clearcoat: base.clearcoat || 0,
    clearcoatRoughness: base.clearcoatRoughness || 0,
    sheen: base.sheen || 0,
    sheenRoughness: base.sheenRoughness || 0,
    transmission: base.transmission || 0,
    ior: base.ior || 1.5,
    iridescence: base.iridescence || 0,
  };
}

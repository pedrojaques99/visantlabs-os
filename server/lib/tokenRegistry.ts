// server/lib/tokenRegistry.ts

import type { BrandGuideline } from '../../src/lib/figma-types.js';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ResolvedToken {
  name: string;
  value: any;
  rgb?: RGB;
  usage?: string;
  source: 'mongodb' | 'figma-json';
}

export interface TokenRegistry {
  colors: Map<string, ResolvedToken>;
  typography: Map<string, ResolvedToken>;
  spacing: Map<string, ResolvedToken>;
  radius: Map<string, ResolvedToken>;
  shadows: Map<string, ResolvedToken>;
  components: Map<string, ResolvedToken>;
}

/**
 * Convert hex color to normalized RGB (0-1 range for Figma)
 */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

/**
 * Convert normalized RGB to hex
 */
export function rgbToHex(rgb: RGB): string {
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Create empty registry
 */
export function createEmptyRegistry(): TokenRegistry {
  return {
    colors: new Map(),
    typography: new Map(),
    spacing: new Map(),
    radius: new Map(),
    shadows: new Map(),
    components: new Map(),
  };
}

/**
 * Build registry from BrandGuideline (MongoDB source)
 */
export function buildFromBrandGuideline(bg: BrandGuideline): TokenRegistry {
  const registry = createEmptyRegistry();

  // Colors with pre-calculated RGB
  if (bg.colors?.length) {
    for (const c of bg.colors) {
      registry.colors.set(c.name, {
        name: c.name,
        value: c.hex,
        rgb: hexToRgb(c.hex),
        usage: c.role,
        source: 'mongodb',
      });
    }
  }

  // Typography
  if (bg.typography?.length) {
    for (const t of bg.typography) {
      registry.typography.set(t.role, {
        name: t.role,
        value: { family: t.family, style: t.style, size: t.size, lineHeight: t.lineHeight },
        source: 'mongodb',
      });
    }
  }

  // Spacing
  if (bg.tokens?.spacing) {
    for (const [name, value] of Object.entries(bg.tokens.spacing)) {
      registry.spacing.set(name, { name, value, source: 'mongodb' });
    }
  }

  // Radius
  if (bg.tokens?.radius) {
    for (const [name, value] of Object.entries(bg.tokens.radius)) {
      registry.radius.set(name, { name, value, source: 'mongodb' });
    }
  }

  // Shadows
  if (bg.tokens?.shadows) {
    for (const [name, value] of Object.entries(bg.tokens.shadows)) {
      registry.shadows.set(name, { name, value, source: 'mongodb' });
    }
  }

  // Components
  if (bg.tokens?.components) {
    for (const [name, value] of Object.entries(bg.tokens.components)) {
      registry.components.set(name, { name, value, source: 'mongodb' });
    }
  }

  return registry;
}

// Type for Figma Design System JSON (matches DESIGN_SYSTEM_JSON_SPEC.md)
export interface DesignSystemJSON {
  name?: string;
  version?: string;
  colors?: Record<string, string | { hex?: string; value?: string; usage?: string }>;
  typography?: Record<string, { family: string; style?: string; size?: number; lineHeight?: number }>;
  spacing?: Record<string, number>;
  radius?: Record<string, number>;
  shadows?: Record<string, { x?: number; y?: number; blur?: number; spread?: number; color?: string; opacity?: number }>;
  components?: Record<string, any>;
  guidelines?: { voice?: string; dos?: string[]; donts?: string[]; imagery?: string };
}

/**
 * Build registry from Design System JSON (Figma local source)
 */
export function buildFromDesignSystem(ds: DesignSystemJSON): TokenRegistry {
  const registry = createEmptyRegistry();

  // Colors
  if (ds.colors) {
    for (const [name, val] of Object.entries(ds.colors)) {
      const hex = typeof val === 'string' ? val : (val.hex || val.value || '');
      if (!hex) continue; // Skip if no valid hex
      const usage = typeof val === 'object' ? val.usage : undefined;
      registry.colors.set(name, {
        name,
        value: hex,
        rgb: hexToRgb(hex),
        usage,
        source: 'figma-json',
      });
    }
  }

  // Typography
  if (ds.typography) {
    for (const [name, t] of Object.entries(ds.typography)) {
      registry.typography.set(name, {
        name,
        value: t,
        source: 'figma-json',
      });
    }
  }

  // Spacing
  if (ds.spacing) {
    for (const [name, value] of Object.entries(ds.spacing)) {
      registry.spacing.set(name, { name, value, source: 'figma-json' });
    }
  }

  // Radius
  if (ds.radius) {
    for (const [name, value] of Object.entries(ds.radius)) {
      registry.radius.set(name, { name, value, source: 'figma-json' });
    }
  }

  // Shadows
  if (ds.shadows) {
    for (const [name, value] of Object.entries(ds.shadows)) {
      registry.shadows.set(name, { name, value, source: 'figma-json' });
    }
  }

  // Components
  if (ds.components) {
    for (const [name, value] of Object.entries(ds.components)) {
      registry.components.set(name, { name, value, source: 'figma-json' });
    }
  }

  return registry;
}

/**
 * Merge two registries (first has priority)
 */
export function mergeRegistries(primary: TokenRegistry, secondary: TokenRegistry): TokenRegistry {
  const merged = createEmptyRegistry();

  // Helper to merge maps (primary wins on conflict)
  const mergeMaps = <T>(p: Map<string, T>, s: Map<string, T>): Map<string, T> => {
    const result = new Map(s);
    for (const [k, v] of p) {
      result.set(k, v); // primary overwrites
    }
    return result;
  };

  merged.colors = mergeMaps(primary.colors, secondary.colors);
  merged.typography = mergeMaps(primary.typography, secondary.typography);
  merged.spacing = mergeMaps(primary.spacing, secondary.spacing);
  merged.radius = mergeMaps(primary.radius, secondary.radius);
  merged.shadows = mergeMaps(primary.shadows, secondary.shadows);
  merged.components = mergeMaps(primary.components, secondary.components);

  return merged;
}

/**
 * Build unified registry from available sources
 * Priority: BrandGuideline (MongoDB) > DesignSystemJSON (Figma local)
 */
export function buildTokenRegistry(
  brandGuideline?: BrandGuideline | null,
  designSystem?: DesignSystemJSON | null
): TokenRegistry {
  const mongoRegistry = brandGuideline ? buildFromBrandGuideline(brandGuideline) : null;
  const figmaRegistry = designSystem ? buildFromDesignSystem(designSystem) : null;

  if (mongoRegistry && figmaRegistry) {
    return mergeRegistries(mongoRegistry, figmaRegistry);
  }
  if (mongoRegistry) return mongoRegistry;
  if (figmaRegistry) return figmaRegistry;

  return createEmptyRegistry();
}

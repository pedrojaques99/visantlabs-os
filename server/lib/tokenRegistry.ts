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

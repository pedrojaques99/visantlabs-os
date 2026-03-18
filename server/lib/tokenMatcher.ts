// server/lib/tokenMatcher.ts

import type { RGB, ResolvedToken } from './tokenRegistry.js';

/**
 * Convert RGB (0-1) to LAB color space for perceptual distance calculation
 */
function rgbToLab(rgb: RGB): { L: number; a: number; b: number } {
  // RGB to XYZ
  let r = rgb.r, g = rgb.g, b = rgb.b;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  // XYZ to LAB
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  return {
    L: (116 * fy) - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Calculate Delta-E CIE76 distance between two colors
 * Lower = more similar (0 = identical)
 */
export function colorDistance(c1: RGB, c2: RGB): number {
  const lab1 = rgbToLab(c1);
  const lab2 = rgbToLab(c2);
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * Find closest color in palette
 */
export function findClosestColor(
  rgb: RGB,
  palette: Map<string, ResolvedToken>
): { token: string; rgb: RGB; distance: number } | null {
  if (palette.size === 0) return null;

  let closest: { token: string; rgb: RGB; distance: number } | null = null;

  for (const [name, token] of palette) {
    if (!token.rgb) continue;
    const dist = colorDistance(rgb, token.rgb);
    if (!closest || dist < closest.distance) {
      closest = { token: name, rgb: token.rgb, distance: dist };
    }
  }

  return closest;
}

/**
 * Find closest number value in token set
 */
export function findClosestNumber(
  value: number,
  tokens: Map<string, ResolvedToken>
): { token: string; value: number } | null {
  if (tokens.size === 0) return null;

  let closest: { token: string; value: number; diff: number } | null = null;

  for (const [name, token] of tokens) {
    const tokenVal = typeof token.value === 'number' ? token.value : parseFloat(token.value);
    if (isNaN(tokenVal)) continue;

    const diff = Math.abs(value - tokenVal);
    if (!closest || diff < closest.diff) {
      closest = { token: name, value: tokenVal, diff };
    }
  }

  return closest ? { token: closest.token, value: closest.value } : null;
}

/**
 * Check if RGB matches any color in palette (with tolerance)
 */
export function colorInPalette(rgb: RGB, palette: Map<string, ResolvedToken>, tolerance = 0.01): string | null {
  for (const [name, token] of palette) {
    if (!token.rgb) continue;
    if (
      Math.abs(rgb.r - token.rgb.r) < tolerance &&
      Math.abs(rgb.g - token.rgb.g) < tolerance &&
      Math.abs(rgb.b - token.rgb.b) < tolerance
    ) {
      return name;
    }
  }
  return null;
}

/**
 * Check if number matches any token value
 */
export function numberInTokens(value: number, tokens: Map<string, ResolvedToken>): string | null {
  for (const [name, token] of tokens) {
    if (token.value === value) return name;
  }
  return null;
}

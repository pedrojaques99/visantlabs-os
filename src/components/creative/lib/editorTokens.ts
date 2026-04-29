/**
 * Single source of truth for editor design tokens + thresholds. Anything that
 * was previously a hardcoded number/color in a component lives here.
 */

// ── Selection / interaction thresholds (logical px) ──────────────────────
export const MARQUEE_MIN_DRAG = 3;        // distance before mousedown becomes a marquee drag
export const HUD_GAP_PX = 36;             // selection HUD gap above bbox
export const MIN_LAYER_SIZE_NORMALIZED = 0.005; // minimum w/h % a layer can be shrunk to
export const PASTE_OFFSET_NORMALIZED = 0.02;    // x/y bump applied to pasted layers

// ── Filter slider extents (Konva.Filters semantics) ──────────────────────
export const FILTER_RANGES = {
  brightness: { min: -1, max: 1, step: 0.05 },
  contrast: { min: -100, max: 100, step: 1 },
  blur: { min: 0, max: 40, step: 1 },
} as const;

// ── Brand colors used by Konva primitives (must be raw values, not Tailwind) ─
export const BRAND_CYAN = '#00e5ff';
export const BRAND_CYAN_RGBA = (alpha: number) => `rgba(0,229,255,${alpha})`;

// Konva node colors
export const TRANSFORMER_STROKE = BRAND_CYAN_RGBA(0.8);
export const TRANSFORMER_ANCHOR_FILL = '#0a0a0a';
export const MARQUEE_FILL = BRAND_CYAN_RGBA(0.08);
export const MARQUEE_STROKE = BRAND_CYAN_RGBA(0.8);
export const GRID_LINE_COLOR = 'rgba(255,255,255,0.06)';
export const GUIDE_COLOR = '#ff00ff';

// ── Viewport / camera ────────────────────────────────────────────────────
export const VIEWPORT = {
  scaleStep: 1.1,
  minScale: 0.1,
  maxScale: 8,
} as const;

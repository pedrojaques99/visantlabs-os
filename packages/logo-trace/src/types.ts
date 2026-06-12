// @visant/logo-trace — public types.

export type TracePreset = 'logo' | 'lettering' | 'lineArt' | 'stamp' | 'custom';

export interface TraceOptions {
  /** Suppress speckles smaller than N px². Higher = cleaner, loses detail. */
  turdSize?: number;
  /** Curve optimization tolerance. Higher = fewer, smoother curves. */
  optTolerance?: number;
  /** Black/white cutoff 0–255, or 'auto' for Otsu (+ auto-invert). */
  threshold?: number | 'auto';
  /** Corner threshold 0–1.334. Higher = rounder corners. */
  alphaMax?: number;
  /** Fill color of the traced paths. Default '#000000'. */
  color?: string;
  /** Named preset; merged under any explicit option above. */
  preset?: TracePreset;
}

export interface SvgOptimizeOptions {
  removeComments?: boolean;
  removeMetadata?: boolean;
  removeEditorData?: boolean;
  removeEmptyGroups?: boolean;
  minifyPaths?: boolean;
  removeHiddenElements?: boolean;
}

// @visant/logo-trace — public surface.
// Raster → SVG vectorization tuned for logos: potrace + Otsu auto-threshold
// (with auto-invert for light-on-light art) + calibrated presets + a
// sanitize/optimize pass that returns a clean, minified SVG string.

// ── Core ──
export { trace, tracePipeline, traceImage, cleanSvgPipeline } from './trace.js';

// ── Presets ──
export { TRACE_PRESETS, resolveTraceOptions } from './presets.js';

// ── SVG sanitize / optimize / data-URI parsing ──
export { parseBase64Image, sanitizeSvg, optimizeSvg, cleanSvg } from './sanitize.js';

// ── Types ──
export type { TracePreset, TraceOptions, SvgOptimizeOptions } from './types.js';

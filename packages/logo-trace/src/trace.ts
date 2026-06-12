// @visant/logo-trace — raster → SVG core.
//
// Pipeline: Otsu auto-threshold (+ auto-invert for light-on-light art) →
// potrace vectorization (with an invert-retry fallback) → sanitize → optimize.
//
// `sharp` is an optional peer used only for the grayscale histogram / invert;
// without it, 'auto' threshold gracefully degrades to a fixed 128.

import { resolveTraceOptions } from './presets.js';
import { sanitizeSvg, optimizeSvg } from './sanitize.js';
import type { TraceOptions } from './types.js';

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ── Otsu auto-threshold ──────────────────────────────────────────────────────

function computeOtsuFromGrayscale(pixels: Buffer | Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  let totalPixels = 0;

  for (let i = 0; i < pixels.length; i++) {
    histogram[pixels[i]]++;
    totalPixels++;
  }

  if (totalPixels === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVariance = 0;
  let bestThreshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = totalPixels - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) * (meanB - meanF);

    if (variance > maxVariance) {
      maxVariance = variance;
      bestThreshold = t;
    }
  }

  return bestThreshold;
}

async function loadSharp(): Promise<any> {
  return (await import('sharp')).default;
}

async function computeOtsuFromImage(
  buffer: Buffer
): Promise<{ threshold: number; needsInvert: boolean }> {
  try {
    const sharp = await loadSharp();
    const grayscale = await sharp(buffer).grayscale().raw().toBuffer();
    const threshold = computeOtsuFromGrayscale(grayscale);

    // If threshold > 230, the image is light-on-light (e.g. gray logo on white).
    // A designer would invert it first — we do the same automatically.
    return { threshold, needsInvert: threshold > 230 };
  } catch {
    return { threshold: 128, needsInvert: false };
  }
}

async function invertImage(buffer: Buffer): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(buffer).negate({ alpha: false }).toBuffer();
}

function svgHasContent(svg: string): boolean {
  const match = svg.match(/\bd="([^"]*)"/);
  return !!match && match[1].trim().length > 5;
}

// ── Potrace ──────────────────────────────────────────────────────────────────

async function potraceTrace(buffer: Buffer, potraceOpts: Record<string, any>): Promise<string> {
  const potrace = await import('potrace');
  return new Promise((resolve, reject) => {
    potrace.trace(buffer, potraceOpts, (err: Error | null, svg: string) => {
      if (err) reject(err);
      else resolve(svg);
    });
  });
}

/**
 * Vectorize a raster image buffer to an SVG string. Honors a named `preset`
 * and/or explicit options. Does NOT sanitize/optimize — call `tracePipeline`
 * for the full cleaned result.
 */
export async function traceImage(buffer: Buffer, opts: TraceOptions = {}): Promise<string> {
  const resolved = resolveTraceOptions(opts);

  let threshold: number;
  let imageBuffer = buffer;

  if (resolved.threshold === 'auto') {
    const otsu = await computeOtsuFromImage(buffer);
    if (otsu.needsInvert) {
      // Light-on-light image (like gray logo on white bg) — invert first
      imageBuffer = await invertImage(buffer);
      // After inversion, re-compute Otsu on the inverted image
      const otsu2 = await computeOtsuFromImage(imageBuffer);
      threshold = otsu2.threshold;
    } else {
      threshold = otsu.threshold;
    }
  } else {
    threshold = clamp(Number(resolved.threshold) || 128, 0, 255, 128);
  }

  const potraceOpts = {
    turdSize: clamp(resolved.turdSize!, 0, 20, 2),
    alphaMax: clamp(resolved.alphaMax!, 0, 1.334, 1),
    optCurve: true,
    optTolerance: clamp(resolved.optTolerance!, 0, 2, 0.2),
    color: resolved.color || '#000000',
    threshold,
  };

  const svg = await potraceTrace(imageBuffer, potraceOpts);

  // Fallback: if trace produced empty paths and we didn't already invert, try inverting
  if (!svgHasContent(svg) && imageBuffer === buffer) {
    try {
      const inverted = await invertImage(buffer);
      const otsu = await computeOtsuFromImage(inverted);
      const retrySvg = await potraceTrace(inverted, { ...potraceOpts, threshold: otsu.threshold });
      if (svgHasContent(retrySvg)) return retrySvg;
    } catch {
      /* fall through to original empty result */
    }
  }

  return svg;
}

/**
 * Full pipeline: trace → sanitize → optimize → clean SVG string.
 * The primary entry point for raster → SVG logo vectorization.
 */
export async function tracePipeline(buffer: Buffer, opts: TraceOptions = {}): Promise<string> {
  const raw = await traceImage(buffer, opts);
  const sanitized = await sanitizeSvg(raw);
  return optimizeSvg(sanitized);
}

/** Alias for `tracePipeline` — the package's headline `trace(buffer, preset|opts)`. */
export const trace = tracePipeline;

/** sanitize → optimize a raw SVG string (no tracing). */
export async function cleanSvgPipeline(raw: string): Promise<string> {
  const sanitized = await sanitizeSvg(raw);
  return optimizeSvg(sanitized);
}

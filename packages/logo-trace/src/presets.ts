// @visant/logo-trace — calibrated trace presets (single source of truth).

import type { TracePreset, TraceOptions } from './types.js';

/**
 * Calibrated potrace parameter sets per use-case. Values are tuned for clean
 * logo/lettering vectorization and must not drift — they are the same numbers
 * the Visant trace endpoint has shipped.
 */
export const TRACE_PRESETS: Record<
  Exclude<TracePreset, 'custom'>,
  Required<Omit<TraceOptions, 'color' | 'preset'>>
> = {
  logo: { turdSize: 3, optTolerance: 0.3, threshold: 'auto', alphaMax: 0.8 },
  lettering: { turdSize: 1, optTolerance: 0.15, threshold: 'auto', alphaMax: 0.5 },
  lineArt: { turdSize: 0, optTolerance: 0.1, threshold: 128, alphaMax: 1.0 },
  stamp: { turdSize: 5, optTolerance: 0.5, threshold: 'auto', alphaMax: 0.8 },
};

/**
 * Resolve a preset into concrete options. Explicit options always win over the
 * preset's base values. Non-preset (or 'custom') input is returned untouched.
 */
export function resolveTraceOptions(opts: TraceOptions): TraceOptions {
  if (opts.preset && opts.preset !== 'custom' && TRACE_PRESETS[opts.preset]) {
    const base = TRACE_PRESETS[opts.preset];
    return {
      turdSize: opts.turdSize ?? base.turdSize,
      optTolerance: opts.optTolerance ?? base.optTolerance,
      threshold: opts.threshold ?? base.threshold,
      alphaMax: opts.alphaMax ?? base.alphaMax,
      color: opts.color,
      preset: opts.preset,
    };
  }
  return opts;
}

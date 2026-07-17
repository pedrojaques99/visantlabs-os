/**
 * Creative control components — the "pro" tool controls (curves, channel mixer,
 * gradient, XY pad, anchor grid, dual-range) built on the Visant design system.
 *
 * Interaction/geometry for several of these is adapted from Pixel Point's
 * Toolcraft (MIT License, Copyright (c) 2026 Pixel Point):
 * https://github.com/pixel-point/toolcraft
 * Rewritten against Visant's tokens/primitives — no runtime deps were vendored.
 *
 * The color picker (ExpandableColorPicker) remains the single source of truth in
 * `@/components/shared/ToolPanel` and is intentionally not re-homed here.
 */

export { CurvesEditor } from './CurvesEditor';
export type { CurvesEditorProps } from './CurvesEditor';

export { ChannelMixer, IDENTITY_CHANNELS } from './ChannelMixer';
export type { ChannelMixerProps, MixerChannel, ChannelCurves } from './ChannelMixer';

export { RangeSlider } from './RangeSlider';
export type { RangeSliderProps } from './RangeSlider';

export { VectorPad } from './VectorPad';
export type { VectorPadProps, Vector2 } from './VectorPad';

export { AnchorGrid, ANCHOR_ORIGIN } from './AnchorGrid';
export type { AnchorGridProps, Anchor } from './AnchorGrid';

export { GradientEditor, DEFAULT_GRADIENT } from './GradientEditor';
export type { GradientEditorProps, GradientValue } from './GradientEditor';

// Geometry / utils for image pipelines and headless use.
export {
  type CurvePoint,
  type CurveInterpolation,
  IDENTITY_CURVE,
  getYAtX,
  sampleCurve,
  buildLut,
  normalizePoints,
} from './curve-geometry';

export {
  type GradientStop,
  type GradientType,
  getGradientCss,
  sortStops,
  reverseStops,
} from './gradient-utils';

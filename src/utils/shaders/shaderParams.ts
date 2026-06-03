/**
 * Shader Parameters — Single Source of Truth
 *
 * Central definition of all shader types and their editable parameters.
 * Used by ShaderControls (UI), ShaderNode (canvas), and any app that needs shader controls.
 */

import type { ShaderType, HalftoneVariant } from './shaderRegistry';
import type { ShaderSettings } from './shaderRenderer';

// --- Parameter definition types ---

export interface ShaderParamSlider {
  kind: 'slider';
  key: keyof ShaderSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  formatValue?: (v: number) => string;
}

export interface ShaderParamSelect {
  kind: 'select';
  key: keyof ShaderSettings;
  label: string;
  options: { value: number; label: string }[];
  defaultValue: number;
}

export interface ShaderParamToggle {
  kind: 'toggle';
  key: keyof ShaderSettings;
  label: string;
  defaultValue: number; // 0 or 1
}

export interface ShaderParamColor {
  kind: 'color';
  key: keyof ShaderSettings;
  label: string;
  defaultValue: [number, number, number];
}

export type ShaderParam =
  | ShaderParamSlider
  | ShaderParamSelect
  | ShaderParamToggle
  | ShaderParamColor;

export interface ShaderTypeDefinition {
  id: ShaderType;
  label: string;
  params: ShaderParam[];
  variants?: {
    key: string;
    label: string;
    options: { value: string; label: string }[];
    defaultValue: string;
  };
}

// --- Format helpers ---

const fmtDeg = (v: number) => `${Math.round(v)}°`;
const fmtPx = (v: number) => `${v.toFixed(0)}px`;
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
const fmt1 = (v: number) => v.toFixed(1);
const fmt2 = (v: number) => v.toFixed(2);
const fmt0 = (v: number) => v.toFixed(0);
const fmtMatrix = (v: number) => `${v.toFixed(0)}x${v.toFixed(0)}`;

const PALETTE_NAMES = ['Monochrome', 'Gameboy', 'CRT Amber', 'CRT Green', 'Sepia', 'Custom'];
const fmtPalette = (v: number) => PALETTE_NAMES[Math.floor(v)] || 'Monochrome';

// --- Shader definitions ---

export const SHADER_DEFINITIONS: ShaderTypeDefinition[] = [
  {
    id: 'halftone',
    label: 'Halftone',
    variants: {
      key: 'halftoneVariant',
      label: 'Style',
      options: [
        { value: 'ellipse', label: 'Ellipse' },
        { value: 'square', label: 'Square' },
        { value: 'lines', label: 'Lines' },
      ],
      defaultValue: 'ellipse',
    },
    params: [
      {
        kind: 'slider',
        key: 'dotSize',
        label: 'Dot Size',
        min: 0.1,
        max: 20,
        step: 0.1,
        defaultValue: 5.0,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'angle',
        label: 'Angle',
        min: 0,
        max: 360,
        step: 1,
        defaultValue: 0,
        formatValue: fmtDeg,
      },
      {
        kind: 'slider',
        key: 'contrast',
        label: 'Contrast',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'spacing',
        label: 'Spacing',
        min: 0.5,
        max: 5,
        step: 0.1,
        defaultValue: 2.0,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'halftoneThreshold',
        label: 'Threshold',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      { kind: 'toggle', key: 'halftoneInvert', label: 'Invert', defaultValue: 0 },
    ],
  },
  {
    id: 'vhs',
    label: 'VHS',
    params: [
      {
        kind: 'slider',
        key: 'tapeWaveIntensity',
        label: 'Tape Wave',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'tapeCreaseIntensity',
        label: 'Tape Crease',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'switchingNoiseIntensity',
        label: 'Switching Noise',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'bloomIntensity',
        label: 'Bloom',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'acBeatIntensity',
        label: 'AC Beat',
        min: 0,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
    ],
  },
  {
    id: 'ascii',
    label: 'ASCII',
    params: [
      {
        kind: 'slider',
        key: 'asciiCharSize',
        label: 'Char Size',
        min: 2,
        max: 32,
        step: 1,
        defaultValue: 8,
        formatValue: fmtPx,
      },
      {
        kind: 'slider',
        key: 'asciiContrast',
        label: 'Contrast',
        min: 0.1,
        max: 3,
        step: 0.1,
        defaultValue: 1.0,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'asciiBrightness',
        label: 'Brightness',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        defaultValue: 0,
        formatValue: fmt2,
      },
      {
        kind: 'select',
        key: 'asciiCharSet',
        label: 'Char Set',
        defaultValue: 3,
        options: [
          { value: 0, label: 'Blocks' },
          { value: 1, label: 'Dots' },
          { value: 2, label: 'Lines' },
          { value: 3, label: 'Classic' },
          { value: 4, label: 'Matrix' },
          { value: 5, label: 'Braille' },
        ],
      },
      { kind: 'toggle', key: 'asciiColored', label: 'Colored', defaultValue: 0 },
      { kind: 'toggle', key: 'asciiInvert', label: 'Invert', defaultValue: 0 },
    ],
  },
  {
    id: 'matrixDither',
    label: 'Matrix Dither',
    params: [
      {
        kind: 'slider',
        key: 'matrixSize',
        label: 'Matrix Size',
        min: 2,
        max: 8,
        step: 1,
        defaultValue: 4,
        formatValue: fmtMatrix,
      },
      {
        kind: 'slider',
        key: 'bias',
        label: 'Bias',
        min: -1,
        max: 1,
        step: 0.01,
        defaultValue: 0,
        formatValue: fmt2,
      },
    ],
  },
  {
    id: 'dither',
    label: 'Dither',
    params: [
      {
        kind: 'slider',
        key: 'ditherSize',
        label: 'Size',
        min: 1,
        max: 16,
        step: 1,
        defaultValue: 4,
        formatValue: fmt0,
      },
      {
        kind: 'slider',
        key: 'ditherContrast',
        label: 'Contrast',
        min: 0.1,
        max: 3,
        step: 0.1,
        defaultValue: 1.5,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'ditherOffset',
        label: 'Offset',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        defaultValue: 0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'ditherBitDepth',
        label: 'Bit Depth',
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 4,
        formatValue: fmt0,
      },
      {
        kind: 'select',
        key: 'ditherPalette',
        label: 'Palette',
        defaultValue: 0,
        options: [
          { value: 0, label: 'Monochrome' },
          { value: 1, label: 'Gameboy' },
          { value: 2, label: 'CRT Amber' },
          { value: 3, label: 'CRT Green' },
          { value: 4, label: 'Sepia' },
          { value: 5, label: 'Custom' },
        ],
      },
      {
        kind: 'color',
        key: 'ditherCustomColor',
        label: 'Custom Color',
        defaultValue: [0.0, 0.8, 1.0],
      },
    ],
  },
  {
    id: 'filmGrain',
    label: 'Film Grain',
    params: [
      {
        kind: 'slider',
        key: 'filmGrainStrength',
        label: 'Strength',
        min: 0,
        max: 40,
        step: 0.5,
        defaultValue: 16,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'filmGrainSize',
        label: 'Grain Size',
        min: 0.5,
        max: 4,
        step: 0.1,
        defaultValue: 1.0,
        formatValue: fmt1,
      },
      { kind: 'toggle', key: 'filmGrainColored', label: 'Colored', defaultValue: 0 },
    ],
  },
  {
    id: 'duotone',
    label: 'Duotone',
    params: [
      { kind: 'color', key: 'duotoneShadowColor', label: 'Shadow', defaultValue: [0.1, 0.0, 0.2] },
      {
        kind: 'color',
        key: 'duotoneHighlightColor',
        label: 'Highlight',
        defaultValue: [0.3, 0.9, 0.9],
      },
      {
        kind: 'slider',
        key: 'duotoneIntensity',
        label: 'Intensity',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmtPct,
      },
      {
        kind: 'slider',
        key: 'duotoneContrast',
        label: 'Contrast',
        min: 0.5,
        max: 2,
        step: 0.01,
        defaultValue: 1.0,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'duotoneBrightness',
        label: 'Brightness',
        min: -0.5,
        max: 0.5,
        step: 0.01,
        defaultValue: 0,
        formatValue: fmt2,
      },
    ],
  },
  {
    id: 'pixelate',
    label: 'Pixelate',
    params: [
      {
        kind: 'slider',
        key: 'pixelateSize',
        label: 'Pixel Size',
        min: 2,
        max: 64,
        step: 1,
        defaultValue: 8,
        formatValue: fmtPx,
      },
    ],
  },
  {
    id: 'posterize',
    label: 'Posterize',
    params: [
      {
        kind: 'slider',
        key: 'posterizeLevels',
        label: 'Color Levels',
        min: 2,
        max: 16,
        step: 1,
        defaultValue: 4,
        formatValue: fmt0,
      },
    ],
  },
  {
    id: 'chromaticAberration',
    label: 'Chromatic',
    params: [
      {
        kind: 'slider',
        key: 'chromaticOffset',
        label: 'Offset',
        min: 0.001,
        max: 0.05,
        step: 0.001,
        defaultValue: 0.005,
        formatValue: (v: number) => `${(v * 1000).toFixed(0)}‰`,
      },
      {
        kind: 'slider',
        key: 'chromaticAngle',
        label: 'Angle',
        min: 0,
        max: 360,
        step: 1,
        defaultValue: 0,
        formatValue: fmtDeg,
      },
    ],
  },
  {
    id: 'crtScanlines',
    label: 'CRT',
    params: [
      {
        kind: 'slider',
        key: 'crtLineWidth',
        label: 'Line Width',
        min: 1,
        max: 4,
        step: 0.1,
        defaultValue: 2,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'crtIntensity',
        label: 'Intensity',
        min: 0.05,
        max: 0.8,
        step: 0.01,
        defaultValue: 0.3,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'crtVignette',
        label: 'Vignette',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0.3,
        formatValue: fmtPct,
      },
      {
        kind: 'slider',
        key: 'crtCurvature',
        label: 'Curvature',
        min: 0,
        max: 1,
        step: 0.01,
        defaultValue: 0,
        formatValue: fmtPct,
      },
    ],
  },
  {
    id: 'edgeDetect',
    label: 'Edge Detect',
    params: [
      {
        kind: 'slider',
        key: 'edgeThreshold',
        label: 'Threshold',
        min: 0.01,
        max: 0.5,
        step: 0.01,
        defaultValue: 0.1,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'edgeStrength',
        label: 'Strength',
        min: 0.5,
        max: 5,
        step: 0.1,
        defaultValue: 2,
        formatValue: fmt1,
      },
      { kind: 'toggle', key: 'edgeOverlay', label: 'Overlay Mode', defaultValue: 0 },
    ],
  },
  {
    id: 'glitch',
    label: 'Glitch',
    params: [
      {
        kind: 'slider',
        key: 'glitchAmount',
        label: 'Amount',
        min: 0.005,
        max: 0.15,
        step: 0.005,
        defaultValue: 0.03,
        formatValue: fmt2,
      },
      {
        kind: 'slider',
        key: 'glitchSpeed',
        label: 'Speed',
        min: 0.5,
        max: 10,
        step: 0.5,
        defaultValue: 3,
        formatValue: fmt1,
      },
      {
        kind: 'slider',
        key: 'glitchBlockSize',
        label: 'Block Size',
        min: 5,
        max: 50,
        step: 1,
        defaultValue: 20,
        formatValue: fmt0,
      },
    ],
  },
];

// --- Lookup helpers ---

export const SHADER_DEFINITIONS_MAP = Object.fromEntries(
  SHADER_DEFINITIONS.map((d) => [d.id, d])
) as Record<ShaderType, ShaderTypeDefinition>;

export function getShaderDefaults(shaderType: ShaderType): Partial<ShaderSettings> {
  const def = SHADER_DEFINITIONS_MAP[shaderType];
  if (!def) return {};
  const defaults: Record<string, any> = { shaderType };
  if (def.variants) {
    defaults[def.variants.key] = def.variants.defaultValue;
  }
  for (const p of def.params) {
    defaults[p.key] = p.defaultValue;
  }
  return defaults as Partial<ShaderSettings>;
}

export function buildShaderSettings(
  shaderType: ShaderType,
  values: Record<string, any>
): ShaderSettings {
  const def = SHADER_DEFINITIONS_MAP[shaderType];
  if (!def) return { shaderType };
  const settings: Record<string, any> = { shaderType, borderSize: 0 };
  if (def.variants) {
    settings[def.variants.key] = values[def.variants.key] ?? def.variants.defaultValue;
  }
  for (const p of def.params) {
    settings[p.key] = values[p.key] ?? p.defaultValue;
  }
  return settings as ShaderSettings;
}

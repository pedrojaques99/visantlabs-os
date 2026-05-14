import { Uniform, Vector2 } from 'three';
import { Effect, BlendFunction } from 'postprocessing';
import type { ShaderType, HalftoneVariant } from '@/utils/shaders/shaderRegistry';
import { getShaderDefinition } from '@/utils/shaders/shaderRegistry';
import { getHalftoneShaderSource } from '@/utils/shaders/shaders/halftone';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';
import { getShaderDefaults } from '@/utils/shaders/shaderParams';

import '@/utils/shaders/shaderRenderer';

const UNIFORM_MAP: Record<string, Record<string, string>> = {
  halftone: {
    dotSize: 'uDotSize',
    angle: 'uAngle',
    contrast: 'uContrast',
    spacing: 'uSpacing',
    halftoneThreshold: 'uThreshold',
    halftoneInvert: 'uInvert',
  },
  vhs: {
    tapeWaveIntensity: 'uTapeWaveIntensity',
    tapeCreaseIntensity: 'uTapeCreaseIntensity',
    switchingNoiseIntensity: 'uSwitchingNoiseIntensity',
    bloomIntensity: 'uBloomIntensity',
    acBeatIntensity: 'uACBeatIntensity',
  },
  ascii: {
    asciiCharSize: 'u_char_size',
    asciiContrast: 'u_contrast',
    asciiBrightness: 'u_brightness',
    asciiCharSet: 'u_char_set',
    asciiColored: 'u_colored',
    asciiInvert: 'u_invert',
  },
  matrixDither: {
    matrixSize: 'matrixSize',
    bias: 'bias',
  },
  upscale: {
    scaleFactor: 'uScaleFactor',
    upscaleSharpening: 'uSharpening',
  },
  dither: {
    ditherSize: 'u_dither_size',
    ditherContrast: 'u_contrast',
    ditherOffset: 'u_offset',
    ditherBitDepth: 'u_bit_depth',
    ditherPalette: 'u_palette',
  },
  filmGrain: {
    filmGrainStrength: 'u_grain_strength',
    filmGrainSize: 'u_grain_size',
    filmGrainColored: 'u_colored',
  },
  pixelate: {
    pixelateSize: 'u_pixel_size',
  },
  posterize: {
    posterizeLevels: 'u_levels',
  },
  chromaticAberration: {
    chromaticOffset: 'u_offset',
    chromaticAngle: 'u_angle',
  },
  crtScanlines: {
    crtLineWidth: 'u_line_width',
    crtIntensity: 'u_intensity',
    crtVignette: 'u_vignette',
    crtCurvature: 'u_curvature',
  },
  edgeDetect: {
    edgeThreshold: 'u_threshold',
    edgeStrength: 'u_strength',
    edgeOverlay: 'u_overlay',
  },
  glitch: {
    glitchAmount: 'u_amount',
    glitchSpeed: 'u_speed',
    glitchBlockSize: 'u_block_size',
  },
  duotone: {
    duotoneIntensity: 'u_intensity',
    duotoneContrast: 'u_contrast',
    duotoneBrightness: 'u_brightness',
  },
};

function getFragmentSource(shaderType: ShaderType, halftoneVariant?: HalftoneVariant): string {
  if (shaderType === 'halftone') {
    return getHalftoneShaderSource(halftoneVariant || 'ellipse');
  }
  return getShaderDefinition(shaderType).fragmentShaderSource;
}

function adaptFragmentShader(originalSource: string): string {
  let src = originalSource;

  src = src.replace(/precision\s+(lowp|mediump|highp)\s+float\s*;/g, '');
  src = src.replace(/varying\s+vec2\s+v_texCoord\s*;/g, '');

  src = src.replace(/\biChannel0\b/g, 'inputBuffer');
  src = src.replace(/\biTime\b/g, 'u_time');

  const uniformDecls: string[] = [];
  const uniformRegex = /uniform\s+(float|vec[234]|int)\s+(\w+)\s*;/g;
  let match;
  const seenUniforms = new Set<string>();

  while ((match = uniformRegex.exec(src)) !== null) {
    const [, type, name] = match;
    if (name === 'iResolution' || name === 'inputBuffer') continue;
    if (!seenUniforms.has(name)) {
      seenUniforms.add(name);
      uniformDecls.push(`uniform ${type} ${name};`);
    }
  }

  src = src.replace(/uniform\s+(float|vec[234]|int|sampler2D)\s+\w+\s*;/g, '');

  const mainMatch = src.match(/void\s+main\s*\(\s*\)\s*\{/);
  if (!mainMatch) return src;

  const mainStart = src.indexOf(mainMatch[0]);
  let braceCount = 0;
  let mainEnd = mainStart + mainMatch[0].length;
  braceCount = 1;
  while (mainEnd < src.length && braceCount > 0) {
    if (src[mainEnd] === '{') braceCount++;
    if (src[mainEnd] === '}') braceCount--;
    mainEnd++;
  }

  let mainBody = src.substring(mainStart + mainMatch[0].length, mainEnd - 1);

  const beforeMain = src.substring(0, mainStart)
    .replace(/uniform\s+vec2\s+iResolution\s*;/g, '')
    .replace(/uniform\s+sampler2D\s+inputBuffer\s*;/g, '')
    .trim();

  // Replace v_texCoord with _vuv to avoid shadowing the mainImage `uv` param
  mainBody = mainBody.replace(/v_texCoord/g, '_vuv');

  mainBody = mainBody.replace(
    /gl_FragColor\s*=\s*([^;]+);/g,
    'outputColor = $1;',
  );

  const needsResolution = src.includes('iResolution');

  const resolutionDecl = needsResolution ? 'uniform vec2 iResolution;' : '';

  return `
${resolutionDecl}
${uniformDecls.join('\n')}

${beforeMain}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 _vuv = uv;
  ${mainBody}
}
`;
}

function mergeWithDefaults(shaderType: ShaderType, settings: ShaderSettings): ShaderSettings {
  const defaults = getShaderDefaults(shaderType);
  return { ...defaults, ...settings };
}

export class DynamicShaderEffect extends Effect {
  private _shaderType: ShaderType;
  private _halftoneVariant: HalftoneVariant;
  private _needsTime: boolean;

  constructor(
    shaderType: ShaderType,
    settings: ShaderSettings,
    halftoneVariant: HalftoneVariant = 'ellipse',
  ) {
    const originalSource = getFragmentSource(shaderType, halftoneVariant);
    const adaptedSource = adaptFragmentShader(originalSource);
    const needsTime = originalSource.includes('iTime') || originalSource.includes('u_time');
    const merged = mergeWithDefaults(shaderType, settings);

    const uniforms = new Map<string, Uniform>();
    uniforms.set('iResolution', new Uniform(new Vector2(window.innerWidth, window.innerHeight)));
    if (needsTime) {
      uniforms.set('u_time', new Uniform(0));
    }

    const map = UNIFORM_MAP[shaderType] || {};
    for (const [settingsKey, uniformName] of Object.entries(map)) {
      const val = (merged as any)[settingsKey];
      if (val !== undefined) {
        uniforms.set(uniformName, new Uniform(val));
      }
    }

    if (shaderType === 'duotone') {
      const shadowColor = merged.duotoneShadowColor ?? [0.1, 0.0, 0.2];
      const highlightColor = merged.duotoneHighlightColor ?? [0.3, 0.9, 0.9];
      uniforms.set('u_shadow_color', new Uniform(shadowColor));
      uniforms.set('u_highlight_color', new Uniform(highlightColor));
    }

    super('DynamicShaderEffect', adaptedSource, {
      blendFunction: BlendFunction.NORMAL,
      uniforms,
    });

    this._shaderType = shaderType;
    this._halftoneVariant = halftoneVariant;
    this._needsTime = needsTime;
  }

  get needsTime() {
    return this._needsTime;
  }

  updateUniforms(settings: ShaderSettings) {
    const merged = mergeWithDefaults(this._shaderType, settings);
    const map = UNIFORM_MAP[this._shaderType] || {};
    for (const [settingsKey, uniformName] of Object.entries(map)) {
      const val = (merged as any)[settingsKey];
      if (val !== undefined) {
        const u = this.uniforms.get(uniformName);
        if (u) u.value = val;
      }
    }

    if (this._shaderType === 'duotone') {
      const sc = merged.duotoneShadowColor;
      if (sc) {
        const u = this.uniforms.get('u_shadow_color');
        if (u) u.value = sc;
      }
      const hc = merged.duotoneHighlightColor;
      if (hc) {
        const u = this.uniforms.get('u_highlight_color');
        if (u) u.value = hc;
      }
    }
  }

  update(
    _renderer: any,
    _inputBuffer: any,
    deltaTime?: number,
  ) {
    if (this._needsTime) {
      const u = this.uniforms.get('u_time');
      if (u) u.value += (deltaTime ?? 0.016);
    }

    const res = this.uniforms.get('iResolution');
    if (res) {
      (res.value as Vector2).set(window.innerWidth, window.innerHeight);
    }
  }

  get shaderType() {
    return this._shaderType;
  }

  get halftoneVariant() {
    return this._halftoneVariant;
  }
}

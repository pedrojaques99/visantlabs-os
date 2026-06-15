import { describe, it, expect } from 'vitest';
import {
  applyRisoUniforms,
  RISO_DITHER_MODE_MAP,
  RISO_SHAPE_MAP,
  RISO_VERTEX_SHADER,
  RISO_FRAGMENT_SHADER,
} from '@visant/print-fx/riso';
import type { RisoSettings, InkLayer } from '@visant/print-fx';

/**
 * Mock GL that records every uniform set, keyed by the uniform name. Location
 * objects are just the name string, so we can read back exactly what was bound.
 */
function makeUniformRecorder() {
  const set: Record<string, number[]> = {};
  const gl = {
    getUniformLocation: (_p: unknown, name: string) => name,
    uniform1i: (loc: string, a: number) => (set[loc] = [a]),
    uniform1f: (loc: string, a: number) => (set[loc] = [a]),
    uniform2f: (loc: string, a: number, b: number) => (set[loc] = [a, b]),
    uniform3f: (loc: string, a: number, b: number, c: number) => (set[loc] = [a, b, c]),
    uniform4f: (loc: string, a: number, b: number, c: number, d: number) =>
      (set[loc] = [a, b, c, d]),
  } as unknown as WebGLRenderingContext;
  return { gl, set };
}

function layer(partial: Partial<InkLayer>): InkLayer {
  return {
    color: [0, 0, 0],
    hex: '#000000',
    visible: true,
    alpha: 1,
    angle: 0,
    offsetX: 0,
    offsetY: 0,
    ...partial,
  };
}

function settings(partial: Partial<RisoSettings> = {}): RisoSettings {
  return {
    layers: [],
    frequency: 45,
    dotSize: 0.9,
    contrast: 1,
    lightness: 0,
    paperColor: '#ffffff',
    paperNoise: 0.2,
    inkNoise: 0.3,
    inkDropout: 0.02,
    misregistration: 2,
    edgeBleed: 1,
    colorCount: 2,
    ditherMode: 'stochastic',
    halftoneShape: 'circle',
    ...partial,
  };
}

describe('@visant/print-fx riso — shader sources', () => {
  it('exports non-empty vertex + fragment GLSL with the ink uniform contract', () => {
    expect(RISO_VERTEX_SHADER).toContain('gl_Position');
    expect(RISO_FRAGMENT_SHADER).toContain('uniform sampler2D u_texture');
    // 4-layer ink contract present.
    for (let i = 0; i < 4; i++) {
      expect(RISO_FRAGMENT_SHADER).toContain(`u_inkColor${i}`);
      expect(RISO_FRAGMENT_SHADER).toContain(`u_inkVisible${i}`);
    }
  });
});

describe('@visant/print-fx riso — applyRisoUniforms', () => {
  it('binds the global scalar uniforms from settings', () => {
    const { gl, set } = makeUniformRecorder();
    applyRisoUniforms(gl, {} as WebGLProgram, settings(), 320, 200);
    expect(set.u_texture).toEqual([0]);
    expect(set.u_resolution).toEqual([320, 200]);
    expect(set.u_frequency).toEqual([45]);
    expect(set.u_misregistration).toEqual([2]);
    expect(set.u_effectOpacity).toEqual([1]); // default fallback
  });

  it('maps dither mode and halftone shape through the lookup tables', () => {
    const { gl, set } = makeUniformRecorder();
    applyRisoUniforms(
      gl,
      {} as WebGLProgram,
      settings({ ditherMode: 'atkinson', halftoneShape: 'ellipse' }),
      64,
      64
    );
    expect(set.u_ditherMode).toEqual([RISO_DITHER_MODE_MAP.atkinson]);
    expect(set.u_halftoneShape).toEqual([RISO_SHAPE_MAP.ellipse]);
  });

  it('converts the paper hex to normalized GL rgb + alpha 1', () => {
    const { gl, set } = makeUniformRecorder();
    applyRisoUniforms(gl, {} as WebGLProgram, settings({ paperColor: '#ff8000' }), 8, 8);
    expect(set.u_paperColor[0]).toBeCloseTo(1, 5);
    expect(set.u_paperColor[1]).toBeCloseTo(128 / 255, 5);
    expect(set.u_paperColor[2]).toBeCloseTo(0, 5);
    expect(set.u_paperColor[3]).toBe(1);
  });

  it('normalizes ink-layer color bytes and sets per-layer uniforms', () => {
    const { gl, set } = makeUniformRecorder();
    const s = settings({
      layers: [
        layer({ color: [255, 128, 0], alpha: 0.8, angle: 15, offsetX: 1, offsetY: -2 }),
        layer({ color: [0, 0, 255], visible: false }),
      ],
    });
    applyRisoUniforms(gl, {} as WebGLProgram, s, 100, 100);

    expect(set.u_layerCount).toEqual([2]);
    expect(set.u_inkColor0[0]).toBeCloseTo(1, 5);
    expect(set.u_inkColor0[1]).toBeCloseTo(128 / 255, 5);
    expect(set.u_inkColor0[2]).toBeCloseTo(0, 5);
    expect(set.u_inkAlpha0).toEqual([0.8]);
    expect(set.u_inkAngle0).toEqual([15]);
    expect(set.u_inkOffset0).toEqual([1, -2]);
    expect(set.u_inkVisible0).toEqual([1]);
    expect(set.u_inkVisible1).toEqual([0]); // hidden layer
  });

  it('zeroes out the unused ink slots (slots 2 and 3 with 2 layers)', () => {
    const { gl, set } = makeUniformRecorder();
    applyRisoUniforms(gl, {} as WebGLProgram, settings({ layers: [layer({}), layer({})] }), 16, 16);
    expect(set.u_inkColor2).toEqual([0, 0, 0]);
    expect(set.u_inkAlpha3).toEqual([0]);
    expect(set.u_inkVisible3).toEqual([0]);
    expect(set.u_layerDither2).toEqual([-1]);
    expect(set.u_layerHShape3).toEqual([-1]);
  });

  it('caps at 4 ink layers even if more are supplied', () => {
    const { gl, set } = makeUniformRecorder();
    applyRisoUniforms(
      gl,
      {} as WebGLProgram,
      settings({ layers: [layer({}), layer({}), layer({}), layer({}), layer({})] }),
      16,
      16
    );
    expect(set.u_layerCount).toEqual([4]);
  });
});

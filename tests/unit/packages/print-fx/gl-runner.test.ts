import { describe, it, expect, vi } from 'vitest';
import {
  compileShader,
  createProgram,
  setupFullscreenQuad,
  getOrCreateProgram,
} from '@visant/print-fx/gl';

/**
 * Minimal fake WebGLRenderingContext: every create* returns a unique tagged
 * object so we can assert identity, and the status getters report success.
 * Enough surface for the runner's compile/link/quad paths.
 */
function makeMockGL(opts: { compileOk?: boolean; linkOk?: boolean } = {}) {
  const { compileOk = true, linkOk = true } = opts;
  let id = 0;
  const tag = (kind: string) => ({ __kind: kind, __id: ++id });
  return {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 1,
    LINK_STATUS: 2,
    ARRAY_BUFFER: 34962,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    createShader: vi.fn(() => tag('shader')),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => compileOk),
    getShaderInfoLog: vi.fn(() => 'compile-log'),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => tag('program')),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => linkOk),
    getProgramInfoLog: vi.fn(() => 'link-log'),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => tag('buffer')),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
  } as unknown as WebGLRenderingContext & Record<string, any>;
}

const VS = 'attribute vec2 a_position; void main(){ gl_Position = vec4(a_position,0,1); }';
const FS = 'precision mediump float; void main(){ gl_FragColor = vec4(1.0); }';

describe('@visant/print-fx gl — runner', () => {
  it('compileShader compiles and returns a shader handle', () => {
    const gl = makeMockGL();
    const sh = compileShader(gl, (gl as any).VERTEX_SHADER, VS);
    expect(sh).toBeTruthy();
    expect((gl as any).shaderSource).toHaveBeenCalledWith(sh, VS);
    expect((gl as any).compileShader).toHaveBeenCalledOnce();
  });

  it('compileShader throws (and cleans up) on a compile error', () => {
    const gl = makeMockGL({ compileOk: false });
    expect(() => compileShader(gl, (gl as any).FRAGMENT_SHADER, FS)).toThrow(/Shader compilation error/);
    expect((gl as any).deleteShader).toHaveBeenCalledOnce();
  });

  it('createProgram links a vertex+fragment program', () => {
    const gl = makeMockGL();
    const prog = createProgram(gl, VS, FS);
    expect(prog).toBeTruthy();
    expect((gl as any).attachShader).toHaveBeenCalledTimes(2);
    expect((gl as any).linkProgram).toHaveBeenCalledOnce();
  });

  it('createProgram throws on a link error', () => {
    const gl = makeMockGL({ linkOk: false });
    expect(() => createProgram(gl, VS, FS)).toThrow(/Program link error/);
    expect((gl as any).deleteProgram).toHaveBeenCalledOnce();
  });

  it('setupFullscreenQuad creates exactly two attribute buffers', () => {
    const gl = makeMockGL();
    const prog = createProgram(gl, VS, FS);
    const buffers = setupFullscreenQuad(gl, prog);
    expect(buffers).toHaveLength(2);
    expect((gl as any).bufferData).toHaveBeenCalledTimes(2);
  });
});

describe('@visant/print-fx gl — getOrCreateProgram cache', () => {
  it('compiles once per (context, key) and reuses the cached program', () => {
    const gl = makeMockGL();
    const p1 = getOrCreateProgram(gl, 'shaderA', VS, FS);
    const p2 = getOrCreateProgram(gl, 'shaderA', VS, FS);
    expect(p2).toBe(p1);
    // linkProgram runs only on the first compile.
    expect((gl as any).linkProgram).toHaveBeenCalledOnce();
  });

  it('different cache keys produce distinct programs', () => {
    const gl = makeMockGL();
    const a = getOrCreateProgram(gl, 'shaderA', VS, FS);
    const b = getOrCreateProgram(gl, 'shaderB', VS, FS);
    expect(b).not.toBe(a);
    expect((gl as any).linkProgram).toHaveBeenCalledTimes(2);
  });

  it('the cache is per-context — a new context recompiles', () => {
    const gl1 = makeMockGL();
    const gl2 = makeMockGL();
    getOrCreateProgram(gl1, 'shaderA', VS, FS);
    getOrCreateProgram(gl2, 'shaderA', VS, FS);
    expect((gl1 as any).linkProgram).toHaveBeenCalledOnce();
    expect((gl2 as any).linkProgram).toHaveBeenCalledOnce();
  });
});

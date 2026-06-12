/**
 * Generic WebGL fullscreen-quad shader runner.
 *
 * Framework-agnostic GL helpers that operate on ANY WebGLRenderingContext —
 * a browser `canvas.getContext('webgl')` or a headless-gl context on the server.
 * The host owns context lifecycle (creation, the server's singleton + mutex,
 * teardown); this module only knows how to compile, draw a fullscreen quad, and
 * read pixels.
 */

export function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGLRenderingContext,
  vertexSrc: string,
  fragmentSrc: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

/**
 * Bind a fullscreen quad (two triangles, 6 verts) to the `a_position` /
 * `a_texCoord` attributes of `program`. Returns the created buffers so the
 * caller can delete them after the draw — critical on a long-lived shared
 * context where leaking buffers per render grows GPU memory unbounded.
 */
export function setupFullscreenQuad(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): WebGLBuffer[] {
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const texCoords = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const texBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

  return [posBuf, texBuf].filter(Boolean) as WebGLBuffer[];
}

/**
 * Delete per-render GL resources (textures, buffers) created for a single draw.
 * No-op safe: ignores nulls. Critical on a shared singleton context where the
 * context is NOT destroyed between renders.
 */
export function deleteRenderResources(
  gl: WebGLRenderingContext,
  resources: { textures?: (WebGLTexture | null)[]; buffers?: (WebGLBuffer | null)[] }
): void {
  for (const t of resources.textures || []) if (t) gl.deleteTexture(t);
  for (const b of resources.buffers || []) if (b) gl.deleteBuffer(b);
}

export function uploadTexture(
  gl: WebGLRenderingContext,
  pixels: Uint8Array,
  width: number,
  height: number
): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return texture;
}

export function readPixels(gl: WebGLRenderingContext, width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // WebGL reads bottom-up — flip vertically
  const rowSize = width * 4;
  const tmp = new Uint8Array(rowSize);
  for (let y = 0; y < height / 2; y++) {
    const topOffset = y * rowSize;
    const bottomOffset = (height - 1 - y) * rowSize;
    tmp.set(pixels.subarray(topOffset, topOffset + rowSize));
    pixels.set(pixels.subarray(bottomOffset, bottomOffset + rowSize), topOffset);
    pixels.set(tmp, bottomOffset);
  }
  return pixels;
}

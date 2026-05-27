const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
}`;

const FRAGMENT_SHADER = `
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif

precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;

uniform float u_frequency;
uniform float u_dotSize;
uniform float u_roughness;
uniform float u_fuzz;
uniform float u_paperNoise;
uniform float u_inkNoise;
uniform float u_randomness;
uniform float u_contrast;
uniform float u_lightness;
uniform float u_blur;
uniform float u_threshold;
uniform vec4 u_paperColor;

uniform float u_cyanAngle;
uniform float u_magentaAngle;
uniform float u_yellowAngle;
uniform float u_blackAngle;

uniform vec4 u_cyanColor;
uniform vec4 u_magentaColor;
uniform vec4 u_yellowColor;
uniform vec4 u_blackColor;

uniform bool u_showCyan;
uniform bool u_showMagenta;
uniform bool u_showYellow;
uniform bool u_showBlack;

uniform int u_blendMode;

varying vec2 v_texCoord;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float simplexNoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float aasmoothstep(float edge0, float edge1, float x) {
#ifdef GL_OES_standard_derivatives
  float width = max(fwidth(x), 0.0001);
  return smoothstep(edge0 - width, edge1 + width, x);
#else
  return smoothstep(edge0, edge1, x);
#endif
}

vec4 rgbToCmyk(vec3 rgb) {
  vec4 cmyk;
  cmyk.w = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
  if (cmyk.w < 1.0) {
    float oneMinusK = 1.0 - cmyk.w;
    cmyk.x = (1.0 - rgb.r - cmyk.w) / oneMinusK;
    cmyk.y = (1.0 - rgb.g - cmyk.w) / oneMinusK;
    cmyk.z = (1.0 - rgb.b - cmyk.w) / oneMinusK;
  } else {
    cmyk.xyz = vec3(0.0);
  }
  return clamp(cmyk, 0.0, 1.0);
}

mat2 rotationMatrix(float angle) {
  float rad = radians(angle);
  return mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
}

float hash(vec2 p) {
  p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
  return fract(p.x * p.y * (p.x + p.y));
}

float halftoneChannel(vec2 st, float channelValue, float angle, float roughness, float fuzz, float paperNoise) {
  if (channelValue < u_threshold) return 0.0;
  vec2 aspectCorrectedSt = st;
  aspectCorrectedSt.x *= u_resolution.x / u_resolution.y;
  vec2 rotatedSt = rotationMatrix(angle) * aspectCorrectedSt * u_frequency;
#ifdef GL_OES_standard_derivatives
  float pixelWidth = length(fwidth(rotatedSt)) * 2.0;
#else
  float pixelWidth = 0.02;
#endif
  vec2 gridPos = floor(rotatedSt);
  if (u_randomness > 0.0) {
    float randX = hash(gridPos) - 0.5;
    float randY = hash(gridPos + vec2(17.0, 31.0)) - 0.5;
    rotatedSt += vec2(randX, randY) * u_randomness * 0.8;
  }
  vec2 uv = 2.0 * fract(rotatedSt) - 1.0;
  float intensity = clamp(channelValue, 0.0, 1.0);
  float contrastCurve = intensity * intensity;
  float baseRadius = contrastCurve * u_dotSize;
  if (intensity > 0.1) baseRadius += roughness * paperNoise * intensity;
  float dist = length(uv);
  float radius = baseRadius - dist;
  float aaWidth = clamp(pixelWidth, 0.01, 0.1);
  return smoothstep(-fuzz - aaWidth, aaWidth, radius);
}

float gaussian(float x, float sigma) {
  return exp(-(x * x) / (2.0 * sigma * sigma));
}

vec2 pixelateToRotatedGrid(vec2 uv, float freq, float angle) {
  vec2 aspectCorrected = uv;
  aspectCorrected.x *= u_resolution.x / u_resolution.y;
  vec2 rotatedUV = rotationMatrix(angle) * aspectCorrected * freq;
  vec2 cellCenter = floor(rotatedUV) + 0.5;
  mat2 invRotation = rotationMatrix(-angle);
  vec2 unrotated = invRotation * cellCenter / freq;
  unrotated.x /= u_resolution.x / u_resolution.y;
  return unrotated;
}

vec3 sampleWithBlur(vec2 samplePos) {
  if (u_blur > 0.1) {
    vec2 texelSize = 1.0 / u_resolution;
    float sigma = u_blur / 3.0;
    vec3 colorSum = vec3(0.0);
    float weightSum = 0.0;
    for (int x = -4; x <= 4; x++) {
      for (int y = -4; y <= 4; y++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize * (u_blur / 4.0);
        float dist = length(vec2(float(x), float(y)));
        float weight = gaussian(dist, sigma);
        if (weight > 0.001) {
          colorSum += texture2D(u_texture, samplePos + offset).rgb * weight;
          weightSum += weight;
        }
      }
    }
    return colorSum / weightSum;
  }
  return texture2D(u_texture, samplePos).rgb;
}

vec3 adjustColor(vec3 color) {
  color = (color - 0.5) * u_contrast + 0.5;
  color = color + u_lightness;
  return clamp(color, 0.0, 1.0);
}

void main() {
  vec2 st = v_texCoord;
  vec3 texcolor = adjustColor(sampleWithBlur(st));

  float w = 0.5, f = 0.0;
  float s = 100.0;
  for(int i = 0; i < 4; i++) {
    f += w * simplexNoise(s * vec2(2.0, 1.0) * st);
    w *= 0.55; s *= 2.2;
  }
  float paperNoiseValue = 0.1 * f;

  vec3 paper = u_paperColor.rgb - u_paperNoise * paperNoiseValue;
  float paperAlpha = u_paperColor.a;
  float inkamount = 0.9 - u_inkNoise * paperNoiseValue;

  vec2 cyanSamplePos = pixelateToRotatedGrid(st, u_frequency, u_cyanAngle);
  vec4 cyanCmyk = rgbToCmyk(adjustColor(sampleWithBlur(cyanSamplePos)));
  vec2 magentaSamplePos = pixelateToRotatedGrid(st, u_frequency, u_magentaAngle);
  vec4 magentaCmyk = rgbToCmyk(adjustColor(sampleWithBlur(magentaSamplePos)));
  vec2 yellowSamplePos = pixelateToRotatedGrid(st, u_frequency, u_yellowAngle);
  vec4 yellowCmyk = rgbToCmyk(adjustColor(sampleWithBlur(yellowSamplePos)));
  vec2 blackSamplePos = pixelateToRotatedGrid(st, u_frequency, u_blackAngle);
  vec4 blackCmyk = rgbToCmyk(adjustColor(sampleWithBlur(blackSamplePos)));

  float c = 0.0, m = 0.0, y = 0.0, k = 0.0;
  if (u_showCyan && cyanCmyk.x > 0.001)
    c = halftoneChannel(st, cyanCmyk.x, u_cyanAngle, u_roughness, u_fuzz, paperNoiseValue);
  if (u_showMagenta && magentaCmyk.y > 0.001)
    m = halftoneChannel(st, magentaCmyk.y, u_magentaAngle, u_roughness, u_fuzz, paperNoiseValue);
  if (u_showYellow && yellowCmyk.z > 0.001)
    y = halftoneChannel(st, yellowCmyk.z, u_yellowAngle, u_roughness, u_fuzz, paperNoiseValue);
  if (u_showBlack && blackCmyk.w > 0.001)
    k = halftoneChannel(st, blackCmyk.w, u_blackAngle, u_roughness, u_fuzz, paperNoiseValue);

  vec3 rgbscreen = paper;

  if (u_showCyan && c > 0.0) {
    float a = u_cyanColor.a * c * inkamount;
    if (u_blendMode == 0) rgbscreen = mix(rgbscreen, rgbscreen * u_cyanColor.rgb, a);
    else if (u_blendMode == 1) rgbscreen = clamp(rgbscreen + u_cyanColor.rgb * a, 0.0, 1.0);
    else rgbscreen = mix(rgbscreen, u_cyanColor.rgb, a);
  }
  if (u_showMagenta && m > 0.0) {
    float a = u_magentaColor.a * m * inkamount;
    if (u_blendMode == 0) rgbscreen = mix(rgbscreen, rgbscreen * u_magentaColor.rgb, a);
    else if (u_blendMode == 1) rgbscreen = clamp(rgbscreen + u_magentaColor.rgb * a, 0.0, 1.0);
    else rgbscreen = mix(rgbscreen, u_magentaColor.rgb, a);
  }
  if (u_showYellow && y > 0.0) {
    float a = u_yellowColor.a * y * inkamount;
    if (u_blendMode == 0) rgbscreen = mix(rgbscreen, rgbscreen * u_yellowColor.rgb, a);
    else if (u_blendMode == 1) rgbscreen = clamp(rgbscreen + u_yellowColor.rgb * a, 0.0, 1.0);
    else rgbscreen = mix(rgbscreen, u_yellowColor.rgb, a);
  }
  if (u_showBlack && k > 0.0) {
    float a = u_blackColor.a * k * inkamount;
    if (u_blendMode == 0) rgbscreen = mix(rgbscreen, rgbscreen * u_blackColor.rgb, a);
    else if (u_blendMode == 1) rgbscreen = clamp(rgbscreen + u_blackColor.rgb * a, 0.0, 1.0);
    else rgbscreen = mix(rgbscreen, u_blackColor.rgb, a);
  }

#ifdef GL_OES_standard_derivatives
  float afwidth = 2.0 * u_frequency * max(length(dFdx(st)), length(dFdy(st)));
  float blend = smoothstep(0.7, 1.4, afwidth);
#else
  float blend = 0.0;
#endif

  vec3 finalColor = mix(rgbscreen, texcolor, blend);
  float inkCoverage = max(max(c, m), max(y, k));
  float finalAlpha = mix(paperAlpha + (1.0 - paperAlpha) * inkCoverage, 1.0, blend);
  gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}`;

export interface HalftoneSettings {
  frequency: number;
  dotSize: number;
  roughness: number;
  fuzz: number;
  paperNoise: number;
  inkNoise: number;
  randomness: number;
  contrast: number;
  lightness: number;
  blur: number;
  threshold: number;
  blendMode: number;
  cyanAngle: number;
  magentaAngle: number;
  yellowAngle: number;
  blackAngle: number;
  cyanInk: string;
  cyanAlpha: number;
  magentaInk: string;
  magentaAlpha: number;
  yellowInk: string;
  yellowAlpha: number;
  blackInk: string;
  blackAlpha: number;
  paperColor: string;
  paperAlpha: number;
  showCyan: boolean;
  showMagenta: boolean;
  showYellow: boolean;
  showBlack: boolean;
}

export const HALFTONE_DEFAULTS: HalftoneSettings = {
  frequency: 85,
  dotSize: 1.0,
  roughness: 2.0,
  fuzz: 0.1,
  paperNoise: 0.0,
  inkNoise: 0.6,
  randomness: 0.2,
  contrast: 1.0,
  lightness: 0.0,
  blur: 1.0,
  threshold: 0.05,
  blendMode: 0,
  cyanAngle: 15,
  magentaAngle: 75,
  yellowAngle: 0,
  blackAngle: 45,
  cyanInk: '#00FFFF',
  cyanAlpha: 0.95,
  magentaInk: '#FF00FF',
  magentaAlpha: 0.95,
  yellowInk: '#FFFF00',
  yellowAlpha: 0.95,
  blackInk: '#000000',
  blackAlpha: 0.95,
  paperColor: '#f8f4e8',
  paperAlpha: 1.0,
  showCyan: true,
  showMagenta: true,
  showYellow: true,
  showBlack: true,
};

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export class HalftoneRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private canvas: HTMLCanvasElement;

  public imageWidth = 0;
  public imageHeight = 0;
  public isImageLoaded = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): boolean {
    this.gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: true,
    });

    if (!this.gl) return false;
    this.gl.getExtension('OES_standard_derivatives');

    const vs = this.createShader(this.gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return false;

    this.program = this.gl.createProgram()!;
    this.gl.attachShader(this.program, vs);
    this.gl.attachShader(this.program, fs);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(this.program));
      return false;
    }

    const uniformNames = [
      'u_texture', 'u_resolution', 'u_frequency', 'u_dotSize', 'u_roughness',
      'u_fuzz', 'u_paperNoise', 'u_inkNoise', 'u_randomness', 'u_contrast',
      'u_lightness', 'u_blur', 'u_threshold', 'u_paperColor',
      'u_cyanAngle', 'u_magentaAngle', 'u_yellowAngle', 'u_blackAngle',
      'u_cyanColor', 'u_magentaColor', 'u_yellowColor', 'u_blackColor',
      'u_showCyan', 'u_showMagenta', 'u_showYellow', 'u_showBlack', 'u_blendMode',
    ];
    for (const name of uniformNames) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
    }

    const vertices = new Float32Array([-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const posLoc = this.gl.getAttribLocation(this.program, 'a_position');
    const texLoc = this.gl.getAttribLocation(this.program, 'a_texCoord');
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.enableVertexAttribArray(texLoc);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.vertexAttribPointer(texLoc, 2, this.gl.FLOAT, false, 16, 8);

    return true;
  }

  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null;
    const shader = this.gl.createShader(type);
    if (!shader) return null;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  setupTexture(img: HTMLImageElement): void {
    if (!this.gl) return;
    if (this.texture) this.gl.deleteTexture(this.texture);

    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img);

    this.imageWidth = img.naturalWidth || img.width;
    this.imageHeight = img.naturalHeight || img.height;
    this.canvas.width = this.imageWidth;
    this.canvas.height = this.imageHeight;
    this.gl.viewport(0, 0, this.imageWidth, this.imageHeight);
    this.isImageLoaded = true;
  }

  render(settings: HalftoneSettings): void {
    if (!this.gl || !this.program || !this.texture || !this.isImageLoaded) return;

    this.gl.useProgram(this.program);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

    const u = this.uniforms;
    const gl = this.gl;
    gl.uniform1i(u.u_texture, 0);
    gl.uniform2f(u.u_resolution, this.imageWidth, this.imageHeight);
    gl.uniform1f(u.u_frequency, settings.frequency);
    gl.uniform1f(u.u_dotSize, settings.dotSize);
    gl.uniform1f(u.u_roughness, settings.roughness);
    gl.uniform1f(u.u_fuzz, settings.fuzz);
    gl.uniform1f(u.u_paperNoise, settings.paperNoise);
    gl.uniform1f(u.u_inkNoise, settings.inkNoise);
    gl.uniform1f(u.u_randomness, settings.randomness);
    gl.uniform1f(u.u_contrast, settings.contrast);
    gl.uniform1f(u.u_lightness, settings.lightness);
    gl.uniform1f(u.u_blur, settings.blur);
    gl.uniform1f(u.u_threshold, settings.threshold);

    const paperRgb = hexToRgb(settings.paperColor);
    gl.uniform4f(u.u_paperColor, paperRgb[0], paperRgb[1], paperRgb[2], settings.paperAlpha);

    gl.uniform1f(u.u_cyanAngle, settings.cyanAngle);
    gl.uniform1f(u.u_magentaAngle, settings.magentaAngle);
    gl.uniform1f(u.u_yellowAngle, settings.yellowAngle);
    gl.uniform1f(u.u_blackAngle, settings.blackAngle);

    const cRgb = hexToRgb(settings.cyanInk);
    gl.uniform4f(u.u_cyanColor, cRgb[0], cRgb[1], cRgb[2], settings.cyanAlpha);
    const mRgb = hexToRgb(settings.magentaInk);
    gl.uniform4f(u.u_magentaColor, mRgb[0], mRgb[1], mRgb[2], settings.magentaAlpha);
    const yRgb = hexToRgb(settings.yellowInk);
    gl.uniform4f(u.u_yellowColor, yRgb[0], yRgb[1], yRgb[2], settings.yellowAlpha);
    const kRgb = hexToRgb(settings.blackInk);
    gl.uniform4f(u.u_blackColor, kRgb[0], kRgb[1], kRgb[2], settings.blackAlpha);

    gl.uniform1i(u.u_showCyan, settings.showCyan ? 1 : 0);
    gl.uniform1i(u.u_showMagenta, settings.showMagenta ? 1 : 0);
    gl.uniform1i(u.u_showYellow, settings.showYellow ? 1 : 0);
    gl.uniform1i(u.u_showBlack, settings.showBlack ? 1 : 0);
    gl.uniform1i(u.u_blendMode, settings.blendMode);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  renderAtScale(settings: HalftoneSettings, scale: number): HTMLCanvasElement {
    if (!this.gl || !this.program || !this.texture || !this.isImageLoaded || scale <= 1) {
      this.render(settings);
      return this.canvas;
    }

    const w = Math.round(this.imageWidth * scale);
    const h = Math.round(this.imageHeight * scale);
    const origW = this.imageWidth;
    const origH = this.imageHeight;

    this.canvas.width = w;
    this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
    this.imageWidth = w;
    this.imageHeight = h;
    this.render(settings);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d')!.drawImage(this.canvas, 0, 0);

    this.canvas.width = origW;
    this.canvas.height = origH;
    this.gl.viewport(0, 0, origW, origH);
    this.imageWidth = origW;
    this.imageHeight = origH;
    this.render(settings);

    return out;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  destroy(): void {
    if (this.gl && this.texture) {
      this.gl.deleteTexture(this.texture);
    }
  }
}

/**
 * WebGL Shader Renderer
 * Applies the provided GLSL shader effect to images
 */

// Import shaders to register them
import './shaders/vhs';
import './shaders/ascii';
import './shaders/matrixDither';
import './shaders/upscale';
import './shaders/dither';
import './shaders/duotone';
import { getHalftoneShaderSource } from './shaders/halftone';
import { getShaderDefinition, type ShaderType, type HalftoneVariant } from './shaderRegistry';

/**
 * Get API base URL
 */
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

/**
 * Check if URL is from R2 (Cloudflare R2 bucket)
 */
const isR2Url = (url: string): boolean => {
  return url.includes('.r2.dev');
};


/**
 * Cache for loaded images (URL/base64 -> HTMLImageElement)
 */
const imageCache = new Map<string, HTMLImageElement>();

/**
 * Cache for proxy responses (R2 URL -> base64 data URL)
 */
const proxyCache = new Map<string, string>();


/**
 * Persistent WebGL Shader Renderer
 * Caches WebGL context, programs, buffers, and textures for optimal performance
 */
export class PersistentShaderRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;

  // Program cache: key = shaderType:variant (e.g., "halftone:ellipse", "vhs:")
  private programCache: Map<string, WebGLProgram> = new Map();

  // Geometry buffers (static, reused for all renders)
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;

  // Current texture cache
  private currentSourceTexture: WebGLTexture | null = null;
  private currentSourceKey: string = '';
  private currentSourceWidth: number = 0;
  private currentSourceHeight: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      antialias: false,
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }

    this.gl = gl;
    this.initializeGeometry();
  }

  /**
   * Initialize static geometry buffers (only done once)
   */
  private initializeGeometry(): void {
    const gl = this.gl;

    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]);

    const texCoords = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      0, 1,
      1, 0,
      1, 1,
    ]);

    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  /**
   * Get or create cached shader program
   */
  private getProgram(shaderType: ShaderType, halftoneVariant?: HalftoneVariant): WebGLProgram {
    const key = `${shaderType}:${halftoneVariant || ''}`;

    let program = this.programCache.get(key);
    if (program) {
      return program;
    }

    // Get fragment shader source
    let fragmentShaderSource: string;
    if (shaderType === 'halftone') {
      fragmentShaderSource = getHalftoneShaderSource(halftoneVariant || 'ellipse');
    } else {
      const shaderDef = getShaderDefinition(shaderType);
      fragmentShaderSource = shaderDef.fragmentShaderSource;
    }

    // Compile and link program
    program = createProgram(this.gl, VERTEX_SHADER_SOURCE, fragmentShaderSource);
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    this.programCache.set(key, program);
    return program;
  }

  /**
   * Update source texture (only if changed)
   */
  private async updateSourceTexture(image: HTMLImageElement | HTMLCanvasElement, sourceKey: string): Promise<void> {
    const gl = this.gl;
    const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

    // Check if texture needs update
    if (this.currentSourceKey === sourceKey &&
      this.currentSourceWidth === width &&
      this.currentSourceHeight === height &&
      this.currentSourceTexture) {
      return; // Texture already loaded and unchanged
    }

    // Delete old texture if exists
    if (this.currentSourceTexture) {
      gl.deleteTexture(this.currentSourceTexture);
    }

    // Create and upload new texture
    this.currentSourceTexture = await loadTexture(gl, image);
    this.currentSourceKey = sourceKey;
    this.currentSourceWidth = width;
    this.currentSourceHeight = height;
  }

  /**
   * Render shader effect
   * Performance: ~20-50ms for parameter changes, ~200ms for new images
   */
  async render(
    image: HTMLImageElement | HTMLCanvasElement,
    sourceKey: string,
    width: number,
    height: number,
    settings: ShaderSettings
  ): Promise<string> {
    const gl = this.gl;
    const shaderType = settings.shaderType ?? 'halftone';
    const halftoneVariant = settings.halftoneVariant ?? 'ellipse';

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    // Update source texture (only if changed)
    await this.updateSourceTexture(image, sourceKey);

    // Get cached program (instant if cached)
    const program = this.getProgram(shaderType, halftoneVariant);
    gl.useProgram(program);

    // Bind geometry buffers
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind source texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.currentSourceTexture);
    const sourceTextureLocation = gl.getUniformLocation(program, 'iChannel0');
    if (sourceTextureLocation !== null) {
      gl.uniform1i(sourceTextureLocation, 0);
    }

    // Set resolution uniform
    const resolutionLocation = gl.getUniformLocation(program, 'iResolution');
    if (resolutionLocation !== null) {
      gl.uniform2f(resolutionLocation, width, height);
    }

    // Set shader-specific uniforms
    this.setShaderUniforms(program, shaderType, settings);

    // Clear and render
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Convert to base64 using toBlob for maximum quality
    return await this.canvasToBase64(this.canvas);
  }

  /**
   * Convert canvas to base64 using toBlob for maximum quality
   * toBlob provides better quality than toDataURL
   */
  private canvasToBase64(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Fallback to toDataURL if toBlob fails
            resolve(canvas.toDataURL('image/png'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = () => {
            // Fallback to toDataURL if FileReader fails
            resolve(canvas.toDataURL('image/png'));
          };
          reader.readAsDataURL(blob);
        },
        'image/png',
        1.0 // Maximum quality
      );
    });
  }

  /**
   * Set shader-specific uniforms
   */
  private setShaderUniforms(program: WebGLProgram, shaderType: ShaderType, settings: ShaderSettings): void {
    const gl = this.gl;

    if (shaderType === 'halftone') {
      const dotSize = settings.dotSize ?? 5.0;
      const angle = settings.angle ?? 0.0;
      const contrast = settings.contrast ?? 1.0;
      const spacing = settings.spacing ?? 2.0;
      const threshold = settings.halftoneThreshold ?? 1.0;
      const invert = settings.halftoneInvert ?? 0.0;

      const dotSizeLocation = gl.getUniformLocation(program, 'uDotSize');
      if (dotSizeLocation !== null) {
        gl.uniform1f(dotSizeLocation, dotSize);
      }

      const angleLocation = gl.getUniformLocation(program, 'uAngle');
      if (angleLocation !== null) {
        gl.uniform1f(angleLocation, angle);
      }

      const contrastLocation = gl.getUniformLocation(program, 'uContrast');
      if (contrastLocation !== null) {
        gl.uniform1f(contrastLocation, contrast);
      }

      const spacingLocation = gl.getUniformLocation(program, 'uSpacing');
      if (spacingLocation !== null) {
        gl.uniform1f(spacingLocation, spacing);
      }

      const thresholdLocation = gl.getUniformLocation(program, 'uThreshold');
      if (thresholdLocation !== null) {
        gl.uniform1f(thresholdLocation, threshold);
      }

      const invertLocation = gl.getUniformLocation(program, 'uInvert');
      if (invertLocation !== null) {
        gl.uniform1f(invertLocation, invert);
      }
    } else if (shaderType === 'vhs') {
      const timeValue = settings.time ?? Math.random() * 100.0;
      const tapeWaveIntensity = settings.tapeWaveIntensity ?? 1.0;
      const tapeCreaseIntensity = settings.tapeCreaseIntensity ?? 1.0;
      const switchingNoiseIntensity = settings.switchingNoiseIntensity ?? 1.0;
      const bloomIntensity = settings.bloomIntensity ?? 1.0;
      const acBeatIntensity = settings.acBeatIntensity ?? 1.0;

      const timeLocation = gl.getUniformLocation(program, 'iTime');
      if (timeLocation !== null) {
        gl.uniform1f(timeLocation, timeValue);
      }

      const tapeWaveIntensityLocation = gl.getUniformLocation(program, 'uTapeWaveIntensity');
      if (tapeWaveIntensityLocation !== null) {
        gl.uniform1f(tapeWaveIntensityLocation, tapeWaveIntensity);
      }

      const tapeCreaseIntensityLocation = gl.getUniformLocation(program, 'uTapeCreaseIntensity');
      if (tapeCreaseIntensityLocation !== null) {
        gl.uniform1f(tapeCreaseIntensityLocation, tapeCreaseIntensity);
      }

      const switchingNoiseIntensityLocation = gl.getUniformLocation(program, 'uSwitchingNoiseIntensity');
      if (switchingNoiseIntensityLocation !== null) {
        gl.uniform1f(switchingNoiseIntensityLocation, switchingNoiseIntensity);
      }

      const bloomIntensityLocation = gl.getUniformLocation(program, 'uBloomIntensity');
      if (bloomIntensityLocation !== null) {
        gl.uniform1f(bloomIntensityLocation, bloomIntensity);
      }

      const acBeatIntensityLocation = gl.getUniformLocation(program, 'uACBeatIntensity');
      if (acBeatIntensityLocation !== null) {
        gl.uniform1f(acBeatIntensityLocation, acBeatIntensity);
      }
    } else if (shaderType === 'ascii') {
      const charSize = settings.asciiCharSize ?? 8.0;
      const contrast = settings.asciiContrast ?? 1.0;
      const brightness = settings.asciiBrightness ?? 0.0;
      const charSet = settings.asciiCharSet ?? 3.0;
      const colored = settings.asciiColored ?? 0.0;
      const invert = settings.asciiInvert ?? 0.0;

      const charSizeLocation = gl.getUniformLocation(program, 'u_char_size');
      if (charSizeLocation !== null) {
        gl.uniform1f(charSizeLocation, charSize);
      }

      const contrastLocation = gl.getUniformLocation(program, 'u_contrast');
      if (contrastLocation !== null) {
        gl.uniform1f(contrastLocation, contrast);
      }

      const brightnessLocation = gl.getUniformLocation(program, 'u_brightness');
      if (brightnessLocation !== null) {
        gl.uniform1f(brightnessLocation, brightness);
      }

      const charSetLocation = gl.getUniformLocation(program, 'u_char_set');
      if (charSetLocation !== null) {
        gl.uniform1f(charSetLocation, charSet);
      }

      const coloredLocation = gl.getUniformLocation(program, 'u_colored');
      if (coloredLocation !== null) {
        gl.uniform1f(coloredLocation, colored);
      }

      const invertLocation = gl.getUniformLocation(program, 'u_invert');
      if (invertLocation !== null) {
        gl.uniform1f(invertLocation, invert);
      }
    } else if (shaderType === 'matrixDither') {
      const matrixSize = settings.matrixSize ?? 4.0;
      const bias = settings.bias ?? 0.0;

      const matrixSizeLocation = gl.getUniformLocation(program, 'matrixSize');
      if (matrixSizeLocation !== null) {
        gl.uniform1f(matrixSizeLocation, matrixSize);
      }

      const biasLocation = gl.getUniformLocation(program, 'bias');
      if (biasLocation !== null) {
        gl.uniform1f(biasLocation, bias);
      }
    } else if (shaderType === 'upscale') {
      const scaleFactor = settings.scaleFactor ?? 2.0;
      const sharpening = settings.upscaleSharpening ?? 0.3;

      const scaleFactorLocation = gl.getUniformLocation(program, 'uScaleFactor');
      if (scaleFactorLocation !== null) {
        gl.uniform1f(scaleFactorLocation, scaleFactor);
      }

      const sharpeningLocation = gl.getUniformLocation(program, 'uSharpening');
      if (sharpeningLocation !== null) {
        gl.uniform1f(sharpeningLocation, sharpening);
      }
    } else if (shaderType === 'dither') {
      const ditherSize = settings.ditherSize ?? 4.0;
      const contrast = settings.ditherContrast ?? 1.5;
      const offset = settings.ditherOffset ?? 0.0;
      const bitDepth = settings.ditherBitDepth ?? 4.0;
      const palette = settings.ditherPalette ?? 0.0;

      const ditherSizeLocation = gl.getUniformLocation(program, 'u_dither_size');
      if (ditherSizeLocation !== null) {
        gl.uniform1f(ditherSizeLocation, ditherSize);
      }

      const contrastLocation = gl.getUniformLocation(program, 'u_contrast');
      if (contrastLocation !== null) {
        gl.uniform1f(contrastLocation, contrast);
      }

      const offsetLocation = gl.getUniformLocation(program, 'u_offset');
      if (offsetLocation !== null) {
        gl.uniform1f(offsetLocation, offset);
      }

      const bitDepthLocation = gl.getUniformLocation(program, 'u_bit_depth');
      if (bitDepthLocation !== null) {
        gl.uniform1f(bitDepthLocation, bitDepth);
      }

      const paletteLocation = gl.getUniformLocation(program, 'u_palette');
      if (paletteLocation !== null) {
        gl.uniform1f(paletteLocation, palette);
      }
    } else if (shaderType === 'duotone') {
      // Duotone shader uniforms
      // Default colors: Deep purple shadows, bright cyan highlights
      const shadowColor = settings.duotoneShadowColor ?? [0.1, 0.0, 0.2];
      const highlightColor = settings.duotoneHighlightColor ?? [0.3, 0.9, 0.9];
      const intensity = settings.duotoneIntensity ?? 1.0;
      const contrast = settings.duotoneContrast ?? 1.0;
      const brightness = settings.duotoneBrightness ?? 0.0;

      const shadowColorLocation = gl.getUniformLocation(program, 'u_shadow_color');
      if (shadowColorLocation !== null) {
        gl.uniform3f(shadowColorLocation, shadowColor[0], shadowColor[1], shadowColor[2]);
      }

      const highlightColorLocation = gl.getUniformLocation(program, 'u_highlight_color');
      if (highlightColorLocation !== null) {
        gl.uniform3f(highlightColorLocation, highlightColor[0], highlightColor[1], highlightColor[2]);
      }

      const intensityLocation = gl.getUniformLocation(program, 'u_intensity');
      if (intensityLocation !== null) {
        gl.uniform1f(intensityLocation, intensity);
      }

      const contrastLocation = gl.getUniformLocation(program, 'u_contrast');
      if (contrastLocation !== null) {
        gl.uniform1f(contrastLocation, contrast);
      }

      const brightnessLocation = gl.getUniformLocation(program, 'u_brightness');
      if (brightnessLocation !== null) {
        gl.uniform1f(brightnessLocation, brightness);
      }
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    const gl = this.gl;

    // Delete textures
    if (this.currentSourceTexture) {
      gl.deleteTexture(this.currentSourceTexture);
    }

    // Delete buffers
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
    }
    if (this.texCoordBuffer) {
      gl.deleteBuffer(this.texCoordBuffer);
    }

    // Delete programs
    this.programCache.forEach(program => gl.deleteProgram(program));
    this.programCache.clear();

    // Lose context
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext();
    }
  }
}

/**
 * Singleton instance of persistent renderer
 */
let persistentRenderer: PersistentShaderRenderer | null = null;

/**
 * Get or create persistent renderer
 */
function getRenderer(): PersistentShaderRenderer {
  if (!persistentRenderer) {
    persistentRenderer = new PersistentShaderRenderer();
  }
  return persistentRenderer;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

/**
 * Compile shader from source
 */
function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${error}`);
  }

  return shader;
}

/**
 * Create shader program
 */
function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking error: ${error}`);
  }

  return program;
}

/**
 * Load image as WebGL texture
 */
function loadTexture(gl: WebGLRenderingContext, image: HTMLImageElement | HTMLCanvasElement): Promise<WebGLTexture> {
  return new Promise((resolve, reject) => {
    const texture = gl.createTexture();
    if (!texture) {
      reject(new Error('Failed to create texture'));
      return;
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (image instanceof HTMLImageElement) {
      if (image.complete) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        resolve(texture);
      } else {
        image.onload = () => {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          resolve(texture);
        };
        image.onerror = () => reject(new Error('Failed to load image'));
      }
    } else {
      // HTMLCanvasElement
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      resolve(texture);
    }
  });
}

export interface ShaderSettings {
  shaderType?: ShaderType; // Type of shader to apply, default 'halftone'
  halftoneVariant?: HalftoneVariant; // Variant for halftone shader, default 'ellipse'

  borderSize?: number; // 0 to 20, default 0

  // Halftone shader parameters
  dotSize?: number; // 0.1 to 20.0, default 5.0
  angle?: number; // 0 to 360, default 0.0
  contrast?: number; // 0.0 to 2.0, default 1.0
  spacing?: number; // 0.5 to 5.0, default 2.0
  halftoneThreshold?: number; // 0.0 to 1.0, default 1.0 (for halftone shader)
  halftoneInvert?: number; // 0.0 = normal, 1.0 = inverted, default 0.0 (for halftone shader)

  // VHS shader parameters
  time?: number; // Time value for animation, if not provided uses random value
  tapeWaveIntensity?: number; // 0.0 to 2.0, default 1.0
  tapeCreaseIntensity?: number; // 0.0 to 2.0, default 1.0
  switchingNoiseIntensity?: number; // 0.0 to 2.0, default 1.0
  bloomIntensity?: number; // 0.0 to 2.0, default 1.0
  acBeatIntensity?: number; // 0.0 to 2.0, default 1.0

  // ASCII shader parameters
  asciiCharSize?: number; // 2.0 to 32.0, default 8.0 (character cell size in pixels)
  asciiContrast?: number; // 0.1 to 3.0, default 1.0 (contrast adjustment)
  asciiBrightness?: number; // -0.5 to 0.5, default 0.0 (brightness offset)
  asciiCharSet?: number; // 0-5, default 3 (0=Blocks, 1=Dots, 2=Lines, 3=Classic, 4=Matrix, 5=Braille)
  asciiColored?: number; // 0.0 or 1.0, default 0.0 (0=Grayscale, 1=Colored)
  asciiInvert?: number; // 0.0 or 1.0, default 0.0 (0=Normal, 1=Inverted)

  // Matrix Dither shader parameters
  matrixSize?: number; // 2.0, 4.0, or 8.0, default 4.0 (Bayer matrix size)
  bias?: number; // -1.0 to 1.0, default 0.0 (threshold bias adjustment)

  // Upscale shader parameters
  scaleFactor?: number; // 2.0, 3.0, 4.0, etc., default 2.0 (upscaling factor)
  upscaleSharpening?: number; // 0.0 to 1.0, default 0.3 (sharpening intensity to restore details)

  // Dither shader parameters
  ditherSize?: number; // 1.0 to 16.0, default 4.0 (pixelation scale)
  ditherContrast?: number; // 0.5 to 3.0, default 1.5 (luminosity contrast)
  ditherOffset?: number; // -0.5 to 0.5, default 0.0 (luminosity offset)
  ditherBitDepth?: number; // 1.0 to 8.0, default 4.0 (color depth bands)
  ditherPalette?: number; // 0.0 to 4.0, default 0.0 (color palette preset: 0=Monochrome, 1=Gameboy, 2=CRT Amber, 3=CRT Green, 4=Sepia)

  // Duotone shader parameters
  duotoneShadowColor?: [number, number, number]; // RGB array [0-1, 0-1, 0-1] for shadow color
  duotoneHighlightColor?: [number, number, number]; // RGB array [0-1, 0-1, 0-1] for highlight color
  duotoneIntensity?: number; // 0.0 to 1.0, default 1.0 (effect intensity)
  duotoneContrast?: number; // 0.5 to 2.0, default 1.0 (luminosity contrast)
  duotoneBrightness?: number; // -0.5 to 0.5, default 0.0 (brightness offset)
}

/**
 * Apply shader effect to image
 * @param imageInput - Image URL, base64, or Image element
 * @param width - Output width (maintains 1:1 quality)
 * @param height - Output height (maintains 1:1 quality)
 * @param settings - Shader effect settings
 * @returns Base64 encoded result image
 */
export async function applyShaderEffect(
  imageInput: string | HTMLImageElement | HTMLCanvasElement,
  width?: number,
  height?: number,
  settings?: ShaderSettings
): Promise<string> {
  // Load source image
  let image: HTMLImageElement | HTMLCanvasElement;
  let imageWidth: number;
  let imageHeight: number;
  let sourceKey: string;

  if (typeof imageInput === 'string') {
    sourceKey = imageInput;

    // Check cache first
    const cachedImage = imageCache.get(imageInput);
    if (cachedImage && cachedImage.complete) {
      image = cachedImage;
      imageWidth = cachedImage.naturalWidth;
      imageHeight = cachedImage.naturalHeight;
    } else {
      image = new Image();

      // Use proxy for R2 URLs to bypass CORS restrictions
      let imageSrc = imageInput;
      if (!imageInput.startsWith('data:') && isR2Url(imageInput)) {
        // Check proxy cache first
        const cachedProxyData = proxyCache.get(imageInput);
        if (cachedProxyData) {
          imageSrc = cachedProxyData;
        } else {
          try {
            const API_BASE_URL = getApiBaseUrl();
            const proxyUrl = `${API_BASE_URL}/images/proxy?url=${encodeURIComponent(imageInput)}`;
            const response = await fetch(proxyUrl);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `Proxy failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.base64) {
              throw new Error('Proxy returned empty base64 data');
            }

            // Convert base64 to data URL and cache it
            const mimeType = data.mimeType || 'image/png';
            imageSrc = `data:${mimeType};base64,${data.base64}`;
            proxyCache.set(imageInput, imageSrc);
          } catch (error) {
            console.error('Error using proxy for R2 URL:', {
              url: imageInput,
              error: error instanceof Error ? error.message : String(error),
            });
            // Fall through to direct fetch attempt (might work in some cases)
            throw error;
          }
        }
      } else if (!imageInput.startsWith('data:')) {
        // Only set crossOrigin for external URLs, not for data URLs
        (image as HTMLImageElement).crossOrigin = 'anonymous';
      }

      await new Promise<void>((resolve, reject) => {
        const img = image as HTMLImageElement;
        img.onload = () => {
          imageWidth = img.naturalWidth;
          imageHeight = img.naturalHeight;
          // Cache the loaded image
          imageCache.set(imageInput, img);
          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageSrc;
      });
    }
  } else {
    image = imageInput;
    if (image instanceof HTMLImageElement) {
      imageWidth = image.naturalWidth;
      imageHeight = image.naturalHeight;
      sourceKey = image.src || `img_${Date.now()}`;
    } else {
      imageWidth = image.width;
      imageHeight = image.height;
      sourceKey = `canvas_${Date.now()}`;
    }
  }

  // Calculate output dimensions
  let outputWidth = width || imageWidth;
  let outputHeight = height || imageHeight;

  // For upscale shader, multiply dimensions by scale factor
  if (settings?.shaderType === 'upscale') {
    const scaleFactor = settings.scaleFactor ?? 2.0;
    outputWidth = Math.round(imageWidth * scaleFactor);
    outputHeight = Math.round(imageHeight * scaleFactor);
  }

  // Use persistent renderer for optimal performance
  const renderer = getRenderer();
  return await renderer.render(image, sourceKey, outputWidth, outputHeight, settings || {});
}

/**
 * Check if input is a video
 */
function isVideo(input: string): boolean {
  return input.startsWith('data:video/') ||
    /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(input) ||
    input.includes('video');
}

/**
 * Extract frame from video at specific time
 */
function extractVideoFrame(video: HTMLVideoElement, time: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const onSeeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(canvas);
    };

    const onError = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error('Failed to seek video'));
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = time;
  });
}

/**
 * Apply shader effect to video
 * Processes video frame by frame and combines into new video
 * @param videoInput - Video URL or base64
 * @param settings - Shader effect settings
 * @param fps - Frames per second for output video (default: 15, reduced for performance)
 * @param maxDuration - Maximum duration in seconds to process (default: 5)
 * @returns Base64 encoded result video
 */
export async function applyShaderEffectToVideo(
  videoInput: string,
  settings?: ShaderSettings,
  fps: number = 15,
  maxDuration: number = 5
): Promise<string> {
  // Load video
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      video.width = video.videoWidth;
      video.height = video.videoHeight;
      resolve();
    };
    video.onerror = () => reject(new Error('Failed to load video'));
    video.src = videoInput;
  });

  const duration = Math.min(video.duration, maxDuration);
  const frameInterval = 1 / fps;
  const totalFrames = Math.ceil(duration * fps);

  // Create canvas for processing frames
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Process all frames first
  const processedFrames: string[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const time = i * frameInterval;
    if (time >= duration) break;

    // Extract frame
    const frameCanvas = await extractVideoFrame(video, time);

    // Apply shader to frame directly from canvas
    const processedFrame = await applyShaderEffect(frameCanvas, canvas.width, canvas.height, settings);
    processedFrames.push(processedFrame);
  }

  // Create MediaRecorder to combine frames
  const stream = canvas.captureStream(fps);

  // Try different mime types
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }
  }

  // Use high bitrate to preserve maximum quality for designers
  // Higher bitrate = better quality, larger file size
  // 8 Mbps is good for high-quality video (4x the previous 2 Mbps)
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8000000, // 8 Mbps - High quality for designers
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to convert video to base64'));
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(error);
      }
    };

    mediaRecorder.onerror = (e) => {
      reject(new Error('MediaRecorder error'));
    };

    // Start recording
    mediaRecorder.start();

    // Draw processed frames to canvas sequentially
    (async () => {
      try {
        for (let i = 0; i < processedFrames.length; i++) {
          const processedFrame = processedFrames[i];

          // Load processed frame as image
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              resolve();
            };
            img.onerror = () => reject(new Error('Failed to load processed frame'));
            img.src = processedFrame;
          });

          // Wait for frame to be recorded
          await new Promise(resolve => setTimeout(resolve, 1000 / fps));
        }

        // Stop recording after all frames
        setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        }, 200);
      } catch (error) {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
        reject(error);
      }
    })();
  });
}


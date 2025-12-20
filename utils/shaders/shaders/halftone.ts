/**
 * Halftone Shader
 * Applies halftone effect with three variants: ellipse, square, and lines
 */

import { registerShader, type ShaderDefinition, type HalftoneVariant } from '../shaderRegistry';

// Helper functions for cosine-based halftone
const HELPER_FUNCTIONS = `
const float PI = 3.1415926535897932384626433832795;
const float PI180 = float(PI / 180.0);

float sind(float a) {
  return sin(a * PI180);
}

float cosd(float a) {
  return cos(a * PI180);
}

float added(vec2 sh, float sa, float ca, vec2 c, float d) {
  return 0.5 + 0.25 * cos((sh.x * sa + sh.y * ca + c.x) * d) + 0.25 * cos((sh.x * ca - sh.y * sa + c.y) * d);
}

vec2 rotate(vec2 v, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  mat2 m = mat2(c, -s, s, c);
  return m * v;
}
`;

// Base halftone shader with variant selection
const createHalftoneFragmentShader = (variant: HalftoneVariant): string => {
  let halftoneLogic = '';

  switch (variant) {
    case 'ellipse': {
      halftoneLogic = `
      // Cosine-based halftone dot matrix shader
      // Based on Tomek Augustyn's Halftone shader
      
      float ratio = iResolution.y / iResolution.x;
      float coordX = fragCoord.x / iResolution.x;
      float coordY = fragCoord.y / iResolution.x;
      vec2 dstCoord = vec2(coordX, coordY);
      vec2 srcCoord = vec2(coordX, coordY / ratio);
      vec2 rotationCenter = vec2(0.5, 0.5);
      vec2 shift = dstCoord - rotationCenter;
      
      // Calculate pattern frequency: 
      // - spacing controls pattern density (larger spacing = fewer repeats = lower frequency)
      // - dotSize controls individual dot size (larger dotSize = larger dots = lower frequency)
      // Both work inversely: larger values = lower frequency = larger pattern elements
      float baseScale = 680.0;
      float patternFrequency = PI * baseScale / (max(0.1, uSpacing) * max(0.1, uDotSize));
      
      // Calculate raster pattern using cosine functions
      float rasterPattern = added(shift, sind(uAngle), cosd(uAngle), rotationCenter, patternFrequency);
      
      // Convert grayscale to halftone (avoid division by zero)
      float thresholdClamped = clamp(uThreshold, 0.01, 0.99);
      float gray = (rasterPattern * thresholdClamped + adjustedGrayscale - thresholdClamped) / (1.0 - thresholdClamped);
      
      // Clamp result
      result = clamp(gray, 0.0, 1.0);
      `;
      break;
    }
    case 'square': {
      halftoneLogic = `
      // Square halftone - square dots
      vec2 cell = floor(uv * gridSize);
      vec2 cellCenter = (cell + 0.5) / gridSize;
      vec2 cellUV = (uv - cellCenter) * gridSize;
      
      // Rotate cell coordinates
      vec2 rotatedCellUV = rotate(cellUV, angleRad);
      
      // Manhattan distance (creates squares)
      float dist = max(abs(rotatedCellUV.x), abs(rotatedCellUV.y));
      
      // Square size based on grayscale (inverted: darker = larger square)
      float size = uDotSize * (1.0 - adjustedGrayscale) * 0.5;
      
      // Create square with smooth edges
      float square = smoothstep(size + 0.1, size - 0.1, dist);
      result = square;
      `;
      break;
    }
    case 'lines': {
      halftoneLogic = `
      // Lines halftone - parallel lines
      vec2 rotatedUV = rotate(uv, angleRad);
      
      // Calculate line position
      float linePos = mod(rotatedUV.y * gridSize, uSpacing);
      
      // Line width based on grayscale (inverted: darker = thicker lines)
      float lineWidth = uDotSize * (1.0 - adjustedGrayscale) * 0.5;
      
      // Create line with smooth edges
      float line = smoothstep(lineWidth + 0.1, lineWidth - 0.1, abs(linePos - uSpacing * 0.5));
      result = line;
      `;
      break;
    }
  }

  return `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float uDotSize;
uniform float uAngle;
uniform float uContrast;
uniform float uSpacing;
uniform float uThreshold;
uniform float uInvert;

varying vec2 v_texCoord;

${HELPER_FUNCTIONS}

void main() {
  vec2 fragCoord = v_texCoord * iResolution;
  vec2 uv = fragCoord / iResolution;
  uv.y = 1.0 - uv.y;
  
  // Sample source pixel
  vec3 sourcePixel = texture2D(iChannel0, uv).rgb;
  
  // Convert to grayscale (using updated coefficients from new shader)
  float grayscale = 0.2125 * sourcePixel.r + 0.7154 * sourcePixel.g + 0.0721 * sourcePixel.b;
  
  // Apply contrast
  float adjustedGrayscale = pow(grayscale, 1.0 / max(0.1, uContrast));
  
  // Calculate grid size based on spacing (for square and lines variants)
  float gridSize = 100.0 / max(0.1, uSpacing);
  
  // Convert angle from degrees to radians (for square and lines variants)
  float angleRad = uAngle * 3.14159265359 / 180.0;
  
  float result = 0.0;
  
  ${halftoneLogic}
  
  // Apply invert if enabled
  if (uInvert > 0.5) {
    result = 1.0 - result;
  }
  
  gl_FragColor = vec4(result, result, result, 1.0);
}
`;
};

// Create shader definitions for each variant
const createHalftoneShaderDefinition = (variant: HalftoneVariant): ShaderDefinition => ({
  fragmentShaderSource: createHalftoneFragmentShader(variant),
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'uDotSize', type: 'float' },
    { name: 'uAngle', type: 'float' },
    { name: 'uContrast', type: 'float' },
    { name: 'uSpacing', type: 'float' },
    { name: 'uThreshold', type: 'float' },
    { name: 'uInvert', type: 'float' },
  ],
  defaults: {
    dotSize: 5.0,
    angle: 0.0,
    contrast: 1.0,
    spacing: 2.0,
    threshold: 1.0,
  },
  requiresTexture: false,
});

// Register all halftone variants
// Note: We'll use a single 'halftone' type and handle variants in the renderer
// For now, we'll register the ellipse variant as the default
const halftoneDefinition = createHalftoneShaderDefinition('ellipse');
registerShader('halftone', halftoneDefinition);

// Export function to get halftone shader source for a specific variant
export function getHalftoneShaderSource(variant: HalftoneVariant): string {
  return createHalftoneFragmentShader(variant);
}


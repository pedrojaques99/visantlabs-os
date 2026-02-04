/**
 * ASCII Shader
 * Converts images to ASCII art with multiple character sets, contrast, and color options
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_char_size;
uniform float u_contrast;
uniform float u_brightness;
uniform float u_char_set;
uniform float u_colored;
uniform float u_invert;

varying vec2 v_texCoord;

// Character set 0: Blocks (█▓▒░ )
float getBlockChar(float brightness, float x, float y) {
  if (brightness > 0.8) return 1.0;
  if (brightness > 0.6) {
    // ▓ pattern - dense dots
    float pattern = mod(x + y, 2.0);
    return pattern < 1.0 ? 1.0 : 0.0;
  }
  if (brightness > 0.4) {
    // ▒ pattern - medium dots  
    float pattern = mod(x + y * 2.0, 4.0);
    return pattern < 1.0 ? 1.0 : 0.0;
  }
  if (brightness > 0.2) {
    // ░ pattern - sparse dots
    float pattern = mod(x * 3.0 + y * 2.0, 8.0);
    return pattern < 1.0 ? 1.0 : 0.0;
  }
  return 0.0;
}

// Character set 1: Dots (●◉○◌ )
float getDotChar(float brightness, float x, float y) {
  vec2 center = vec2(3.5, 3.5);
  float dist = distance(vec2(x, y), center);
  
  if (brightness > 0.8) {
    return dist < 3.5 ? 1.0 : 0.0;
  }
  if (brightness > 0.6) {
    return dist < 2.5 ? 1.0 : 0.0;
  }
  if (brightness > 0.4) {
    return dist < 1.8 ? 1.0 : 0.0;
  }
  if (brightness > 0.2) {
    return (dist > 1.5 && dist < 2.5) ? 1.0 : 0.0;
  }
  return 0.0;
}

// Character set 2: Lines (║│┃╽ )
float getLineChar(float brightness, float x, float y) {
  if (brightness > 0.8) {
    // Double line
    return (x > 1.0 && x < 3.0) || (x > 4.0 && x < 6.0) ? 1.0 : 0.0;
  }
  if (brightness > 0.6) {
    // Thick line
    return (x > 2.0 && x < 5.0) ? 1.0 : 0.0;
  }
  if (brightness > 0.4) {
    // Medium line
    return (x > 2.5 && x < 4.5) ? 1.0 : 0.0;
  }
  if (brightness > 0.2) {
    // Thin line
    return (x > 3.0 && x < 4.0) ? 1.0 : 0.0;
  }
  return 0.0;
}

// Character set 3: Classic ASCII (@#%*+=-:. )
float getClassicChar(float brightness, float x, float y) {
  // @ character - brightest
  if (brightness > 0.9) {
    if (y == 0.0 || y == 7.0 || x == 0.0 || x == 7.0) return 0.0;
    if (y == 1.0) return (x > 1.0 && x < 6.0) ? 1.0 : 0.0;
    if (y == 2.0 || y == 5.0) return (x == 1.0 || x == 6.0 || (x > 3.0 && x < 6.0 && y == 2.0)) ? 1.0 : 0.0;
    if (y == 3.0) return (x == 1.0 || x == 6.0 || x == 3.0 || x == 5.0) ? 1.0 : 0.0;
    if (y == 4.0) return (x == 1.0 || x == 6.0 || (x > 2.0 && x < 6.0)) ? 1.0 : 0.0;
    if (y == 6.0) return (x > 1.0 && x < 5.0) ? 1.0 : 0.0;
    return 0.0;
  }
  // # character
  if (brightness > 0.8) {
    if (y == 0.0 || y == 7.0) return 0.0;
    if (y == 2.0 || y == 5.0) return (x > 0.0 && x < 7.0) ? 1.0 : 0.0;
    return (x == 2.0 || x == 5.0) ? 1.0 : 0.0;
  }
  // % character
  if (brightness > 0.7) {
    if (y == 1.0) return (x == 1.0 || x == 2.0 || x == 6.0) ? 1.0 : 0.0;
    if (y == 2.0) return (x == 1.0 || x == 2.0 || x == 5.0) ? 1.0 : 0.0;
    if (y == 3.0) return (x == 4.0) ? 1.0 : 0.0;
    if (y == 4.0) return (x == 3.0) ? 1.0 : 0.0;
    if (y == 5.0) return (x == 2.0 || x == 5.0 || x == 6.0) ? 1.0 : 0.0;
    if (y == 6.0) return (x == 1.0 || x == 5.0 || x == 6.0) ? 1.0 : 0.0;
    return 0.0;
  }
  // * character
  if (brightness > 0.55) {
    if (y == 2.0) return (x == 3.0) ? 1.0 : 0.0;
    if (y == 3.0) return (x == 1.0 || x == 3.0 || x == 5.0) ? 1.0 : 0.0;
    if (y == 4.0) return (x == 2.0 || x == 3.0 || x == 4.0) ? 1.0 : 0.0;
    if (y == 5.0) return (x == 1.0 || x == 3.0 || x == 5.0) ? 1.0 : 0.0;
    return 0.0;
  }
  // + character
  if (brightness > 0.4) {
    if (y == 3.0 || y == 4.0) return (x == 3.0 || x == 4.0) ? 1.0 : 0.0;
    if (y == 2.0 || y == 5.0) return (x == 3.0 || x == 4.0) ? 1.0 : 0.0;
    if (y == 3.0 || y == 4.0) return (x > 1.0 && x < 6.0) ? 1.0 : 0.0;
    return 0.0;
  }
  // = character
  if (brightness > 0.3) {
    return (y == 3.0 || y == 5.0) && (x > 1.0 && x < 6.0) ? 1.0 : 0.0;
  }
  // - character
  if (brightness > 0.2) {
    return (y == 4.0) && (x > 1.0 && x < 6.0) ? 1.0 : 0.0;
  }
  // : character
  if (brightness > 0.1) {
    return ((y == 2.0 || y == 5.0) && (x == 3.0 || x == 4.0)) ? 1.0 : 0.0;
  }
  // . character
  if (brightness > 0.05) {
    return (y == 6.0 && (x == 3.0 || x == 4.0)) ? 1.0 : 0.0;
  }
  return 0.0;
}

// Character set 4: Matrix/Hacker (01)
float getMatrixChar(float brightness, float x, float y) {
  if (brightness < 0.15) return 0.0;
  
  // Pseudo-random to pick 0 or 1 based on position
  float rand = fract(sin(dot(vec2(x, y), vec2(12.9898, 78.233))) * 43758.5453);
  bool isOne = rand > 0.5;
  
  if (brightness > 0.5) {
    if (isOne) {
      // 1 character
      if (y == 1.0) return (x == 3.0 || x == 4.0) ? 1.0 : 0.0;
      if (y == 2.0) return (x == 2.0 || x == 3.0 || x == 4.0) ? 1.0 : 0.0;
      if (y >= 3.0 && y <= 5.0) return (x == 3.0 || x == 4.0) ? 1.0 : 0.0;
      if (y == 6.0) return (x >= 2.0 && x <= 5.0) ? 1.0 : 0.0;
    } else {
      // 0 character
      if (y == 1.0 || y == 6.0) return (x >= 2.0 && x <= 5.0) ? 1.0 : 0.0;
      if (y >= 2.0 && y <= 5.0) return (x == 2.0 || x == 5.0) ? 1.0 : 0.0;
    }
  } else {
    // Dimmer version - just dots
    return ((y == 3.0 || y == 4.0) && (x == 3.0 || x == 4.0)) ? 1.0 : 0.0;
  }
  return 0.0;
}

// Character set 5: Braille-like (⣿⣶⣤⣀ )
float getBrailleChar(float brightness, float x, float y) {
  // 2x4 dot pattern
  float dotX = floor(x / 4.0);
  float dotY = floor(y / 2.0);
  float localX = mod(x, 4.0);
  float localY = mod(y, 2.0);
  
  // Calculate threshold for this dot position
  float dotIndex = dotY * 2.0 + dotX;
  float threshold = (dotIndex + 1.0) / 8.0;
  
  if (brightness > threshold) {
    // Draw a small dot
    return (localX > 0.5 && localX < 2.5 && localY < 1.5) ? 1.0 : 0.0;
  }
  return 0.0;
}

void main() {
  vec2 fragCoord = v_texCoord * iResolution;
  vec2 uv = fragCoord / iResolution;
  uv.y = 1.0 - uv.y;
  
  // Character cell size
  float charSize = max(2.0, u_char_size);
  
  // Calculate which character cell we're in
  float cellX = floor(fragCoord.x / charSize);
  float cellY = floor(fragCoord.y / charSize);
  
  // Position within the character cell (0-7 for 8x8 grid)
  float charX = floor(mod(fragCoord.x, charSize) / charSize * 8.0);
  float charY = floor(mod(fragCoord.y, charSize) / charSize * 8.0);
  
  // Sample the center of the character cell
  vec2 cellCenter = vec2(
    (cellX + 0.5) * charSize / iResolution.x,
    1.0 - (cellY + 0.5) * charSize / iResolution.y
  );
  
  vec3 sampleColor = texture2D(iChannel0, cellCenter).rgb;
  
  // Calculate brightness with contrast and brightness adjustments
  float gray = dot(sampleColor, vec3(0.299, 0.587, 0.114));
  
  // Apply contrast (centered around 0.5)
  float contrast = max(0.1, u_contrast);
  gray = (gray - 0.5) * contrast + 0.5;
  
  // Apply brightness offset
  gray = gray + u_brightness;
  
  // Clamp to valid range
  gray = clamp(gray, 0.0, 1.0);
  
  // Apply invert if enabled
  if (u_invert > 0.5) {
    gray = 1.0 - gray;
  }
  
  // Get character pixel based on selected character set
  float charSet = floor(clamp(u_char_set, 0.0, 5.0));
  float pixelValue = 0.0;
  
  if (charSet < 0.5) {
    pixelValue = getBlockChar(gray, charX, charY);
  } else if (charSet < 1.5) {
    pixelValue = getDotChar(gray, charX, charY);
  } else if (charSet < 2.5) {
    pixelValue = getLineChar(gray, charX, charY);
  } else if (charSet < 3.5) {
    pixelValue = getClassicChar(gray, charX, charY);
  } else if (charSet < 4.5) {
    pixelValue = getMatrixChar(gray, charX, charY);
  } else {
    pixelValue = getBrailleChar(gray, charX, charY);
  }
  
  // Output color
  vec3 outputColor;
  if (u_colored > 0.5) {
    // Colored mode - use original color tinted by brightness
    outputColor = sampleColor * pixelValue;
  } else {
    // Grayscale mode
    outputColor = vec3(pixelValue);
  }
  
  gl_FragColor = vec4(outputColor, 1.0);
}
`;

const asciiShaderDefinition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_char_size', type: 'float' },
    { name: 'u_contrast', type: 'float' },
    { name: 'u_brightness', type: 'float' },
    { name: 'u_char_set', type: 'float' },
    { name: 'u_colored', type: 'float' },
    { name: 'u_invert', type: 'float' },
  ],
  defaults: {
    asciiCharSize: 8.0,
    asciiContrast: 1.0,
    asciiBrightness: 0.0,
    asciiCharSet: 3.0,
    asciiColored: 0.0,
    asciiInvert: 0.0,
  },
  requiresTexture: false,
};

// Register the shader
registerShader('ascii', asciiShaderDefinition);

/**
 * Upscale Bicubic Shader
 * Applies bicubic upscaling for high-quality image enlargement
 * Based on Mitchell-Netravali cubic filter (Catmull-Rom spline)
 * Includes Unsharp Mask sharpening to restore detail lost in interpolation
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float uScaleFactor; // Scale factor (2.0, 3.0, 4.0, etc.)
uniform float uSharpening; // Sharpening intensity (0.0 to 1.0)

varying vec2 v_texCoord;

// Mitchell-Netravali cubic filter
// B = 0, C = 0.5 gives Catmull-Rom spline (sharp, good for upscaling)
float cMitchell(float x) {
    const float B = 0.0;
    const float C = 0.5;
    
    float ax = abs(x);
    
    if (ax < 1.0) {
        return ((12.0 - 9.0 * B - 6.0 * C) * ax * ax * ax +
            (-18.0 + 12.0 * B + 6.0 * C) * ax * ax + (6.0 - 2.0 * B)) / 6.0;
    } else if ((ax >= 1.0) && (ax < 2.0)) {
        return ((-B - 6.0 * C) * ax * ax * ax +
            (6.0 * B + 30.0 * C) * ax * ax + (-12.0 * B - 48.0 * C) *
            ax + (8.0 * B + 24.0 * C)) / 6.0;
    } else {
        return 0.0;
    }
}

vec4 bicubic(float x, vec4 c0, vec4 c1, vec4 c2, vec4 c3) {
    vec4 r = vec4(0.0);
    r += c0 * cMitchell(x + 1.0);
    r += c1 * cMitchell(x + 0.0);
    r += c2 * cMitchell(1.0 - x);
    r += c3 * cMitchell(2.0 - x);
    return r;
}

vec4 textureBicubic(sampler2D tex, vec2 res, vec2 t, float bias) {
    t = t * res - 0.5;
    vec2 f = fract(t);
    t = floor(t) + 0.5;
    
    vec4 t0 = bicubic(f.x,
        texture2D(tex, (t + vec2(-1.0, -1.0)) / res, bias),
        texture2D(tex, (t + vec2( 0.0, -1.0)) / res, bias),
        texture2D(tex, (t + vec2( 1.0, -1.0)) / res, bias),
        texture2D(tex, (t + vec2( 2.0, -1.0)) / res, bias));
    
    vec4 t1 = bicubic(f.x,
        texture2D(tex, (t + vec2(-1.0, 0.0)) / res, bias),
        texture2D(tex, (t + vec2( 0.0, 0.0)) / res, bias),
        texture2D(tex, (t + vec2( 1.0, 0.0)) / res, bias),
        texture2D(tex, (t + vec2( 2.0, 0.0)) / res, bias));
    
    vec4 t2 = bicubic(f.x,
        texture2D(tex, (t + vec2(-1.0, 1.0)) / res, bias),
        texture2D(tex, (t + vec2( 0.0, 1.0)) / res, bias),
        texture2D(tex, (t + vec2( 1.0, 1.0)) / res, bias),
        texture2D(tex, (t + vec2( 2.0, 1.0)) / res, bias));
    
    vec4 t3 = bicubic(f.x,
        texture2D(tex, (t + vec2(-1.0, 2.0)) / res, bias),
        texture2D(tex, (t + vec2( 0.0, 2.0)) / res, bias),
        texture2D(tex, (t + vec2( 1.0, 2.0)) / res, bias),
        texture2D(tex, (t + vec2( 2.0, 2.0)) / res, bias));
    
    return bicubic(f.y, t0, t1, t2, t3);
}

// Unsharp Mask sharpening
// Uses a 3x3 Laplacian kernel to detect edges and enhance them
vec3 applyUnsharpMask(vec3 color, sampler2D tex, vec2 uv, vec2 texelSize, float intensity) {
    if (intensity <= 0.0) return color;
    
    // Sample neighboring pixels for edge detection (3x3 kernel)
    vec3 n = texture2D(tex, uv + vec2(0.0, -texelSize.y)).rgb;
    vec3 s = texture2D(tex, uv + vec2(0.0, texelSize.y)).rgb;
    vec3 e = texture2D(tex, uv + vec2(texelSize.x, 0.0)).rgb;
    vec3 w = texture2D(tex, uv + vec2(-texelSize.x, 0.0)).rgb;
    
    // Calculate blur using box filter (average of neighbors)
    vec3 blur = (n + s + e + w) * 0.25;
    
    // Unsharp mask: original + (original - blur) * intensity
    // This enhances edges while preserving overall brightness
    vec3 sharpened = color + (color - blur) * intensity * 2.0;
    
    // Clamp to valid range
    return clamp(sharpened, 0.0, 1.0);
}

void main() {
    vec2 fragCoord = v_texCoord * iResolution;
    vec2 uv = fragCoord / iResolution;
    uv.y = 1.0 - uv.y;
    
    // For upscaling, we want to map the full output quad (0..1) to the full source texture (0..1)
    vec2 sourceUV = uv;
    
    // Use iResolution as the source texture resolution (it represents the original image size)
    // The shader renderer will set iResolution to the output size, so we divide by scaleFactor
    vec2 sourceRes = iResolution.xy / uScaleFactor;
    
    // Apply bicubic upsampling with alpha preservation
    vec4 result = textureBicubic(iChannel0, sourceRes, sourceUV, 0.0);
    
    // Apply unsharp mask sharpening to compensate for bicubic smoothing
    vec2 texelSize = 1.0 / iResolution.xy;
    result.rgb = applyUnsharpMask(result.rgb, iChannel0, sourceUV, texelSize / uScaleFactor, uSharpening);
    
    // Preserve alpha channel
    gl_FragColor = vec4(result.rgb, result.a);
}
`;

const upscaleShaderDefinition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'uScaleFactor', type: 'float' },
    { name: 'uSharpening', type: 'float' },
  ],
  defaults: {
    scaleFactor: 2.0,
    sharpening: 0.3,
  },
  requiresTexture: false,
};

// Register the shader
registerShader('upscale', upscaleShaderDefinition);


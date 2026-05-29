import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float u_line_width;
uniform float u_intensity;
uniform float u_vignette;
uniform float u_curvature;
varying vec2 v_texCoord;

void main() {
  vec2 uv = v_texCoord;
  uv.y = 1.0 - uv.y;

  // CRT barrel curvature
  if (u_curvature > 0.0) {
    vec2 cc = uv - 0.5;
    float dist = dot(cc, cc) * u_curvature;
    uv = uv + cc * dist;
  }

  vec4 c = texture2D(iChannel0, uv);

  // Scanlines
  float scanline = sin(uv.y * iResolution.y * 3.14159 / u_line_width) * 0.5 + 0.5;
  c.rgb *= 1.0 - u_intensity * (1.0 - scanline);

  // Vignette
  vec2 vig = uv * (1.0 - uv);
  c.rgb *= mix(1.0, pow(vig.x * vig.y * 16.0, 0.25), u_vignette);

  // Clamp for curvature edges
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) c = vec4(0.0);

  gl_FragColor = c;
}
`;

const definition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'u_line_width', type: 'float' },
    { name: 'u_intensity', type: 'float' },
    { name: 'u_vignette', type: 'float' },
    { name: 'u_curvature', type: 'float' },
  ],
  defaults: { u_line_width: 2.0, u_intensity: 0.3, u_vignette: 0.3, u_curvature: 0.0 },
};

registerShader('crtScanlines', definition);
export default definition;

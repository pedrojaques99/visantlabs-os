/**
 * VHS Shader
 * Applies VHS/tape effect with tape waves, creases, switching noise, bloom, and AC beat
 */

import { registerShader, type ShaderDefinition } from '../shaderRegistry';

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 iResolution;
uniform sampler2D iChannel0;
uniform float iTime;
uniform float uTapeWaveIntensity;
uniform float uTapeCreaseIntensity;
uniform float uSwitchingNoiseIntensity;
uniform float uBloomIntensity;
uniform float uACBeatIntensity;

varying vec2 v_texCoord;

#define PI 3.14159265

vec3 tex2D( sampler2D _tex, vec2 _p ){
  vec3 col = texture2D( _tex, _p ).xyz;
  if ( 0.5 < abs( _p.x - 0.5 ) ) {
    col = vec3( 0.1 );
  }
  return col;
}

float hash( vec2 _v ){
  return fract( sin( dot( _v, vec2( 89.44, 19.36 ) ) ) * 22189.22 );
}

float iHash( vec2 _v, vec2 _r ){
  float h00 = hash( vec2( floor( _v * _r + vec2( 0.0, 0.0 ) ) / _r ) );
  float h10 = hash( vec2( floor( _v * _r + vec2( 1.0, 0.0 ) ) / _r ) );
  float h01 = hash( vec2( floor( _v * _r + vec2( 0.0, 1.0 ) ) / _r ) );
  float h11 = hash( vec2( floor( _v * _r + vec2( 1.0, 1.0 ) ) / _r ) );
  vec2 ip = vec2( smoothstep( vec2( 0.0, 0.0 ), vec2( 1.0, 1.0 ), mod( _v*_r, 1. ) ) );
  return ( h00 * ( 1. - ip.x ) + h10 * ip.x ) * ( 1. - ip.y ) + ( h01 * ( 1. - ip.x ) + h11 * ip.x ) * ip.y;
}

float noise( vec2 _v ){
  float sum = 0.;
  for( int i=1; i<9; i++ )
  {
    sum += iHash( _v + vec2( float(i) ), vec2( 2. * pow( 2., float( i ) ) ) ) / pow( 2., float( i ) );
  }
  return sum;
}

void main() {
  vec2 fragCoord = v_texCoord * iResolution;
  vec2 uv = fragCoord / iResolution;
  uv.y = 1.0 - uv.y;
  vec2 uvn = uv;
  vec3 col = vec3( 0.0 );

  // tape wave
  uvn.x += ( noise( vec2( uvn.y, iTime ) ) - 0.5 ) * 0.005 * uTapeWaveIntensity;
  uvn.x += ( noise( vec2( uvn.y * 100.0, iTime * 10.0 ) ) - 0.5 ) * 0.01 * uTapeWaveIntensity;

  // tape crease
  float tcPhase = clamp( ( sin( uvn.y * 8.0 - iTime * PI * 1.2 ) - 0.92 ) * noise( vec2( iTime ) ), 0.0, 0.01 ) * 10.0 * uTapeCreaseIntensity;
  float tcNoise = max( noise( vec2( uvn.y * 100.0, iTime * 10.0 ) ) - 0.5, 0.0 );
  uvn.x = uvn.x - tcNoise * tcPhase;

  // switching noise
  float snPhase = smoothstep( 0.03, 0.0, uvn.y );
  uvn.y += snPhase * 0.3 * uSwitchingNoiseIntensity;
  uvn.x += snPhase * ( ( noise( vec2( uv.y * 100.0, iTime * 10.0 ) ) - 0.5 ) * 0.2 * uSwitchingNoiseIntensity );
    
  col = tex2D( iChannel0, uvn );
  col *= 1.0 - tcPhase;
  col = mix(
    col,
    col.yzx,
    snPhase
  );

  // bloom
  for( float x = -4.0; x < 2.5; x += 1.0 ){
    col.xyz += vec3(
      tex2D( iChannel0, uvn + vec2( x - 0.0, 0.0 ) * 7E-3 ).x,
      tex2D( iChannel0, uvn + vec2( x - 2.0, 0.0 ) * 7E-3 ).y,
      tex2D( iChannel0, uvn + vec2( x - 4.0, 0.0 ) * 7E-3 ).z
    ) * 0.1 * uBloomIntensity;
  }
  col *= mix(0.6, 1.0, 1.0 - uBloomIntensity * 0.4);

  // ac beat
  col *= 1.0 + clamp( noise( vec2( 0.0, uv.y + iTime * 0.2 ) ) * 0.6 * uACBeatIntensity - 0.25, 0.0, 0.1 * uACBeatIntensity );

  gl_FragColor = vec4( col, 1.0 );
}
`;

const vhsShaderDefinition: ShaderDefinition = {
  fragmentShaderSource: FRAGMENT_SHADER_SOURCE,
  uniforms: [
    { name: 'iResolution', type: 'vec2' },
    { name: 'iChannel0', type: 'sampler2D' },
    { name: 'iTime', type: 'float' },
    { name: 'uTapeWaveIntensity', type: 'float' },
    { name: 'uTapeCreaseIntensity', type: 'float' },
    { name: 'uSwitchingNoiseIntensity', type: 'float' },
    { name: 'uBloomIntensity', type: 'float' },
    { name: 'uACBeatIntensity', type: 'float' },
  ],
  defaults: {
    tapeWaveIntensity: 1.0,
    tapeCreaseIntensity: 1.0,
    switchingNoiseIntensity: 1.0,
    bloomIntensity: 1.0,
    acBeatIntensity: 1.0,
  },
  requiresTexture: false,
};

// Register the shader
registerShader('vhs', vhsShaderDefinition);


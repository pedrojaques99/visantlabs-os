import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useExtrudedGeometry } from './useExtrudedGeometry';
import { materialPresets } from './materials';

interface ExtrudedSVGProps {
  svgString: string;
  depth: number;
  smoothness: number;
  bevelEnabled?: boolean;
  bevelThickness?: number;
  bevelSize?: number;
  color: string;
  materialSettings: {
    preset: string;
    metalness: number;
    roughness: number;
    opacity: number;
    transparent: boolean;
    wireframe: boolean;
    clearcoat?: number;
    clearcoatRoughness?: number;
    sheen?: number;
    sheenRoughness?: number;
    sheenColor?: string;
    transmission?: number;
    thickness?: number;
    ior?: number;
    iridescence?: number;
    iridescenceIOR?: number;
    reflectivity?: number;
  };
  rotationX: number;
  rotationY: number;
  groupRef: React.RefObject<THREE.Group | null>;
  texture?: string;
  textureRepeat?: number;
  textureRotation?: number;
  textureOpacity?: number;
  textureOffset?: [number, number];
  onLoadingChange?: (loading: boolean, progress: number) => void;
}

export const ExtrudedSVG: React.FC<ExtrudedSVGProps> = ({
  svgString, depth, smoothness, bevelEnabled = true, bevelThickness = 0.5, bevelSize = 0.5,
  color, materialSettings, rotationX, rotationY, groupRef,
  texture: textureUrl, textureRepeat = 1, textureRotation = 0, textureOpacity = 1, textureOffset = [0, 0],
  onLoadingChange,
}) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!textureUrl) { setTexture((prev) => { prev?.dispose(); return null; }); return; }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    loader.load(textureUrl, (tex) => {
      if (cancelled) { tex.dispose(); return; }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture((prev) => { prev?.dispose(); return tex; });
    });
    return () => { cancelled = true; };
  }, [textureUrl]);

  useEffect(() => {
    if (!texture) return;
    texture.offset.set(textureOffset[0], textureOffset[1]);
    texture.repeat.set(textureRepeat, textureRepeat);
    texture.rotation = textureRotation;
    texture.center.set(0.5, 0.5);
    texture.needsUpdate = true;
  }, [texture, textureRepeat, textureRotation, textureOffset]);

  const { geometries, center, baseScale, loading, progress } = useExtrudedGeometry(svgString, depth, smoothness, { bevelEnabled, bevelThickness, bevelSize });

  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;
  useEffect(() => {
    onLoadingChangeRef.current?.(loading, progress);
  }, [loading, progress]);

  const uniformsRef = useRef<{ uTextureOpacity: { value: number } }>({
    uTextureOpacity: { value: textureOpacity }
  });

  useEffect(() => {
    uniformsRef.current.uTextureOpacity.value = textureOpacity;
  }, [textureOpacity]);

  return (
    <group
      ref={groupRef}
      rotation={[rotationX, rotationY, 0]}
      scale={[baseScale, -baseScale, baseScale]}
    >
      {geometries.map((geometry, i) => {
        const preset = materialPresets[materialSettings.preset] ?? materialPresets.default;
        const isGold = materialSettings.preset === 'gold';
        const isEmissive = materialSettings.preset === 'emissive';
        const wantsTransparency = materialSettings.transparent || materialSettings.opacity < 1;
        const baseColor = texture ? (isGold ? '#d4a017' : color) : (isGold ? '#d4a017' : color);
        // We always use the base color, and if texture exists, we blend it in the shader.
        const emissiveColor = isEmissive ? color : '#000000';
        const emissiveIntensity = preset.emissiveIntensity ?? 0;
        const transmissionAmount = wantsTransparency ? 1 - materialSettings.opacity : 0;

        return (
          <mesh
            key={`${i}-${texture ? 'tex' : 'notex'}-${materialSettings.preset}-${wantsTransparency}`}
            geometry={geometry}
            position={[-center.x, -center.y, -center.z]}
          >
            <meshPhysicalMaterial
              color={baseColor}
              map={texture ?? undefined}
              metalness={materialSettings.metalness}
              roughness={wantsTransparency ? Math.max(0.02, materialSettings.roughness * 0.3) : materialSettings.roughness}
              transmission={materialSettings.transmission !== undefined ? materialSettings.transmission : transmissionAmount}
              thickness={materialSettings.thickness !== undefined ? materialSettings.thickness : (wantsTransparency ? 2.5 : 0)}
              ior={materialSettings.ior !== undefined ? materialSettings.ior : (wantsTransparency ? 1.5 : 1.45)}
              opacity={1}
              transparent={false}
              wireframe={materialSettings.wireframe}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity}
              clearcoat={materialSettings.clearcoat !== undefined ? materialSettings.clearcoat : (wantsTransparency ? 1 : preset.clearcoat ?? 0)}
              clearcoatRoughness={materialSettings.clearcoatRoughness !== undefined ? materialSettings.clearcoatRoughness : 0.05}
              sheen={materialSettings.sheen !== undefined ? materialSettings.sheen : 0}
              sheenRoughness={materialSettings.sheenRoughness !== undefined ? materialSettings.sheenRoughness : 0}
              sheenColor={materialSettings.sheenColor !== undefined ? materialSettings.sheenColor : '#000000'}
              iridescence={materialSettings.iridescence !== undefined ? materialSettings.iridescence : 0}
              iridescenceIOR={materialSettings.iridescenceIOR !== undefined ? materialSettings.iridescenceIOR : 1.3}
              reflectivity={materialSettings.reflectivity !== undefined ? materialSettings.reflectivity : 0.5}
              side={THREE.FrontSide}
              envMapIntensity={1}
              onBeforeCompile={(shader) => {
                shader.uniforms.uTextureOpacity = uniformsRef.current.uTextureOpacity;
                shader.fragmentShader = `
                  uniform float uTextureOpacity;
                  ${shader.fragmentShader}
                `.replace(
                  '#include <map_fragment>',
                  `
                  #ifdef USE_MAP
                    vec4 texelColor = texture2D( map, vMapUv );
                    texelColor = mapTexelToLinear( texelColor );
                    // Mix between 1.0 (no texture effect) and the texel color based on opacity
                    diffuseColor.rgb *= mix(vec3(1.0), texelColor.rgb, uTextureOpacity);
                  #endif
                  `
                );
              }}
            />
          </mesh>
        );
      })}
    </group>
  );
};

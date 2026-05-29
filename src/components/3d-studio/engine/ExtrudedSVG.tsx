import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { useExtrudedGeometry } from './useExtrudedGeometry';
import { materialPresets } from './materials';

const CHAIN_MODEL_URL = '/models/iron_chain.glb';

const PendantChain: React.FC<{
  chainScale: number;
  material: React.ReactElement;
  yOffset: number;
}> = ({ chainScale, material, yOffset }) => {
  const { scene } = useGLTF(CHAIN_MODEL_URL);

  const chainMesh = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = undefined as any;
      }
    });
    return clone;
  }, [scene]);

  const box = useMemo(() => new THREE.Box3().setFromObject(scene), [scene]);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const normalizedScale = (4 * chainScale) / Math.max(size.x, size.y, size.z);

  return (
    <group
      position={[0, yOffset, 0]}
      scale={[normalizedScale, normalizedScale, normalizedScale]}
    >
      <group position={[-center.x, -center.y + size.y / 2, -center.z]}>
        {chainMesh.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh).map((mesh, i) => (
          <mesh key={i} geometry={mesh.geometry} position={mesh.position} rotation={mesh.rotation} scale={mesh.scale}>
            {material}
          </mesh>
        ))}
        {chainMesh.children.filter((c) => !(c as THREE.Mesh).isMesh).map((child, i) => (
          <primitive key={`p-${i}`} object={child} />
        ))}
      </group>
    </group>
  );
};

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
  normalMapUrl?: string;
  roughnessMapUrl?: string;
  metalnessMapUrl?: string;
  onLoadingChange?: (loading: boolean, progress: number) => void;
  shapeType?: 'standard' | 'coin' | 'badge' | 'stamp' | 'shield' | 'hexagon' | 'pendant';
  coinRadius?: number;
  badgeWidth?: number;
  badgeHeight?: number;
  badgeRadius?: number;
  stampRadius?: number;
  stampTeeth?: number;
  stampToothDepth?: number;
  shieldWidth?: number;
  shieldHeight?: number;
  hexRadius?: number;
  chainLinks?: number;
  chainScale?: number;
  showChain?: boolean;
}

export const ExtrudedSVG: React.FC<ExtrudedSVGProps> = ({
  svgString, depth, smoothness, bevelEnabled = true, bevelThickness = 0.5, bevelSize = 0.5,
  color, materialSettings, rotationX, rotationY, groupRef,
  texture: textureUrl, textureRepeat = 1, textureRotation = 0, textureOpacity = 1, textureOffset = [0, 0],
  normalMapUrl, roughnessMapUrl, metalnessMapUrl,
  onLoadingChange, shapeType = 'standard',
  coinRadius = 2.2, badgeWidth = 3.6, badgeHeight = 2.4, badgeRadius = 0.4,
  stampRadius = 2.4, stampTeeth = 24, stampToothDepth = 0.25,
  shieldWidth = 2.2, shieldHeight = 2.8, hexRadius = 2.4,
  chainLinks = 6, chainScale = 1, showChain = true,
}) => {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [normalMap, setNormalMap] = useState<THREE.Texture | null>(null);
  const [roughnessMap, setRoughnessMap] = useState<THREE.Texture | null>(null);
  const [metalnessMap, setMetalnessMap] = useState<THREE.Texture | null>(null);

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
    return () => {
      cancelled = true;
      setTexture((prev) => { prev?.dispose(); return null; });
    };
  }, [textureUrl]);

  useEffect(() => {
    if (!normalMapUrl) { setNormalMap((prev) => { prev?.dispose(); return null; }); return; }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    loader.load(normalMapUrl, (tex) => {
      if (cancelled) { tex.dispose(); return; }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      setNormalMap((prev) => { prev?.dispose(); return tex; });
    });
    return () => { cancelled = true; setNormalMap((prev) => { prev?.dispose(); return null; }); };
  }, [normalMapUrl]);

  useEffect(() => {
    if (!roughnessMapUrl) { setRoughnessMap((prev) => { prev?.dispose(); return null; }); return; }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    loader.load(roughnessMapUrl, (tex) => {
      if (cancelled) { tex.dispose(); return; }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      setRoughnessMap((prev) => { prev?.dispose(); return tex; });
    });
    return () => { cancelled = true; setRoughnessMap((prev) => { prev?.dispose(); return null; }); };
  }, [roughnessMapUrl]);

  useEffect(() => {
    if (!metalnessMapUrl) { setMetalnessMap((prev) => { prev?.dispose(); return null; }); return; }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    loader.load(metalnessMapUrl, (tex) => {
      if (cancelled) { tex.dispose(); return; }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      setMetalnessMap((prev) => { prev?.dispose(); return tex; });
    });
    return () => { cancelled = true; setMetalnessMap((prev) => { prev?.dispose(); return null; }); };
  }, [metalnessMapUrl]);

  useEffect(() => {
    if (!texture) return;
    texture.offset.set(textureOffset[0], textureOffset[1]);
    texture.repeat.set(textureRepeat, textureRepeat);
    texture.rotation = textureRotation;
    texture.center.set(0.5, 0.5);
    texture.needsUpdate = true;
  }, [texture, textureRepeat, textureRotation, textureOffset]);

  const isEmbossedShape = shapeType !== 'standard';
  const logoDepth = isEmbossedShape ? 0.15 : depth;
  const logoBevelEnabled = isEmbossedShape ? true : bevelEnabled;
  const logoBevelThickness = isEmbossedShape ? 0.08 : bevelThickness;
  const logoBevelSize = isEmbossedShape ? 0.06 : bevelSize;
  const logoSmoothness = isEmbossedShape ? Math.max(smoothness, 6) : smoothness;

  const { geometries, center, baseScale, loading, progress } = useExtrudedGeometry(svgString, logoDepth, logoSmoothness, {
    bevelEnabled: logoBevelEnabled,
    bevelThickness: logoBevelThickness,
    bevelSize: logoBevelSize,
  });

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

  // Render embossed shape geometries (coin, badge, stamp, shield, hexagon, pendant)
  if (isEmbossedShape) {
    const cylinderHeight = Math.max(0.45, depth * 0.12);
    const reliefDepth = 0.18;

    const preset = materialPresets[materialSettings.preset] ?? materialPresets.default;
    const isGold = materialSettings.preset === 'gold';
    const isEmissive = materialSettings.preset === 'emissive';
    const wantsTransparency = materialSettings.transparent || materialSettings.opacity < 1;
    const baseColor = isGold ? '#d4af37' : color;
    const emissiveColor = isEmissive ? color : '#000000';
    const emissiveIntensity = preset.emissiveIntensity ?? 0;
    const transmissionAmount = wantsTransparency ? 1 - materialSettings.opacity : 0;

    const shapeMaterial = (
      <meshPhysicalMaterial
        color={baseColor}
        map={texture ?? undefined}
        metalness={isGold ? 1.0 : materialSettings.metalness}
        roughness={isGold ? 0.12 : (wantsTransparency ? Math.max(0.02, materialSettings.roughness * 0.3) : materialSettings.roughness)}
        transmission={materialSettings.transmission !== undefined ? materialSettings.transmission : transmissionAmount}
        thickness={materialSettings.thickness !== undefined ? materialSettings.thickness : (wantsTransparency ? 2.5 : 0)}
        ior={isGold ? 2.5 : (materialSettings.ior !== undefined ? materialSettings.ior : (wantsTransparency ? 1.5 : 1.45))}
        opacity={1}
        transparent={false}
        wireframe={materialSettings.wireframe}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        clearcoat={isGold ? 1.0 : (materialSettings.clearcoat !== undefined ? materialSettings.clearcoat : (wantsTransparency ? 1 : preset.clearcoat ?? 0))}
        clearcoatRoughness={isGold ? 0.03 : (materialSettings.clearcoatRoughness !== undefined ? materialSettings.clearcoatRoughness : 0.05)}
        sheen={materialSettings.sheen !== undefined ? materialSettings.sheen : 0}
        sheenRoughness={materialSettings.sheenRoughness !== undefined ? materialSettings.sheenRoughness : 0}
        sheenColor={materialSettings.sheenColor !== undefined ? materialSettings.sheenColor : '#000000'}
        iridescence={isGold ? 0.35 : (materialSettings.iridescence !== undefined ? materialSettings.iridescence : 0)}
        iridescenceIOR={isGold ? 1.6 : (materialSettings.iridescenceIOR !== undefined ? materialSettings.iridescenceIOR : 1.3)}
        reflectivity={isGold ? 0.95 : (materialSettings.reflectivity !== undefined ? materialSettings.reflectivity : 0.5)}
        side={THREE.DoubleSide}
        envMapIntensity={isGold ? 2.2 : 1.2}
      />
    );

    const renderEmbossedLogo = (zOffset: number, flipBack = false) => (
      <group
        scale={[
          baseScale * 0.75 * (flipBack ? -1 : 1),
          -baseScale * 0.75,
          baseScale * (reliefDepth / logoDepth),
        ]}
        position={[0, 0, zOffset]}
        rotation={flipBack ? [0, Math.PI, 0] : undefined}
      >
        {geometries.map((geometry, idx) => (
          <mesh
            key={`${flipBack ? 'back' : 'front'}-${idx}-${materialSettings.preset}`}
            geometry={geometry}
            position={[-center.x, -center.y, -center.z]}
          >
            {shapeMaterial}
          </mesh>
        ))}
      </group>
    );

    const renderBaseShape = () => {
      switch (shapeType) {
        case 'coin':
        case 'pendant': {
          const rimR = coinRadius * 0.91;
          return (
            <>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[coinRadius, coinRadius, cylinderHeight, 64, 1]} />
                {shapeMaterial}
              </mesh>
              <mesh position={[0, 0, cylinderHeight / 2]}>
                <torusGeometry args={[rimR, 0.2, 16, 64]} />
                {shapeMaterial}
              </mesh>
              <mesh position={[0, 0, -cylinderHeight / 2]}>
                <torusGeometry args={[rimR, 0.2, 16, 64]} />
                {shapeMaterial}
              </mesh>
            </>
          );
        }

        case 'badge': {
          const badgeShape = new THREE.Shape();
          const w = badgeWidth, h = badgeHeight, r = Math.min(badgeRadius, badgeWidth / 2, badgeHeight / 2);
          badgeShape.moveTo(-w / 2 + r, -h / 2);
          badgeShape.lineTo(w / 2 - r, -h / 2);
          badgeShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
          badgeShape.lineTo(w / 2, h / 2 - r);
          badgeShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
          badgeShape.lineTo(-w / 2 + r, h / 2);
          badgeShape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
          badgeShape.lineTo(-w / 2, -h / 2 + r);
          badgeShape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
          return (
            <mesh>
              <extrudeGeometry args={[badgeShape, {
                depth: cylinderHeight,
                bevelEnabled: true,
                bevelThickness: 0.12,
                bevelSize: 0.1,
                bevelSegments: 4,
              }]} />
              {shapeMaterial}
            </mesh>
          );
        }

        case 'stamp': {
          const stampShape = new THREE.Shape();
          const tCount = Math.round(stampTeeth);
          for (let i = 0; i <= tCount; i++) {
            const angle = (i / tCount) * Math.PI * 2;
            const r = i % 2 === 0 ? stampRadius : stampRadius - stampToothDepth;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) stampShape.moveTo(x, y);
            else stampShape.lineTo(x, y);
          }
          return (
            <mesh>
              <extrudeGeometry args={[stampShape, {
                depth: cylinderHeight,
                bevelEnabled: true,
                bevelThickness: 0.1,
                bevelSize: 0.08,
                bevelSegments: 3,
              }]} />
              {shapeMaterial}
            </mesh>
          );
        }

        case 'shield': {
          const sw = shieldWidth, sh = shieldHeight;
          const shieldShape = new THREE.Shape();
          shieldShape.moveTo(0, sh);
          shieldShape.bezierCurveTo(sw * 0.55, sh * 0.93, sw, sh * 0.71, sw, sh * 0.43);
          shieldShape.lineTo(sw, sh * 0.07);
          shieldShape.bezierCurveTo(sw, -sh * 0.21, sw * 0.64, -sh * 0.64, 0, -sh);
          shieldShape.bezierCurveTo(-sw * 0.64, -sh * 0.64, -sw, -sh * 0.21, -sw, sh * 0.07);
          shieldShape.lineTo(-sw, sh * 0.43);
          shieldShape.bezierCurveTo(-sw, sh * 0.71, -sw * 0.55, sh * 0.93, 0, sh);
          return (
            <mesh>
              <extrudeGeometry args={[shieldShape, {
                depth: cylinderHeight,
                bevelEnabled: true,
                bevelThickness: 0.15,
                bevelSize: 0.12,
                bevelSegments: 4,
              }]} />
              {shapeMaterial}
            </mesh>
          );
        }

        case 'hexagon': {
          const hexShape = new THREE.Shape();
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
            const x = Math.cos(angle) * hexRadius;
            const y = Math.sin(angle) * hexRadius;
            if (i === 0) hexShape.moveTo(x, y);
            else hexShape.lineTo(x, y);
          }
          hexShape.closePath();
          return (
            <mesh>
              <extrudeGeometry args={[hexShape, {
                depth: cylinderHeight,
                bevelEnabled: true,
                bevelThickness: 0.12,
                bevelSize: 0.1,
                bevelSegments: 3,
              }]} />
              {shapeMaterial}
            </mesh>
          );
        }

        default:
          return null;
      }
    };

    const halfDepth = cylinderHeight / 2;
    const isExtrudedBase = shapeType === 'badge' || shapeType === 'stamp' || shapeType === 'shield' || shapeType === 'hexagon';

    return (
      <group ref={groupRef} rotation={[rotationX, rotationY, 0]}>
        {/* ExtrudeGeometry goes from z=0 to z=depth; shift back by half to center */}
        <group position={[0, 0, isExtrudedBase ? -halfDepth : 0]}>
          {renderBaseShape()}
        </group>
        {renderEmbossedLogo(halfDepth + 0.01)}
        {renderEmbossedLogo(-halfDepth - 0.01, true)}
        {shapeType === 'pendant' && showChain && (
          <PendantChain
            chainScale={chainScale}
            material={shapeMaterial}
            yOffset={2.5}
          />
        )}
      </group>
    );
  }

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
              normalMap={normalMap ?? undefined}
              roughnessMap={roughnessMap ?? undefined}
              metalnessMap={metalnessMap ?? undefined}
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

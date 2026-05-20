import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useExtrudedGeometry } from './useExtrudedGeometry';
import { materialPresets } from './materials';

interface PhysicsFallSimulationProps {
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
  texture?: string;
  textureRepeat?: number;
  textureRotation?: number;
  textureOpacity?: number;
  physicsCount: number;
  physicsGravity: number;
  physicsBounciness: number;
  physicsFriction: number;
  physicsSize: number;
  resetKey: number;
  shapeType?: 'standard' | 'coin';
}

interface PhysicsBody {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  sizeScale: number;
}

export const PhysicsFallSimulation: React.FC<PhysicsFallSimulationProps> = ({
  svgString,
  depth,
  smoothness,
  bevelEnabled = true,
  bevelThickness = 0.5,
  bevelSize = 0.5,
  color,
  materialSettings,
  texture: textureUrl,
  textureRepeat = 1,
  textureRotation = 0,
  textureOpacity = 1,
  physicsCount,
  physicsGravity,
  physicsBounciness,
  physicsFriction,
  physicsSize,
  resetKey,
  shapeType = 'standard',
}) => {
  const { viewport } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Load and configure texture
  useEffect(() => {
    if (!textureUrl) {
      setTexture((prev) => {
        prev?.dispose();
        return null;
      });
      return;
    }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    loader.load(textureUrl, (tex) => {
      if (cancelled) {
        tex.dispose();
        return;
      }
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      setTexture((prev) => {
        prev?.dispose();
        return tex;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [textureUrl]);

  useEffect(() => {
    if (!texture) return;
    texture.repeat.set(textureRepeat, textureRepeat);
    texture.rotation = textureRotation;
    texture.center.set(0.5, 0.5);
    texture.needsUpdate = true;
  }, [texture, textureRepeat, textureRotation]);

  const isCoinShape = shapeType === 'coin';
  const logoDepth = isCoinShape ? 0.15 : depth;
  const logoBevelEnabled = isCoinShape ? true : bevelEnabled;
  const logoBevelThickness = isCoinShape ? 0.08 : bevelThickness;
  const logoBevelSize = isCoinShape ? 0.06 : bevelSize;
  const logoSmoothness = isCoinShape ? Math.max(smoothness, 6) : smoothness;

  const { geometries, center, baseScale, loading, progress } = useExtrudedGeometry(svgString, logoDepth, logoSmoothness, {
    bevelEnabled: logoBevelEnabled,
    bevelThickness: logoBevelThickness,
    bevelSize: logoBevelSize,
  });

  const uniformsRef = useRef<{ uTextureOpacity: { value: number } }>({
    uTextureOpacity: { value: textureOpacity },
  });

  useEffect(() => {
    uniformsRef.current.uTextureOpacity.value = textureOpacity;
  }, [textureOpacity]);

  // Memoize onBeforeCompile to prevent frequent shader recompilation stutters
  const handleBeforeCompile = useCallback((shader: any) => {
    shader.uniforms.uTextureOpacity = uniformsRef.current.uTextureOpacity;
    shader.fragmentShader = `
      uniform float uTextureOpacity;
      ${shader.fragmentShader}
    `.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        vec4 texelColor = texture2D( map, vMapUv );
        diffuseColor.rgb *= mix(vec3(1.0), texelColor.rgb, uTextureOpacity);
      #endif
      `
    );
  }, []);

  // Physics state
  const bodiesRef = useRef<PhysicsBody[]>([]);

  // Initialize/reset bodies
  useEffect(() => {
    const bodies: PhysicsBody[] = [];
    
    // Calculate visual shape dimensions to prevent initial spawn overlap
    let scaledWidth = 4.0;
    let scaledHeight = 4.0;
    if (shapeType === 'coin') {
      scaledWidth = 4.4;
      scaledHeight = 4.4;
    } else if (geometries.length > 0 && geometries[0].boundingBox) {
      const bb = geometries[0].boundingBox;
      const size = new THREE.Vector3();
      bb.getSize(size);
      scaledWidth = size.x * baseScale;
      scaledHeight = size.y * baseScale;
    }
    
    const initialSpacingY = Math.max(2.5, scaledHeight * physicsSize * 1.3);
    
    // Staggered waterfall cascade spawning with true randomized parameters
    for (let i = 0; i < physicsCount; i++) {
      const xRange = viewport.width * 0.85;
      // High horizontal randomness
      const xOffset = (Math.random() - 0.5) * xRange;
      // Staggered height to create beautiful continuous waterfall effect
      const yOffset = viewport.height / 2 + 1.0 + i * (initialSpacingY * 0.6) + (Math.random() - 0.5) * 1.5;
      const zOffset = (Math.random() - 0.5) * 0.15;

      bodies.push({
        id: i,
        x: xOffset,
        y: yOffset,
        z: zOffset,
        vx: (Math.random() - 0.5) * 3.0, // horizontal dispersion
        vy: -1.0 - Math.random() * 3.0, // varying downward speed
        vz: (Math.random() - 0.5) * 0.1,
        rx: 0,
        ry: 0,
        rz: Math.random() * Math.PI * 2, // completely random initial rotation
        vrx: 0,
        vry: 0,
        vrz: (Math.random() - 0.5) * 6.0, // highly dynamic tumbling spin speed
        sizeScale: 0.7 + Math.random() * 0.6, // dynamic size variance between 70% and 130%
      });
    }
    bodiesRef.current = bodies;
  }, [physicsCount, physicsSize, baseScale, geometries, viewport.width, viewport.height, resetKey, shapeType]);

  // Keep references to group meshes to update their positions imperatively for 60fps performance!
  const groupsRef = useRef<(THREE.Group | null)[]>([]);

  useEffect(() => {
    groupsRef.current = groupsRef.current.slice(0, physicsCount);
  }, [physicsCount]);

  useFrame((_, delta) => {
    if (bodiesRef.current.length === 0) return;

    // Calculate dimensions & compound sphere count based on SVG bounding box
    let scaledWidth = 4.0;
    let scaledHeight = 4.0;
    if (shapeType === 'coin') {
      scaledWidth = 4.4;
      scaledHeight = 4.4;
    } else if (geometries.length > 0 && geometries[0].boundingBox) {
      const bb = geometries[0].boundingBox;
      const size = new THREE.Vector3();
      bb.getSize(size);
      scaledWidth = size.x * baseScale;
      scaledHeight = size.y * baseScale;
    }

    const aspect = scaledWidth / (scaledHeight || 1.0);
    const isCoin = shapeType === 'coin';
    // Determine how many overlapping spheres to use to represent visual shape boundary
    const numSpheres = isCoin ? 1 : Math.max(1, Math.min(5, Math.round(aspect * 1.5)));
    const baseSphereRadius = isCoin ? (2.2 * physicsSize) : ((scaledHeight * physicsSize) / 2.0);
    const baseHalfLen = isCoin ? 0 : Math.max(0, (scaledWidth * physicsSize) / 2.0 - baseSphereRadius);

    // Compute normalized local offsets for sub-spheres (scaled by individual body sizeScale in loop)
    const normalizedOffsets: number[] = [];
    if (numSpheres === 1) {
      normalizedOffsets.push(0);
    } else {
      for (let k = 0; k < numSpheres; k++) {
        normalizedOffsets.push(-baseHalfLen + (k / (numSpheres - 1)) * baseHalfLen * 2);
      }
    }

    // Standard substeps for highly stable physics simulation
    const substeps = 4;
    const dt = Math.min(delta, 0.05) / substeps;

    const left = -viewport.width / 2;
    const right = viewport.width / 2;
    const bottom = -viewport.height / 2;
    const top = viewport.height / 2;

    for (let step = 0; step < substeps; step++) {
      // 1. Update positions & apply gravity
      for (const b of bodiesRef.current) {
        b.vy -= physicsGravity * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;

        b.rx += b.vrx * dt;
        b.ry += b.vry * dt;
        b.rz += b.vrz * dt;

        // Air resistance / damping
        b.vx *= 0.99;
        b.vy *= 0.99;
        b.vz *= 0.99;
        b.vrx *= 0.98;
        b.vry *= 0.98;
        b.vrz *= 0.98;
      }

      // 2. Collision with composition borders (floor, left/right walls, ceiling)
      for (const b of bodiesRef.current) {
        const cos = Math.cos(b.rz);
        const sin = Math.sin(b.rz);
        const sphereRadius = baseSphereRadius * b.sizeScale;

        for (let k = 0; k < numSpheres; k++) {
          const lX = normalizedOffsets[k] * b.sizeScale;
          const sx = b.x + lX * cos;
          const sy = b.y + lX * sin;

          // Floor
          if (sy - sphereRadius < bottom) {
            const overlap = bottom - (sy - sphereRadius);
            b.y += overlap;
            b.vy = Math.max(b.vy, -b.vy * physicsBounciness);
            // Translate slide friction to rotation torque
            b.vrz += -b.vx * physicsFriction * 0.08 * (lX || 1.0);
            b.vx *= (1.0 - physicsFriction);
            b.vz *= (1.0 - physicsFriction);
          }

          // Ceiling
          if (sy + sphereRadius > top) {
            const overlap = (sy + sphereRadius) - top;
            b.y -= overlap;
            b.vy = Math.min(b.vy, -b.vy * physicsBounciness);
          }

          // Left wall
          if (sx - sphereRadius < left) {
            const overlap = left - (sx - sphereRadius);
            b.x += overlap;
            b.vx = Math.max(b.vx, -b.vx * physicsBounciness);
            b.vrz -= b.vy * physicsFriction * 0.08;
          }

          // Right wall
          if (sx + sphereRadius > right) {
            const overlap = (sx + sphereRadius) - right;
            b.x -= overlap;
            b.vx = Math.min(b.vx, -b.vx * physicsBounciness);
            b.vrz += b.vy * physicsFriction * 0.08;
          }
        }
      }

      // 3. Dynamic Compound Shape Logo-to-Logo Collisions with mass ratio
      const count = bodiesRef.current.length;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const b1 = bodiesRef.current[i];
          const b2 = bodiesRef.current[j];

          const cos1 = Math.cos(b1.rz);
          const sin1 = Math.sin(b1.rz);
          const cos2 = Math.cos(b2.rz);
          const sin2 = Math.sin(b2.rz);

          const r1 = baseSphereRadius * b1.sizeScale;
          const r2 = baseSphereRadius * b2.sizeScale;
          const minDist = r1 + r2;

          // Check all pairs of sub-spheres for true visual shape boundary collision
          for (let k1 = 0; k1 < numSpheres; k1++) {
            const lX1 = normalizedOffsets[k1] * b1.sizeScale;
            const s1x = b1.x + lX1 * cos1;
            const s1y = b1.y + lX1 * sin1;

            for (let k2 = 0; k2 < numSpheres; k2++) {
              const lX2 = normalizedOffsets[k2] * b2.sizeScale;
              const s2x = b2.x + lX2 * cos2;
              const s2y = b2.y + lX2 * sin2;

              const dx = s2x - s1x;
              const dy = s2y - s1y;
              const distSq = dx * dx + dy * dy;

              if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = minDist - dist;

                const nx = dx / dist;
                const ny = dy / dist;

                // Mass is proportional to size scale squared
                const m1 = b1.sizeScale * b1.sizeScale;
                const m2 = b2.sizeScale * b2.sizeScale;
                const totalMass = m1 + m2;
                const ratio1 = m2 / totalMass;
                const ratio2 = m1 / totalMass;

                // Shift bodies to resolve overlaps based on mass ratio
                b1.x -= nx * overlap * ratio1;
                b1.y -= ny * overlap * ratio1;
                b2.x += nx * overlap * ratio2;
                b2.y += ny * overlap * ratio2;

                // Rotational torque: offset from center creates rotation
                const torque1 = (lX1 * (cos1 * ny - sin1 * nx)) * overlap * 0.2 * ratio1;
                const torque2 = (lX2 * (cos2 * ny - sin2 * nx)) * overlap * 0.2 * ratio2;

                b1.rz -= torque1 * (1.0 - physicsFriction);
                b2.rz += torque2 * (1.0 - physicsFriction);

                // Relative velocity at contact point (linear + angular v)
                const v1cx = b1.vx - b1.vrz * (lX1 * sin1);
                const v1cy = b1.vy + b1.vrz * (lX1 * cos1);
                const v2cx = b2.vx - b2.vrz * (lX2 * sin2);
                const v2cy = b2.vy + b2.vrz * (lX2 * cos2);

                const rvx = v2cx - v1cx;
                const rvy = v2cy - v1cy;
                const velAlongNormal = rvx * nx + rvy * ny;

                // Elastic collision response
                if (velAlongNormal < 0) {
                  const impulse = -(1.0 + physicsBounciness) * velAlongNormal;
                  
                  b1.vx -= nx * impulse * ratio1;
                  b1.vy -= ny * impulse * ratio1;
                  b2.vx += nx * impulse * ratio2;
                  b2.vy += ny * impulse * ratio2;

                  b1.vrz -= torque1 * 0.4;
                  b2.vrz += torque2 * 0.4;
                }
              }
            }
          }
        }
      }
    }

    // 4. Update ThreeJS Scene Group Nodes imperatively (skips React re-renders)
    bodiesRef.current.forEach((b, idx) => {
      const group = groupsRef.current[idx];
      if (group) {
        group.position.set(b.x, b.y, b.z);
        group.rotation.set(b.rx, b.ry, b.rz);
      }
    });
  });

  return (
    <group>
      {Array.from({ length: physicsCount }).map((_, idx) => {
        const body = bodiesRef.current[idx];
        const sizeScale = body ? body.sizeScale : 1.0;

        if (shapeType === 'coin') {
          const cylinderHeight = Math.max(0.45, depth * 0.12);
          const coinRadius = 2.2;
          const reliefDepth = 0.18;

          const preset = materialPresets[materialSettings.preset] ?? materialPresets.default;
          const isGold = materialSettings.preset === 'gold';
          const isEmissive = materialSettings.preset === 'emissive';
          const wantsTransparency = materialSettings.transparent || materialSettings.opacity < 1;
          const baseColor = isGold ? '#d4af37' : color;
          const emissiveColor = isEmissive ? color : '#000000';
          const emissiveIntensity = preset.emissiveIntensity ?? 0;
          const transmissionAmount = wantsTransparency ? 1 - materialSettings.opacity : 0;

          const coinMaterial = (
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
              onBeforeCompile={handleBeforeCompile}
            />
          );

          return (
            <group
              key={idx}
              ref={(el) => {
                groupsRef.current[idx] = el;
              }}
              scale={[physicsSize * sizeScale, -physicsSize * sizeScale, physicsSize * sizeScale]}
            >
              {/* Main Cylinder Base */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[coinRadius, coinRadius, cylinderHeight, 32, 1]} />
                {coinMaterial}
              </mesh>

              {/* Thick Beveled Elevated Torus Rim Borders */}
              <mesh position={[0, 0, cylinderHeight / 2]}>
                <torusGeometry args={[2.0, 0.2, 16, 32]} />
                {coinMaterial}
              </mesh>
              <mesh position={[0, 0, -cylinderHeight / 2]}>
                <torusGeometry args={[2.0, 0.2, 16, 32]} />
                {coinMaterial}
              </mesh>

              {/* High-relief embossed logo front face */}
              <group
                scale={[baseScale * 0.75, -baseScale * 0.75, baseScale * (reliefDepth / logoDepth)]}
                position={[0, 0, cylinderHeight / 2 + 0.01]}
              >
                {geometries.map((geometry, i) => (
                  <mesh
                    key={`front-${i}`}
                    geometry={geometry}
                    position={[-center.x, -center.y, -center.z]}
                  >
                    {coinMaterial}
                  </mesh>
                ))}
              </group>

              {/* High-relief embossed logo back face */}
              <group
                scale={[-baseScale * 0.75, -baseScale * 0.75, baseScale * (reliefDepth / logoDepth)]}
                position={[0, 0, -cylinderHeight / 2 - 0.01]}
                rotation={[0, Math.PI, 0]}
              >
                {geometries.map((geometry, i) => (
                  <mesh
                    key={`back-${i}`}
                    geometry={geometry}
                    position={[-center.x, -center.y, -center.z]}
                  >
                    {coinMaterial}
                  </mesh>
                ))}
              </group>
            </group>
          );
        }

        return (
          <group
            key={idx}
            ref={(el) => {
              groupsRef.current[idx] = el;
            }}
            scale={[baseScale * physicsSize * sizeScale, -baseScale * physicsSize * sizeScale, baseScale * physicsSize * sizeScale]}
          >
            {geometries.map((geometry, i) => {
              const preset = materialPresets[materialSettings.preset] ?? materialPresets.default;
              const isGoldPreset = materialSettings.preset === 'gold';
              const wantsTransparency = materialSettings.transparent || materialSettings.opacity < 1;
              const baseColor = isGoldPreset ? '#d4a017' : color;
              const isEmissive = materialSettings.preset === 'emissive';
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
                    envMapIntensity={1.0}
                    onBeforeCompile={handleBeforeCompile}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

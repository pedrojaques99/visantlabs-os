import React, { useRef, useEffect, useState, useMemo } from 'react';
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

  const { geometries, center, baseScale } = useExtrudedGeometry(svgString, depth, smoothness, {
    bevelEnabled,
    bevelThickness,
    bevelSize,
  });

  const uniformsRef = useRef<{ uTextureOpacity: { value: number } }>({
    uTextureOpacity: { value: textureOpacity },
  });

  useEffect(() => {
    uniformsRef.current.uTextureOpacity.value = textureOpacity;
  }, [textureOpacity]);

  // Physics state
  const bodiesRef = useRef<PhysicsBody[]>([]);

  // Initialize/reset bodies
  useEffect(() => {
    const bodies: PhysicsBody[] = [];
    const radius = physicsSize * baseScale * 1.5;
    
    // Grid-like layout for spawning from top to avoid massive overlap immediately
    const cols = 5;
    for (let i = 0; i < physicsCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      
      const xRange = viewport.width * 0.7;
      const xOffset = -xRange / 2 + (col / (cols - 1 || 1)) * xRange + (Math.random() - 0.5) * 0.5;
      const yOffset = viewport.height / 2 + 2 + row * (radius * 2.2) + Math.random() * 0.5;
      const zOffset = (Math.random() - 0.5) * 0.3;

      bodies.push({
        id: i,
        x: xOffset,
        y: yOffset,
        z: zOffset,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random() * 2,
        vz: (Math.random() - 0.5) * 0.5,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rz: Math.random() * Math.PI * 2,
        vrx: (Math.random() - 0.5) * 3,
        vry: (Math.random() - 0.5) * 3,
        vrz: (Math.random() - 0.5) * 3,
      });
    }
    bodiesRef.current = bodies;
  }, [physicsCount, physicsSize, baseScale, viewport.width, viewport.height, resetKey]);

  // Keep references to group meshes to update their positions imperatively for 60fps performance!
  const groupsRef = useRef<(THREE.Group | null)[]>([]);

  useFrame((_, delta) => {
    if (bodiesRef.current.length === 0) return;

    // Standard substeps for highly stable physics simulation
    const substeps = 4;
    const dt = Math.min(delta, 0.05) / substeps;
    const radius = physicsSize * baseScale * 1.2;

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
        // Floor
        if (b.y - radius < bottom) {
          b.y = bottom + radius;
          b.vy = -b.vy * physicsBounciness;
          b.vx *= 1 - physicsFriction;
          b.vz *= 1 - physicsFriction;
          // Friction torque translation: roll when hitting the floor
          b.vrz += b.vx * 0.15;
          b.vrx += b.vz * 0.15;
        }
        // Left wall
        if (b.x - radius < left) {
          b.x = left + radius;
          b.vx = -b.vx * physicsBounciness;
          b.vy *= 1 - physicsFriction;
          b.vry += b.vy * 0.1;
        }
        // Right wall
        if (b.x + radius > right) {
          b.x = right - radius;
          b.vx = -b.vx * physicsBounciness;
          b.vy *= 1 - physicsFriction;
          b.vry -= b.vy * 0.1;
        }
      }

      // 3. Logo-to-Logo collisions
      const count = bodiesRef.current.length;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const b1 = bodiesRef.current[i];
          const b2 = bodiesRef.current[j];

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dz = b2.z - b1.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const minDist = radius * 2.1; // slightly larger collision envelope for stability

          if (dist < minDist && dist > 0.001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            // Push apart proportional to overlap (equal mass)
            const push = overlap * 0.5;
            b1.x -= nx * push;
            b1.y -= ny * push;
            b1.z -= nz * push;
            b2.x += nx * push;
            b2.y += ny * push;
            b2.z += nz * push;

            // Relative velocity along collision normal
            const rvx = b2.vx - b1.vx;
            const rvy = b2.vy - b1.vy;
            const rvz = b2.vz - b1.vz;
            const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

            // Only bounce if they are moving towards each other
            if (velAlongNormal < 0) {
              const impulse = -(1 + physicsBounciness) * velAlongNormal;
              
              // Apply impulse forces to change velocities
              b1.vx -= nx * impulse * 0.5;
              b1.vy -= ny * impulse * 0.5;
              b1.vz -= nz * impulse * 0.5;
              b2.vx += nx * impulse * 0.5;
              b2.vy += ny * impulse * 0.5;
              b2.vz += nz * impulse * 0.5;

              // Introduce spin transfer on collision to look real
              const torqueScale = 0.2;
              b1.vrx += (Math.random() - 0.5) * torqueScale;
              b1.vry += (Math.random() - 0.5) * torqueScale;
              b1.vrz += (Math.random() - 0.5) * torqueScale;
              b2.vrx -= (Math.random() - 0.5) * torqueScale;
              b2.vry -= (Math.random() - 0.5) * torqueScale;
              b2.vrz -= (Math.random() - 0.5) * torqueScale;
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
      {Array.from({ length: physicsCount }).map((_, idx) => (
        <group
          key={idx}
          ref={(el) => {
            groupsRef.current[idx] = el;
          }}
          scale={[baseScale * physicsSize, -baseScale * physicsSize, baseScale * physicsSize]}
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
      ))}
    </group>
  );
};

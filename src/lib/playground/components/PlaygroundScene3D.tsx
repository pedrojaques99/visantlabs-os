import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, OrbitControls, Text3D, Center } from '@react-three/drei';
import * as THREE from 'three';
import { materialPresets } from '@/components/3d-studio/engine/materials';

interface PlaygroundScene3DProps {
  mode: 'text' | 'shape';
  input: string;
  shape?: string;
  material: string;
  color: string;
  animation: string;
  depth: number;
}

// Three.js typeface JSON format — helvetiker is bundled with three-stdlib
const FONT_URL =
  'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/fonts/helvetiker_bold.typeface.json';

const SHAPE_GEOMETRIES: Record<string, () => THREE.BufferGeometry> = {
  coin: () => new THREE.CylinderGeometry(1.5, 1.5, 0.15, 64),
  badge: () => new THREE.CylinderGeometry(1.2, 1.2, 0.1, 6),
  stamp: () => new THREE.BoxGeometry(2.4, 0.2, 2.4),
  shield: () => new THREE.ConeGeometry(1.2, 2.4, 4),
  hexagon: () => new THREE.CylinderGeometry(1.3, 1.3, 0.2, 6),
  pendant: () => new THREE.TorusGeometry(1, 0.3, 16, 100),
};

function MaterialProps({ material, color }: { material: string; color: string }) {
  const preset = materialPresets[material] || materialPresets.default;
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={preset.metalness}
      roughness={preset.roughness}
      opacity={preset.opacity}
      transparent={preset.transparent}
      emissiveIntensity={preset.emissiveIntensity || 0}
      emissive={preset.emissiveIntensity ? color : '#000000'}
      clearcoat={preset.clearcoat || 0}
      clearcoatRoughness={preset.clearcoatRoughness || 0}
      sheen={preset.sheen || 0}
      sheenRoughness={preset.sheenRoughness || 0}
      transmission={preset.transmission || 0}
      ior={preset.ior || 1.5}
      iridescence={preset.iridescence || 0}
    />
  );
}

function useAnimation(
  meshRef: React.RefObject<THREE.Mesh | THREE.Group | null>,
  animation: string
) {
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    switch (animation) {
      case 'spin':
        meshRef.current.rotation.y = t * 0.5;
        break;
      case 'float':
        meshRef.current.position.y = Math.sin(t) * 0.3;
        meshRef.current.rotation.y = t * 0.2;
        break;
      case 'pulse': {
        const s = 1 + Math.sin(t * 2) * 0.05;
        meshRef.current.scale.set(s, s, s);
        meshRef.current.rotation.y = t * 0.3;
        break;
      }
      case 'wobble':
        meshRef.current.rotation.x = Math.sin(t * 1.5) * 0.1;
        meshRef.current.rotation.z = Math.cos(t * 1.5) * 0.1;
        meshRef.current.rotation.y = t * 0.4;
        break;
    }
  });
}

function TextMesh({
  text,
  depth,
  material,
  color,
  animation,
}: {
  text: string;
  depth: number;
  material: string;
  color: string;
  animation: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useAnimation(groupRef, animation);

  return (
    <group ref={groupRef}>
      <Center>
        <Text3D
          font={FONT_URL}
          size={1}
          height={depth / 100}
          bevelEnabled
          bevelThickness={0.02}
          bevelSize={0.02}
          bevelSegments={3}
          castShadow
        >
          {text}
          <MaterialProps material={material} color={color} />
        </Text3D>
      </Center>
    </group>
  );
}

function ShapeMesh({
  shape,
  material,
  color,
  animation,
}: {
  shape: string;
  material: string;
  color: string;
  animation: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  useAnimation(meshRef, animation);

  const geometry = useMemo(() => {
    const factory = SHAPE_GEOMETRIES[shape] || SHAPE_GEOMETRIES.coin;
    return factory();
  }, [shape]);

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow>
      <MaterialProps material={material} color={color} />
    </mesh>
  );
}

export default function PlaygroundScene3D({
  mode,
  input,
  shape,
  material,
  color,
  animation,
  depth,
}: PlaygroundScene3DProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 2, 5], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <pointLight position={[-5, 3, -5]} intensity={0.5} color="#00e5ff" />

      <Suspense fallback={null}>
        {mode === 'text' ? (
          <TextMesh
            text={input || 'Visant'}
            depth={depth}
            material={material}
            color={color}
            animation={animation}
          />
        ) : (
          <ShapeMesh
            shape={shape || 'coin'}
            material={material}
            color={color}
            animation={animation}
          />
        )}
      </Suspense>

      <ContactShadows position={[0, -1.5, 0]} opacity={0.4} blur={2} />
      <Environment preset="studio" />
      <OrbitControls enablePan={false} enableZoom={true} minDistance={3} maxDistance={10} />
    </Canvas>
  );
}

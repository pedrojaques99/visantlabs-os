import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { setCameraView } from './CameraBridge';
import { useIsMobile } from '@/hooks/use-media-query';

const AXIS_CONFIG = [
  { label: 'X', color: '#ff3366', dir: [1, 0, 0] as const, view: 'right' },
  { label: 'Y', color: '#00ff88', dir: [0, 1, 0] as const, view: 'top' },
  { label: 'Z', color: '#4a9eff', dir: [0, 0, 1] as const, view: 'front' },
];

function AxisLine({ color, dir }: { color: string; dir: readonly [number, number, number] }) {
  const points = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(dir[0] * 0.8, dir[1] * 0.8, dir[2] * 0.8)],
    [dir]
  );
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const line = useMemo(() => {
    const l = new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 })
    );
    return l;
  }, [geom, color]);
  return <primitive object={line} />;
}

function AxisHead({
  color,
  dir,
  view,
  label,
}: {
  color: string;
  dir: readonly [number, number, number];
  view: string;
  label: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pos: [number, number, number] = [dir[0] * 0.9, dir[1] * 0.9, dir[2] * 0.9];
  const negPos: [number, number, number] = [-dir[0] * 0.9, -dir[1] * 0.9, -dir[2] * 0.9];

  return (
    <>
      {/* Positive head */}
      <mesh
        ref={meshRef}
        position={pos}
        onClick={(e) => {
          e.stopPropagation();
          setCameraView(view);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      {/* Negative head — smaller, dimmer */}
      <mesh
        position={negPos}
        onClick={(e) => {
          e.stopPropagation();
          setCameraView(view);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={color} transparent opacity={0.4} />
      </mesh>
    </>
  );
}

function GizmoScene() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const { rotationX, rotationY } = useStudio3DStore.getState();
    groupRef.current.rotation.x = rotationX;
    groupRef.current.rotation.y = rotationY;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 2, 3]} intensity={1} />
      <group ref={groupRef}>
        {AXIS_CONFIG.map((axis) => (
          <React.Fragment key={axis.label}>
            <AxisLine color={axis.color} dir={axis.dir} />
            <AxisHead color={axis.color} dir={axis.dir} view={axis.view} label={axis.label} />
          </React.Fragment>
        ))}
        {/* Center sphere */}
        <mesh>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      </group>
    </>
  );
}

export const ViewGizmo: React.FC = React.memo(() => {
  const isMobile = useIsMobile();
  const size = isMobile ? 70 : 90;
  return (
    <div
      className="absolute bottom-14 left-3 z-20 pointer-events-auto"
      style={{ width: size, height: size }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.2], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <GizmoScene />
      </Canvas>
    </div>
  );
});

ViewGizmo.displayName = 'ViewGizmo';

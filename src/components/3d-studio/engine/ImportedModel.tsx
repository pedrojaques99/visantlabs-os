import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

interface ImportedModelProps {
  url: string;
  groupRef: React.RefObject<THREE.Group | null>;
  rotationX: number;
  rotationY: number;
  objectScale: number;
  overrideColor?: string;
  overrideMetalness?: number;
  overrideRoughness?: number;
  overrideWireframe?: boolean;
  overrideOpacity?: number;
}

export const ImportedModel: React.FC<ImportedModelProps> = ({
  url, groupRef, rotationX, rotationY, objectScale,
  overrideColor, overrideMetalness, overrideRoughness, overrideWireframe, overrideOpacity,
}) => {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 4 / maxDim;
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    return clone;
  }, [scene]);

  useEffect(() => {
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const mat = mesh.material;
      if (!mat || Array.isArray(mat)) return;
      const m = mat as THREE.MeshStandardMaterial;
      if (overrideColor) m.color.set(overrideColor);
      if (overrideMetalness !== undefined) m.metalness = overrideMetalness;
      if (overrideRoughness !== undefined) m.roughness = overrideRoughness;
      if (overrideWireframe !== undefined) m.wireframe = overrideWireframe;
      if (overrideOpacity !== undefined) {
        m.opacity = overrideOpacity;
        m.transparent = overrideOpacity < 1;
      }
      m.needsUpdate = true;
    });
  }, [cloned, overrideColor, overrideMetalness, overrideRoughness, overrideWireframe, overrideOpacity]);

  return (
    <group ref={groupRef} rotation={[rotationX, rotationY, 0]} scale={objectScale}>
      <primitive object={cloned} />
    </group>
  );
};

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

interface ImportedModelProps {
  url: string;
  groupRef: React.RefObject<THREE.Group | null>;
  rotationX: number;
  rotationY: number;
  objectScale: number;
}

export const ImportedModel: React.FC<ImportedModelProps> = ({
  url, groupRef, rotationX, rotationY, objectScale,
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

  return (
    <group ref={groupRef} rotation={[rotationX, rotationY, 0]} scale={objectScale}>
      <primitive object={cloned} />
    </group>
  );
};

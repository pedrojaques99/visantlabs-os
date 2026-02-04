import { Suspense, useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useMediaQuery } from '@/hooks/use-media-query';

interface ClubLogo3DProps {
  isMobile: boolean;
  modelUrl?: string;
  color?: string;
  starColor?: string;
}

interface StarsProps {
  color: string;
}

function Stars({ color }: StarsProps) {
  const count = 200;
  const mesh = useRef<THREE.Points>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const sizes = useRef(new Float32Array(count));

  // Generate random positions for stars
  const positions = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 15 + Math.random() * 5; // Stars between 15-20 units away
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Initialize sizes
      sizes.current[i] = 0.2;
    }
    return positions;
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Convert mouse position to normalized device coordinates
      mousePosition.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: -(event.clientY / window.innerHeight) * 2 + 1
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame((state, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.05;

      // Update particle sizes based on distance from cursor
      const positions = mesh.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];

        // Calculate distance from cursor in normalized device coordinates
        const dx = x - mousePosition.current.x;
        const dy = y - mousePosition.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Smoothly transition size based on distance
        const targetSize = distance < 0.3 ? 0.4 : 0.2;
        sizes.current[i] += (targetSize - sizes.current[i]) * 0.1;
      }

      // Update the geometry
      mesh.current.geometry.attributes.size.needsUpdate = true;
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes.current}
          itemSize={1}
          args={[sizes.current, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        color={color}
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
        vertexColors={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

interface ModelProps {
  url: string;
  color: string;
}

function Model({ url, color }: ModelProps) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Group>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isSmallScreen = useMediaQuery('(max-width: 640px)');

  // Add thickness to flat geometries
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geometry = child.geometry;

          // Check if geometry is flat and add thickness
          if (geometry instanceof THREE.BufferGeometry) {
            const positions = geometry.attributes.position;
            if (positions) {
              // Calculate bounding box to detect if model is flat
              const box = new THREE.Box3();
              box.setFromBufferAttribute(positions);
              const size = box.getSize(new THREE.Vector3());
              const minDim = Math.min(size.x, size.y, size.z);
              const maxDim = Math.max(size.x, size.y, size.z);

              // If model is flat (one dimension is very small), add thickness
              if (minDim < maxDim * 0.05) {
                const thickness = maxDim * 0.1; // 10% of max dimension
                const count = positions.count;
                const newPositions = new Float32Array(count * 2 * 3);

                // Copy original positions (front face)
                for (let i = 0; i < count; i++) {
                  const i3 = i * 3;
                  newPositions[i3] = positions.getX(i);
                  newPositions[i3 + 1] = positions.getY(i);
                  newPositions[i3 + 2] = positions.getZ(i);
                }

                // Create back face by offsetting in Z
                for (let i = 0; i < count; i++) {
                  const i3 = (count + i) * 3;
                  newPositions[i3] = positions.getX(i);
                  newPositions[i3 + 1] = positions.getY(i);
                  newPositions[i3 + 2] = positions.getZ(i) + thickness;
                }

                // Create new geometry
                const newGeometry = new THREE.BufferGeometry();
                newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));

                // Copy normals if they exist
                if (geometry.attributes.normal) {
                  const normals = geometry.attributes.normal;
                  const newNormals = new Float32Array(count * 2 * 3);
                  for (let i = 0; i < count; i++) {
                    const i3 = i * 3;
                    newNormals[i3] = normals.getX(i);
                    newNormals[i3 + 1] = normals.getY(i);
                    newNormals[i3 + 2] = normals.getZ(i);
                  }
                  for (let i = 0; i < count; i++) {
                    const i3 = (count + i) * 3;
                    newNormals[i3] = normals.getX(i);
                    newNormals[i3 + 1] = normals.getY(i);
                    newNormals[i3 + 2] = normals.getZ(i);
                  }
                  newGeometry.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
                } else {
                  newGeometry.computeVertexNormals();
                }

                // Create indices for both faces and sides
                const index = geometry.getIndex();
                const indices: number[] = [];

                if (index) {
                  const indexArray = index.array;
                  const indexCount = index.count;

                  // Front face indices (original)
                  for (let i = 0; i < indexCount; i++) {
                    indices.push(indexArray[i]);
                  }

                  // Back face indices (reversed)
                  for (let i = indexCount - 1; i >= 0; i -= 3) {
                    indices.push(indexArray[i - 2] + count, indexArray[i - 1] + count, indexArray[i] + count);
                  }

                  // Side faces (connect front and back)
                  for (let i = 0; i < indexCount; i += 3) {
                    const v0 = indexArray[i];
                    const v1 = indexArray[i + 1];
                    const v2 = indexArray[i + 2];

                    // Create side faces
                    indices.push(v0, v0 + count, v1);
                    indices.push(v1, v0 + count, v1 + count);
                    indices.push(v1, v1 + count, v2);
                    indices.push(v2, v1 + count, v2 + count);
                    indices.push(v2, v2 + count, v0);
                    indices.push(v0, v2 + count, v0 + count);
                  }
                } else {
                  // No index, assume triangles
                  const triangleCount = count / 3;
                  for (let i = 0; i < triangleCount; i++) {
                    const base = i * 3;
                    // Front
                    indices.push(base, base + 1, base + 2);
                    // Back
                    indices.push(base + 2 + count, base + 1 + count, base + count);
                    // Sides
                    indices.push(base, base + count, base + 1);
                    indices.push(base + 1, base + count, base + 1 + count);
                    indices.push(base + 1, base + 1 + count, base + 2);
                    indices.push(base + 2, base + 1 + count, base + 2 + count);
                    indices.push(base + 2, base + 2 + count, base);
                    indices.push(base, base + 2 + count, base + count);
                  }
                }

                newGeometry.setIndex(indices);
                child.geometry = newGeometry;
              }
            }
          }

          // Apply material with semi-metallic black appearance
          child.material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: '#FFFFFFFF',
            emissiveIntensity: 0.7,
            metalness: 0.7,
            roughness: 0.15,
            opacity: 0.8,
            transparent: true,
            side: THREE.DoubleSide,
            envMapIntensity: 1.5,
          });
        }
      });
    }
  }, [scene, color]);

  useEffect(() => {
    if (modelRef.current) {
      // Center and scale the model
      const box = new THREE.Box3().setFromObject(modelRef.current);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      // Calculate scale based on screen size and model dimensions
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = isMobile ?
        (isSmallScreen ? 6 : 8) :
        10;

      modelRef.current.position.set(-center.x, -center.y, -center.z);
      modelRef.current.scale.set(scale, scale, scale);
    }
  }, [isMobile, isSmallScreen, scene]);

  return <primitive ref={modelRef} object={scene} />;
}

export default function ClubLogo3D({
  isMobile,
  modelUrl = '/models/visant-3d-simple-2.glb',
  color = '#1a1a1a',
  starColor = '#4B4B4BFF'
}: ClubLogo3DProps) {
  const isSmallScreen = useMediaQuery('(max-width: 640px)');
  const isMediumScreen = useMediaQuery('(max-width: 768px)');
  const [cursor, setCursor] = useState(isMobile ? 'default' : 'grab');

  // Calculate camera position based on screen size
  const cameraPosition = useMemo(() => {
    if (isSmallScreen) return new THREE.Vector3(10, -20, 15);
    if (isMediumScreen) return new THREE.Vector3(10, -10, 18);
    return new THREE.Vector3(0, 0, 20);
  }, [isSmallScreen, isMediumScreen]);

  const controlsTarget = useMemo(() => {
    return new THREE.Vector3(0, isSmallScreen ? -2 : -1, 0);
  }, [isSmallScreen]);

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Canvas
        camera={{
          position: cameraPosition,
          fov: isSmallScreen ? 50 : 45,
          near: 0.1,
          far: 200
        }}
        gl={{ alpha: true, antialias: true }}
        style={{
          width: '100%',
          height: '100%',
          cursor,
          touchAction: isMobile ? 'none' : 'auto',
          background: 'transparent'
        }}
        onPointerDown={() => {
          if (!isMobile) {
            setCursor('grabbing');
          }
        }}
        onPointerUp={() => {
          if (!isMobile) {
            setCursor('grab');
          }
        }}
        onPointerLeave={() => {
          if (!isMobile) {
            setCursor('grab');
          }
        }}
      >
        <Suspense fallback={null}>
          <Environment preset="city" />
          <ambientLight intensity={isSmallScreen ? 0.8 : 0.6} />
          <pointLight position={[10, 10, 10]} intensity={1.2} />
          <pointLight position={[-10, 10, -10]} intensity={1} />
          <pointLight position={[0, 15, 0]} intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <Stars color={starColor} />
          <Model url={modelUrl} color={color} />
          <OrbitControls
            enableZoom={false}
            enablePan={!isMobile}
            enableRotate={!isMobile}
            autoRotate={true}
            autoRotateSpeed={0.9}
            minDistance={isSmallScreen ? 8 : 5}
            maxDistance={isSmallScreen ? 15 : 20}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2}
            target={controlsTarget}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}


import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, Environment, ContactShadows, PresentationControls } from '@react-three/drei';
import * as THREE from 'three';

// Minimal 3D Logo Mesh
const LogoMesh = ({ scale = 2.8, isMobile = false }: { scale?: number, isMobile?: boolean }) => {
    const { scene } = useGLTF('/models/visant-3d-simple-2.glb');
    const meshRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (meshRef.current) {
            // Very slow continuous rotation
            meshRef.current.rotation.y += 0.001;

            // Mouse Parallax (only subtle, not to fight with drag)
            const targetX = -state.mouse.y * 0.05;
            const targetY = state.mouse.x * 0.05;
            meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetX, 0.02);
            meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, -targetY * 0.2, 0.02);
        }
    });

    useEffect(() => {
        if (scene) {
            scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (isMobile) {
                        // High Performance Material for Mobile
                        child.material = new THREE.MeshStandardMaterial({
                            color: '#ffffff',
                            metalness: 0.8,
                            roughness: 0.2,
                            emissive: '#52ddeb',
                            emissiveIntensity: 0.5,
                        });
                    } else {
                        // Premium Material for Desktop
                        child.material = new THREE.MeshPhysicalMaterial({
                            color: '#ffffff',
                            metalness: 0.05,
                            roughness: 0.05,
                            transmission: 1.2,
                            thickness: 1.5,
                            ior: 2.2,
                            clearcoat: 1,
                            clearcoatRoughness: 0.1,
                            emissive: '#52ddeb',
                            emissiveIntensity: 0.8,
                        });
                    }
                }
            });
        }
    }, [scene, isMobile]);

    return <primitive ref={meshRef} object={scene} scale={scale} position={[0, 0, 0]} />;
};

// Dynamic Mouse Light
const MouseLight = () => {
    const lightRef = useRef<THREE.PointLight>(null);
    useFrame((state) => {
        if (lightRef.current) {
            lightRef.current.position.x = state.mouse.x * 1;
            lightRef.current.position.y = state.mouse.y * 1;
        }
    });
    return <pointLight ref={lightRef} intensity={10} color="#52ddeb" distance={10} />;
};

export const VisantLogo3D: React.FC = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <Canvas
            camera={{ position: [0, 0, 10], fov: isMobile ? 120 : 100 }}
            dpr={isMobile ? [1, 1.5] : [1, 2]}
            gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
        >
            <Suspense fallback={
                <div className="text-white font-mono text-[10px] uppercase tracking-[0.2em] opacity-30 animate-pulse flex flex-col items-center gap-2">
                    <div className="w-4 h-[1px] bg-white/50" />
                    LOADING SYSTEM
                </div>
            }>
                <ambientLight intensity={isMobile ? 1.5 : 1} />
                <MouseLight />
                {!isMobile && <Environment preset="city" />}

                <PresentationControls
                    global
                    snap={false}
                    rotation={[0, 0, 0]}
                    polar={[-Math.PI / 3, Math.PI / 3]}
                    azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}
                >
                    <Float speed={isMobile ? 1 : 1.5} rotationIntensity={0.2} floatIntensity={0.5}>
                        <LogoMesh isMobile={isMobile} scale={isMobile ? 2.8 : 10} />
                    </Float>
                </PresentationControls>

                {!isMobile && (
                    <ContactShadows
                        opacity={0.4}
                        scale={30}
                        blur={2}
                        far={10}
                        resolution={256}
                        color="#000000"
                        position={[0, -4, 0]}
                    />
                )}
            </Suspense>
        </Canvas>
    );
};

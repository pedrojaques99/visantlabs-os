import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, Environment, ContactShadows, PresentationControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// Minimal 3D Logo Mesh
const LogoMesh = ({ scale = 2.8, isMobile = false }: { scale?: number, isMobile?: boolean }) => {
    const { scene } = useGLTF('/models/visant-3d-simple-2.glb');
    const meshRef = useRef<THREE.Group>(null);

    // Rotation and interaction are now handled by PresentationControls and Float
    // to avoid conflicts with manual useFrame updates
    useFrame(() => {});

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

// Reimagined Mouse Light - Cinematic Dual Highlights
const MouseLight = ({ isMobile = false }: { isMobile?: boolean }) => {
    const mainLightRef = useRef<THREE.PointLight>(null);
    const secondaryLightRef = useRef<THREE.PointLight>(null);
    
    useFrame((state) => {
        // Main cyan light follows mouse closely
        if (mainLightRef.current) {
            mainLightRef.current.position.x = THREE.MathUtils.lerp(mainLightRef.current.position.x, state.mouse.x * 6, isMobile ? 0.05 : 0.1);
            mainLightRef.current.position.y = THREE.MathUtils.lerp(mainLightRef.current.position.y, state.mouse.y * 6, isMobile ? 0.05 : 0.1);
            mainLightRef.current.position.z = 5;
        }
        
        // Secondary white light follows mouse with a lag for more dynamic reflections
        if (secondaryLightRef.current) {
            secondaryLightRef.current.position.x = THREE.MathUtils.lerp(secondaryLightRef.current.position.x, state.mouse.x * -4, 0.03);
            secondaryLightRef.current.position.y = THREE.MathUtils.lerp(secondaryLightRef.current.position.y, state.mouse.y * -4, 0.03);
            secondaryLightRef.current.position.z = 2;
        }
    });

    return (
        <>
            <pointLight 
                ref={mainLightRef} 
                intensity={isMobile ? 20 : 40} 
                color="#52ddeb" 
                distance={15} 
                decay={2} 
            />
            {!isMobile && (
                <pointLight 
                    ref={secondaryLightRef} 
                    intensity={15} 
                    color="#ffffff" 
                    distance={10} 
                    decay={1} 
                />
            )}
        </>
    );
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
                <Html center>
                    <div className="text-white font-mono text-[10px] uppercase tracking-[0.2em] opacity-30 animate-pulse flex flex-col items-center gap-2 whitespace-nowrap">
                        <div className="w-4 h-[1px] bg-white/50" />
                        LOADING SYSTEM
                    </div>
                </Html>
            }>
                <ambientLight intensity={isMobile ? 1.5 : 1} />
                <spotLight position={[10, 10, 10]} angle={0.2} penumbra={1} intensity={isMobile ? 50 : 100} color="#ffffff" castShadow={!isMobile} />
                <MouseLight isMobile={isMobile} />
                <spotLight position={[-10, 10, 10]} angle={0.2} penumbra={1} intensity={isMobile ? 30 : 60} color="#52ddeb" />
                {/* To re-enable premium reflections, place potsdamer_platz_1k.hdr in /public/env-maps/ and use:
                <Environment files="/env-maps/potsdamer_platz_1k.hdr" /> 
                The preset="city" below is disabled because it tries to fetch from external githack/github CDNs. */}
                {/* {!isMobile && <Environment preset="city" />} */}

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

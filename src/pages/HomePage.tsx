import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { PremiumButton } from '../components/ui/PremiumButton';
import { InteractiveASCII } from '../components/ui/InteractiveASCII';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { SEO } from '../components/SEO';
import { ExternalLink, ShieldCheck, ShieldAlert, Terminal, Lock } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Minimal 3D Logo Component
const VisantLogoModel = () => {
    const { scene } = useGLTF('/models/visant-3d-simple-2.glb');
    const meshRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += 0.01;
        }
    });

    useEffect(() => {
        if (scene) {
            scene.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: '#ffffff',
                        metalness: 0.9,
                        roughness: 0.9,
                        emissive: '#52ddeb',
                        emissiveIntensity: 2,
                    });
                }
            });
        }
    }, [scene]);

    return <primitive ref={meshRef} object={scene} scale={2.5} position={[0, 0.5, 0]} />;
};

export const HomePage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useLayout();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const isAdmin = user?.isAdmin === true;
    const isTester = user?.userCategory === 'tester' || user?.username === 'tester';
    const showInternalLinks = isAdmin || isTester;

    const systemVersion = "V2.0.4-STABLE";
    const accessLevel = showInternalLinks ? "LEVEL_02_PRIVILEGED" : "LEVEL_01_PUBLIC";

    return (
        <>
            <SEO
                title={t('homepage.seoTitle') || 'MOCKUP MACHINE'}
                description={t('homepage.seoDescription') || 'Experimental Design Laboratory'}
            />

            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[10] overflow-hidden">
                {/* Background layers */}
                <GridDotsBackground opacity={0.05} spacing={30} color="#ffffff" />

                {/* Main Content */}
                <div className="relative z-20 flex flex-col items-center gap-4 px-4 text-center max-w-4xl">
                    {/* Minimal 3D Logo */}
                    <div className="w-64 h-64 md:w-96 md:h-96 relative flex items-center justify-center -mb-8">
                        <Canvas camera={{ position: [0, 0, 8], fov: 35 }}>
                            <Suspense fallback={null}>
                                <ambientLight intensity={2.5} />
                                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={4} />
                                <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
                                    <VisantLogoModel />
                                </Float>
                            </Suspense>
                        </Canvas>
                    </div>

                    <div className="flex flex-col items-center gap-10 w-full max-w-sm">
                        <PremiumButton
                            onClick={() => navigate('/mockupmachine')}
                            className="h-14 px-12 text-sm border-white/20 hover:border-white/40 text-white transition-all bg-white/5 backdrop-blur-sm group"
                            icon={ExternalLink}
                        >
                            MOCKUP MACHINE® (ALPHA)
                        </PremiumButton>

                        <div className="flex items-center justify-center gap-10">
                            <button
                                onClick={() => navigate('/about')}
                                className="text-neutral-400 hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all duration-300"
                            >
                                info
                            </button>

                            {showInternalLinks ? (
                                <div className="flex items-center gap-8">
                                    <button
                                        onClick={() => navigate('/canvas')}
                                        className="text-neutral-400 hover:text-brand-cyan font-mono text-[10px] uppercase tracking-widest transition-all duration-300"
                                    >
                                        canvas
                                    </button>
                                    <button
                                        onClick={() => navigate('/apps')}
                                        className="text-neutral-400 hover:text-brand-cyan font-mono text-[10px] uppercase tracking-widest transition-all duration-300"
                                    >
                                        apps
                                    </button>
                                    <button
                                        onClick={() => navigate('/brand-guidelines')}
                                        className="text-neutral-400 hover:text-brand-cyan font-mono text-[10px] uppercase tracking-widest transition-all duration-300"
                                    >
                                        core
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-neutral-600 font-mono text-[10px] uppercase tracking-widest opacity-60 select-none">
                                    <Lock size={10} />
                                    <span>restricted</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
;

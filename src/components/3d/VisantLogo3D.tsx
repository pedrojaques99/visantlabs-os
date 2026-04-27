import React, { Suspense, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Float, ContactShadows, PresentationControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ─── Presets ──────────────────────────────────────────────────────────────────
// Subtle ambient presets — same glass material base, only light color shifts
export const PRESETS = [
  { name: 'neutral',  emissive: '#ffffff', emissiveIntensity: 0.25, mainLightColor: '#ffffff',  mainLightIntensity: 38, spotLightColor: '#aaaaaa' },
  { name: 'cyan',     emissive: '#52ddeb', emissiveIntensity: 0.30, mainLightColor: '#52ddeb',  mainLightIntensity: 36, spotLightColor: '#2299aa' },
  { name: 'violet',   emissive: '#aa88ff', emissiveIntensity: 0.25, mainLightColor: '#9966ee',  mainLightIntensity: 36, spotLightColor: '#6633cc' },
  { name: 'amber',    emissive: '#ffcc66', emissiveIntensity: 0.25, mainLightColor: '#ddaa44',  mainLightIntensity: 38, spotLightColor: '#bb8822' },
  { name: 'rose',     emissive: '#ffaacc', emissiveIntensity: 0.22, mainLightColor: '#ee8899',  mainLightIntensity: 36, spotLightColor: '#cc5566' },
  { name: 'green',    emissive: '#88ffcc', emissiveIntensity: 0.22, mainLightColor: '#55ddaa',  mainLightIntensity: 36, spotLightColor: '#33aa77' },
  { name: 'blue',     emissive: '#88aaff', emissiveIntensity: 0.25, mainLightColor: '#6688ee',  mainLightIntensity: 36, spotLightColor: '#4455cc' },
  { name: 'warm',     emissive: '#ffddbb', emissiveIntensity: 0.20, mainLightColor: '#eeccaa',  mainLightIntensity: 40, spotLightColor: '#ccaa88' },
] as const;

// Shared glass material base — all presets use this
export const GLASS_BASE = {
  color: '#ffffff', metalness: 0.05, roughness: 0.05,
  transmission: 1.2, thickness: 1.5, ior: 2.2, clearcoat: 1,
  floatSpeed: 1.4, floatRotation: 0.18, floatIntensity: 0.45,
};

export type Preset = typeof PRESETS[number];
export const randomPresetIndex = () => Math.floor(Math.random() * PRESETS.length);

const ZOOM_MIN = 5;
const ZOOM_MAX = 18;

const calcInitialZ = (vw: number, vh: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, 10 * Math.sqrt((1280 * 800) / (vw * vh))));

const pxToWorld = (px: number, vw: number, cameraZ: number, fovDeg: number) =>
  (px / (vw / 2)) * Math.tan((fovDeg / 2) * (Math.PI / 180)) * cameraZ;

// ─── ZoomSync ─────────────────────────────────────────────────────────────────
const ZoomSync = ({ targetZRef }: { targetZRef: React.MutableRefObject<number> }) => {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZRef.current, 0.08);
  });
  return null;
};

// ─── LogoMesh — updates material in-place when preset changes ────────────────
const LogoMesh = ({ scale, isMobile, preset, xOffset }: {
  scale: number; isMobile: boolean; preset: Preset; xOffset: number;
}) => {
  const { scene } = useGLTF('/models/visant-3d-simple-2.glb');
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.12; // slow auto-rotate
    }
  });

  // Init material on first mount (glass base, static)
  useEffect(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.material = isMobile
        ? new THREE.MeshStandardMaterial({
            color: GLASS_BASE.color, metalness: GLASS_BASE.metalness, roughness: GLASS_BASE.roughness,
            emissive: new THREE.Color(preset.emissive), emissiveIntensity: preset.emissiveIntensity * 0.6,
          })
        : new THREE.MeshPhysicalMaterial({
            color: GLASS_BASE.color, metalness: GLASS_BASE.metalness, roughness: GLASS_BASE.roughness,
            transmission: GLASS_BASE.transmission, thickness: GLASS_BASE.thickness,
            ior: GLASS_BASE.ior, clearcoat: GLASS_BASE.clearcoat, clearcoatRoughness: 0.1,
            emissive: new THREE.Color(preset.emissive), emissiveIntensity: preset.emissiveIntensity,
          });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // On preset change: only update emissive color + intensity, keep glass base intact
  useEffect(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshPhysicalMaterial;
      mat.emissive.set(preset.emissive);
      mat.emissiveIntensity = isMobile ? preset.emissiveIntensity * 0.6 : preset.emissiveIntensity;
      mat.needsUpdate = true;
    });
  }, [scene, preset, isMobile]);

  return <group ref={groupRef} position={[xOffset, 0, 0]}><primitive object={scene} scale={scale} /></group>;
};

// ─── MouseLight — color updates in-place ─────────────────────────────────────
const MouseLight = ({ isMobile, preset }: { isMobile: boolean; preset: Preset }) => {
  const mainRef = useRef<THREE.PointLight>(null);
  const secRef  = useRef<THREE.PointLight>(null);

  // Update light color when preset changes
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.color.set(preset.mainLightColor);
      mainRef.current.intensity = isMobile ? preset.mainLightIntensity / 2 : preset.mainLightIntensity;
    }
  }, [preset, isMobile]);

  useFrame((state) => {
    if (mainRef.current) {
      mainRef.current.position.x = THREE.MathUtils.lerp(mainRef.current.position.x, state.mouse.x * 6, isMobile ? 0.05 : 0.1);
      mainRef.current.position.y = THREE.MathUtils.lerp(mainRef.current.position.y, state.mouse.y * 6, isMobile ? 0.05 : 0.1);
      mainRef.current.position.z = 5;
    }
    if (secRef.current) {
      secRef.current.position.x = THREE.MathUtils.lerp(secRef.current.position.x, state.mouse.x * -4, 0.03);
      secRef.current.position.y = THREE.MathUtils.lerp(secRef.current.position.y, state.mouse.y * -4, 0.03);
      secRef.current.position.z = 2;
    }
  });

  return (
    <>
      <pointLight ref={mainRef} intensity={isMobile ? preset.mainLightIntensity / 2 : preset.mainLightIntensity} color={preset.mainLightColor} distance={15} decay={2} />
      {!isMobile && <pointLight ref={secRef} intensity={15} color="#ffffff" distance={10} decay={1} />}
    </>
  );
};

// ─── SpotLightReactive — updates color when preset changes ───────────────────
const SpotLightReactive = ({ preset, isMobile }: { preset: Preset; isMobile: boolean }) => {
  const ref = useRef<THREE.SpotLight>(null);
  useEffect(() => {
    if (ref.current) ref.current.color.set(preset.spotLightColor);
  }, [preset]);
  return (
    <spotLight ref={ref} position={[-10, 10, 10]} angle={0.2} penumbra={1}
      intensity={isMobile ? 30 : 60} color={preset.spotLightColor} />
  );
};

// ─── VisantLogo3D ─────────────────────────────────────────────────────────────
export interface VisantLogo3DProps {
  /** Index into PRESETS array — change to animate to a new preset without remounting */
  presetIndex?: number;
  /** Pixel offset from screen horizontal center (positive = right) */
  xOffsetPx?: number;
  /** Fills the fixed viewport as a background layer (pointer-events: none) */
  fullScreen?: boolean;
}

export const VisantLogo3D: React.FC<VisantLogo3DProps> = ({
  presetIndex = 0,
  xOffsetPx = 0,
  fullScreen = false,
}) => {
  const [isMobile, setIsMobile] = useState(false);
  const fov = window.innerWidth < 768 ? 120 : 100;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const targetZRef = useRef(calcInitialZ(window.innerWidth, window.innerHeight));
  const isHovering = useRef(false);

  const preset = PRESETS[presetIndex % PRESETS.length];

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      targetZRef.current = calcInitialZ(window.innerWidth, window.innerHeight);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onEnter = () => { isHovering.current = true; };
    const onLeave = () => { isHovering.current = false; };
    const onWheel = (e: WheelEvent) => {
      if (!isHovering.current) return;
      e.preventDefault();
      targetZRef.current = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, targetZRef.current + e.deltaY * 0.008));
    };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const meshX = pxToWorld(xOffsetPx, window.innerWidth, targetZRef.current, fov);
  const initZ = calcInitialZ(window.innerWidth, window.innerHeight);

  return (
    <div
      ref={wrapperRef}
      className={fullScreen ? 'fixed inset-0 z-[1]' : 'w-full h-full'}
    >
      <Canvas
        camera={{ position: [0, 0, initZ], fov }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={
          <Html center>
            <div className="text-white font-mono text-[10px] uppercase tracking-[0.1em] opacity-30 animate-pulse flex flex-col items-center gap-2 whitespace-nowrap">
              <div className="w-4 h-[1px] bg-white/50" />
              LOADING SYSTEM
            </div>
          </Html>
        }>
          <ZoomSync targetZRef={targetZRef} />
          <ambientLight intensity={isMobile ? 1.5 : 1} />
          <spotLight position={[10, 10, 10]} angle={0.2} penumbra={1} intensity={isMobile ? 50 : 100} color="#ffffff" castShadow={!isMobile} />
          <MouseLight isMobile={isMobile} preset={preset} />
          <SpotLightReactive preset={preset} isMobile={isMobile} />

          <PresentationControls global snap={false} rotation={[0, 0, 0]}
            polar={[-Math.PI / 3, Math.PI / 3]} azimuth={[-Math.PI / 1.4, Math.PI / 1.4]}>
            <Float speed={isMobile ? 1 : GLASS_BASE.floatSpeed} rotationIntensity={GLASS_BASE.floatRotation} floatIntensity={GLASS_BASE.floatIntensity}>
              <LogoMesh isMobile={isMobile} scale={isMobile ? 2.8 : 10} preset={preset} xOffset={meshX} />
            </Float>
          </PresentationControls>

          {!isMobile && (
            <ContactShadows opacity={0.3} scale={30} blur={2} far={10} resolution={256}
              color="#000000" position={[meshX, -4, 0]} />
          )}
        </Suspense>
      </Canvas>
    </div>
  );
};

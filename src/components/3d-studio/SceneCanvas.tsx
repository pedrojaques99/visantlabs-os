import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import { ShaderPostProcess } from '@/effects/ShaderPostProcess';
import { CameraBridge } from './CameraBridge';
import { ExtrudedSVG } from './engine/ExtrudedSVG';
import { IntroAnimation, LoopAnimation, SmoothControls } from './engine/controls';
import { resolveMaterial } from './engine/materials';
import { useFont, textToSvg } from './engine/useFont';
import { SceneRefContext, type SceneHandle } from './engine/useSceneRef';

interface SceneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onSceneReady?: (handle: SceneHandle) => void;
}

const sceneSelector = (s: ReturnType<typeof useStudio3DStore.getState>) => ({
  svgData: s.svgData,
  text: s.text,
  font: s.font,
  depth: s.depth,
  smoothness: s.smoothness,
  color: s.color,
  material: s.material,
  metalness: s.metalness,
  roughness: s.roughness,
  opacity: s.opacity,
  wireframe: s.wireframe,
  texture: s.texture,
  textureRepeat: s.textureRepeat,
  textureRotation: s.textureRotation,
  rotationX: s.rotationX,
  rotationY: s.rotationY,
  zoom: s.zoom,
  lightPosition: s.lightPosition,
  lightIntensity: s.lightIntensity,
  ambientIntensity: s.ambientIntensity,
  shadow: s.shadow,
  showGrid: s.showGrid,
  animate: s.animate,
  animateSpeed: s.animateSpeed,
  animateReverse: s.animateReverse,
  transparentBg: s.transparentBg,
  background: s.background,
  resetKey: s.resetKey,
  shaderEnabled: s.shaderEnabled,
  shaderType: s.shaderType,
  shaderValues: s.shaderValues,
  getShaderSettings: s.getShaderSettings,
});

function SceneContent() {
  const s = useStudio3DStore(useShallow(sceneSelector));
  const meshGroupRef = useRef<THREE.Group>(null);
  const animGroupRef = useRef<THREE.Group>(null);

  const shaderSettings = useMemo(() => {
    if (!s.shaderEnabled) return null;
    return s.getShaderSettings();
  }, [s.shaderEnabled, s.shaderType, s.shaderValues, s.getShaderSettings]);

  const halftoneVariant = s.shaderValues.halftoneVariant ?? 'ellipse';

  const materialSettings = useMemo(
    () => resolveMaterial(s.material, {
      metalness: s.metalness,
      roughness: s.roughness,
      opacity: s.opacity,
      wireframe: s.wireframe,
    }),
    [s.material, s.metalness, s.roughness, s.opacity, s.wireframe],
  );

  const loadedFont = useFont(s.font);
  const svgString = useMemo(() => {
    if (s.svgData) return s.svgData;
    const text = s.text || '®';
    if (!loadedFont) return '';
    return textToSvg(text, loadedFont);
  }, [s.svgData, s.text, loadedFont]);

  return (
    <>
      <IntroAnimation
        type="zoom"
        duration={0.6}
        from={{ zoom: 18, opacity: 0 }}
        to={{ zoom: s.zoom, opacity: 1 }}
      />
      <SmoothControls
        rotationX={s.rotationX}
        rotationY={s.rotationY}
        meshRef={meshGroupRef}
        cursorOrbit={false}
        orbitStrength={0.15}
        draggable={true}
        scrollZoom={true}
        zoom={s.zoom}
        resetOnIdle={false}
        resetDelay={2}
        resetKey={s.resetKey}
      />
      <LoopAnimation
        type={s.animate}
        speed={s.animateSpeed}
        reverse={s.animateReverse}
        meshRef={animGroupRef}
      />

      <ambientLight intensity={s.ambientIntensity} />
      <directionalLight position={s.lightPosition} intensity={s.lightIntensity} castShadow />
      <directionalLight position={[-5, 3, -3]} intensity={0.4} />
      <directionalLight position={[0, -4, 6]} intensity={0.2} />
      <pointLight position={[0, 5, 0]} intensity={0.3} />

      <group ref={animGroupRef}>
        {svgString && (
          <ExtrudedSVG
            svgString={svgString}
            depth={s.depth}
            smoothness={s.smoothness}
            color={s.color}
            materialSettings={materialSettings}
            rotationX={s.rotationX}
            rotationY={s.rotationY}
            groupRef={meshGroupRef}
            texture={s.texture || undefined}
            textureRepeat={s.textureRepeat}
            textureRotation={s.textureRotation}
          />
        )}
      </group>

      {s.shadow && (
        <ContactShadows position={[0, -3, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      )}

      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />

      <Environment background={false} environmentIntensity={1.5} frames={1}>
        <mesh scale={50}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#0a0a12" side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, 25, 0]}>
          <sphereGeometry args={[20, 32, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 30]}>
          <sphereGeometry args={[15, 32, 32]} />
          <meshBasicMaterial color="#444444" />
        </mesh>
        <mesh position={[-20, 5, 10]}>
          <sphereGeometry args={[10, 32, 32]} />
          <meshBasicMaterial color="#333333" />
        </mesh>
      </Environment>

      <CameraBridge />

      {s.showGrid && (
        <gridHelper args={[10, 10, '#333333', '#1a1a1a']} position={[0, -1.5, 0]} />
      )}

      {shaderSettings && (
        <ShaderPostProcess
          shaderType={s.shaderType}
          settings={shaderSettings}
          halftoneVariant={halftoneVariant}
        />
      )}
    </>
  );
}

export const SceneCanvas: React.FC<SceneCanvasProps> = React.memo(({ onCanvasReady, onSceneReady }) => {
  const s = useStudio3DStore(useShallow((st) => ({
    background: st.background,
    transparentBg: st.transparentBg,
    zoom: st.zoom,
    resetKey: st.resetKey,
  })));

  const [sceneHandle, setSceneHandle] = useState<SceneHandle | null>(null);

  const bg = s.transparentBg ? 'transparent' : s.background;

  return (
    <SceneRefContext.Provider value={sceneHandle}>
      <Canvas
        key={s.resetKey}
        camera={{ position: [0, 0, s.zoom], fov: 50 }}
        style={{ background: bg, width: '100%', height: '100%' }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        onCreated={({ gl, scene, camera }) => {
          if (bg && bg !== 'transparent') {
            scene.background = new THREE.Color(bg);
          }
          onCanvasReady(gl.domElement);
          const handle: SceneHandle = { scene, gl, camera };
          setSceneHandle(handle);
          onSceneReady?.(handle);

          gl.domElement.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            const wrapper = gl.domElement.parentElement;
            if (wrapper) wrapper.style.visibility = 'hidden';
          });
          gl.domElement.addEventListener('webglcontextrestored', () => {
            const wrapper = gl.domElement.parentElement;
            if (wrapper) wrapper.style.visibility = 'visible';
          });
        }}
      >
        <SceneContent />
      </Canvas>
    </SceneRefContext.Provider>
  );
});

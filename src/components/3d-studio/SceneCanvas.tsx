import React, { useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useStudio3DStore, ENVIRONMENT_PRESETS } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import { EffectComposer, Bloom, DepthOfField, Vignette } from '@react-three/postprocessing';
import { ShaderPostProcess } from '@/effects/ShaderPostProcess';
import { CameraBridge } from './CameraBridge';
import { ExtrudedSVG } from './engine/ExtrudedSVG';
import { PhysicsFallSimulation } from './engine/PhysicsFallSimulation';
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
  shapeType: s.shapeType,
  depth: s.depth,
  smoothness: s.smoothness,
  bevelEnabled: s.bevelEnabled,
  bevelThickness: s.bevelThickness,
  bevelSize: s.bevelSize,
  color: s.color,
  material: s.material,
  metalness: s.metalness,
  roughness: s.roughness,
  opacity: s.opacity,
  wireframe: s.wireframe,
  texture: s.texture,
  textureRepeat: s.textureRepeat,
  textureRotation: s.textureRotation,
  textureOpacity: s.textureOpacity,
  rotationX: s.rotationX,
  rotationY: s.rotationY,
  zoom: s.zoom,
  lightPosition: s.lightPosition,
  lightIntensity: s.lightIntensity,
  ambientIntensity: s.ambientIntensity,
  fillLightIntensity: s.fillLightIntensity,
  bounceLightIntensity: s.bounceLightIntensity,
  pointLightIntensity: s.pointLightIntensity,
  shadow: s.shadow,
  showGrid: s.showGrid,
  environment: s.environment,
  customHdriUrl: s.customHdriUrl,
  bloomEnabled: s.bloomEnabled,
  bloomIntensity: s.bloomIntensity,
  bloomThreshold: s.bloomThreshold,
  dofEnabled: s.dofEnabled,
  dofFocusDistance: s.dofFocusDistance,
  dofBokehScale: s.dofBokehScale,
  vignetteEnabled: s.vignetteEnabled,
  vignetteIntensity: s.vignetteIntensity,
  animate: s.animate,
  animateSpeed: s.animateSpeed,
  animateReverse: s.animateReverse,
  animateEasing: s.animateEasing,
  physicsCount: s.physicsCount,
  physicsGravity: s.physicsGravity,
  physicsBounciness: s.physicsBounciness,
  physicsFriction: s.physicsFriction,
  physicsSize: s.physicsSize,
  transparentBg: s.transparentBg,
  background: s.background,
  bgType: s.bgType,
  bgGradient: s.bgGradient,
  resetKey: s.resetKey,
  shaderEnabled: s.shaderEnabled,
  shaderType: s.shaderType,
  shaderValues: s.shaderValues,
  getShaderSettings: s.getShaderSettings,
});

function GradientBackground({ type, gradient }: { type: 'linear' | 'radial'; gradient: any }) {
  const { viewport } = useThree();
  const uniforms = useMemo(() => ({
    uColor1: { value: new THREE.Color(gradient.color1) },
    uColor2: { value: new THREE.Color(gradient.color2) },
    uAngle: { value: (gradient.angle * Math.PI) / 180 },
    uType: { value: type === 'linear' ? 0 : 1 },
  }), [gradient.color1, gradient.color2, gradient.angle, type]);

  return (
    <mesh scale={[viewport.width * 2, viewport.height * 2, 1]} position={[0, 0, -10]}>
      <planeGeometry />
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor1;
          uniform vec3 uColor2;
          uniform float uAngle;
          uniform int uType;
          varying vec2 vUv;

          void main() {
            float t = 0.0;
            if (uType == 0) {
              vec2 dir = vec2(cos(uAngle), sin(uAngle));
              t = dot(vUv - 0.5, dir) + 0.5;
            } else {
              t = distance(vUv, vec2(0.5)) * 2.0;
            }
            gl_FragColor = vec4(mix(uColor1, uColor2, clamp(t, 0.0, 1.0)), 1.0);
          }
        `}
      />
    </mesh>
  );
}

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
        easing={s.animateEasing}
        meshRef={animGroupRef}
      />

      <ambientLight intensity={s.ambientIntensity} />
      <directionalLight position={s.lightPosition} intensity={s.lightIntensity} castShadow />
      <directionalLight position={[-5, 3, -3]} intensity={s.fillLightIntensity} />
      <directionalLight position={[0, -4, 6]} intensity={s.bounceLightIntensity} />
      <pointLight position={[0, 5, 0]} intensity={s.pointLightIntensity} />

      <group ref={animGroupRef}>
        {svgString && (
          s.animate === 'physicsFall' ? (
             <PhysicsFallSimulation
              key="physics-fall-sim"
              svgString={svgString}
              depth={s.depth}
              smoothness={s.smoothness}
              bevelEnabled={s.bevelEnabled}
              bevelThickness={s.bevelThickness}
              bevelSize={s.bevelSize}
              color={s.color}
              materialSettings={materialSettings}
              texture={s.texture || undefined}
              textureRepeat={s.textureRepeat}
              textureRotation={s.textureRotation}
              textureOpacity={s.textureOpacity}
              physicsCount={s.physicsCount}
              physicsGravity={s.physicsGravity}
              physicsBounciness={s.physicsBounciness}
              physicsFriction={s.physicsFriction}
              physicsSize={s.physicsSize}
              resetKey={s.resetKey}
              shapeType={s.shapeType}
            />
          ) : (
            <ExtrudedSVG
              key="standard-extruded-svg"
              svgString={svgString}
              depth={s.depth}
              smoothness={s.smoothness}
              bevelEnabled={s.bevelEnabled}
              bevelThickness={s.bevelThickness}
              bevelSize={s.bevelSize}
              color={s.color}
              materialSettings={materialSettings}
              rotationX={s.rotationX}
              rotationY={s.rotationY}
              groupRef={meshGroupRef}
              texture={s.texture || undefined}
              textureRepeat={s.textureRepeat}
              textureRotation={s.textureRotation}
              textureOpacity={s.textureOpacity}
              shapeType={s.shapeType}
            />
          )
        )}
      </group>

      {s.shadow && (
        <ContactShadows position={[0, -3, 0]} opacity={0.4} scale={10} blur={2} far={4} />
      )}

      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />

      {!s.transparentBg && (
        s.bgType === 'solid' ? (
          <mesh scale={100}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshBasicMaterial color={s.background} side={THREE.BackSide} toneMapped={false} />
          </mesh>
        ) : (
          <GradientBackground type={s.bgType as any} gradient={s.bgGradient} />
        )
      )}

      {(() => {
        const hdriUrl = s.customHdriUrl || ENVIRONMENT_PRESETS.find(p => p.id === s.environment)?.file;
        return hdriUrl ? (
          <Environment background={false} files={hdriUrl} />
        ) : (
          <Environment background={false} environmentIntensity={1.5} frames={1}>
            <mesh position={[0, 25, 0]}>
              <sphereGeometry args={[20, 32, 32]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </Environment>
        );
      })()}

      <CameraBridge />

      {s.showGrid && (
        <gridHelper args={[10, 10, '#333333', '#1a1a1a']} position={[0, -1.5, 0]} />
      )}

      {shaderSettings ? (
        <ShaderPostProcess
          shaderType={s.shaderType}
          settings={shaderSettings}
          halftoneVariant={halftoneVariant}
        />
      ) : (s.bloomEnabled || s.dofEnabled || s.vignetteEnabled) ? (
        <EffectComposer multisampling={4}>
          {s.bloomEnabled && <Bloom intensity={s.bloomIntensity} luminanceThreshold={s.bloomThreshold} luminanceSmoothing={0.9} />}
          {s.dofEnabled && <DepthOfField focusDistance={s.dofFocusDistance} focalLength={0.05} bokehScale={s.dofBokehScale} />}
          {s.vignetteEnabled && <Vignette darkness={s.vignetteIntensity} offset={0.3} />}
        </EffectComposer>
      ) : null}
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

import React, { Suspense, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Stats,
  MeshReflectorMaterial,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
} from '@react-three/drei';
import * as THREE from 'three';
import {
  useStudio3DStore,
  ENVIRONMENT_PRESETS,
  RENDER_QUALITY_CONFIG,
  type ToneMappingType,
} from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import {
  EffectComposer,
  Bloom,
  DepthOfField,
  Vignette,
  ChromaticAberration,
  Noise,
  N8AO,
  HueSaturation,
  BrightnessContrast,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { ShaderPostProcess } from '@/effects/ShaderPostProcess';
import { CameraBridge } from './CameraBridge';
import { ExtrudedSVG } from './engine/ExtrudedSVG';
import { ImportedModel } from './engine/ImportedModel';
import { PhysicsFallSimulation } from './engine/PhysicsFallSimulation';
import { IntroAnimation, LoopAnimation, SmoothControls } from './engine/controls';
import { resolveMaterial } from './engine/materials';
import { useFont, textToSvg } from './engine/useFont';
import { SceneRefContext, type SceneHandle } from './engine/useSceneRef';

interface SceneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
  onSceneReady?: (handle: SceneHandle) => void;
}

type Studio3DState = ReturnType<typeof useStudio3DStore.getState>;

// ---------------------------------------------------------------------------
// Domain-scoped selectors.
//
// Previously a single ~116-prop selector drove the entire <SceneContent>: any
// store change (a lighting slider, an effects toggle, a camera view click that
// writes `_cameraInfo`) re-ran the whole component — recomputing the expensive
// geometry memos (svgString/materialSettings) and reconciling the ExtrudedSVG
// subtree even when nothing geometric changed.
//
// Splitting subscription by domain means a lighting tweak only re-renders
// <LightingContent>, an effects tweak only <EffectsContent>, etc. The heavy
// geometry subtree (svg trace → extrude) is now isolated behind
// <GeometryContent> and only re-renders when geometry/material inputs change.
// Behaviour is identical — only subscription granularity changed.
// ---------------------------------------------------------------------------

const geometrySelector = (s: Studio3DState) => ({
  svgData: s.svgData,
  text: s.text,
  font: s.font,
  shapeType: s.shapeType,
  depth: s.depth,
  smoothness: s.smoothness,
  bevelEnabled: s.bevelEnabled,
  bevelThickness: s.bevelThickness,
  bevelSize: s.bevelSize,
  objectScale: s.objectScale,
  coinRadius: s.coinRadius,
  badgeWidth: s.badgeWidth,
  badgeHeight: s.badgeHeight,
  badgeRadius: s.badgeRadius,
  stampRadius: s.stampRadius,
  stampTeeth: s.stampTeeth,
  stampToothDepth: s.stampToothDepth,
  shieldWidth: s.shieldWidth,
  shieldHeight: s.shieldHeight,
  hexRadius: s.hexRadius,
  chainLinks: s.chainLinks,
  chainScale: s.chainScale,
  showChain: s.showChain,
  bailSize: s.bailSize,
  bailOffset: s.bailOffset,
  chainOffset: s.chainOffset,
  chainColor: s.chainColor,
  shapeColor: s.shapeColor,
  reliefDepth: s.reliefDepth,
  blendMode: s.blendMode,
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
  envMapIntensity: s.envMapIntensity,
  fresnelColor: s.fresnelColor,
  fresnelStrength: s.fresnelStrength,
  normalMapUrl: s.normalMapUrl,
  roughnessMapUrl: s.roughnessMapUrl,
  metalnessMapUrl: s.metalnessMapUrl,
  animate: s.animate,
  animateSpeed: s.animateSpeed,
  animateReverse: s.animateReverse,
  animateEasing: s.animateEasing,
  physicsCount: s.physicsCount,
  physicsGravity: s.physicsGravity,
  physicsBounciness: s.physicsBounciness,
  physicsFriction: s.physicsFriction,
  physicsSize: s.physicsSize,
  inputMode: s.inputMode,
  modelUrl: s.modelUrl,
  resetKey: s.resetKey,
});

const lightingSelector = (s: Studio3DState) => ({
  lightPosition: s.lightPosition,
  lightIntensity: s.lightIntensity,
  ambientIntensity: s.ambientIntensity,
  fillLightIntensity: s.fillLightIntensity,
  fillLightPosition: s.fillLightPosition,
  bounceLightIntensity: s.bounceLightIntensity,
  bounceLightPosition: s.bounceLightPosition,
  pointLightIntensity: s.pointLightIntensity,
  pointLightPosition: s.pointLightPosition,
});

const environmentSelector = (s: Studio3DState) => ({
  fogEnabled: s.fogEnabled,
  fogColor: s.fogColor,
  fogNear: s.fogNear,
  fogFar: s.fogFar,
  hdriBackground: s.hdriBackground,
  hdriBlur: s.hdriBlur,
  hdriIntensity: s.hdriIntensity,
  hdriRotation: s.hdriRotation,
  environment: s.environment,
  customHdriUrl: s.customHdriUrl,
  transparentBg: s.transparentBg,
  background: s.background,
  bgType: s.bgType,
  bgGradient: s.bgGradient,
});

const stageSelector = (s: Studio3DState) => ({
  fov: s.fov,
  zoom: s.zoom,
  rotationX: s.rotationX,
  rotationY: s.rotationY,
  resetKey: s.resetKey,
  animate: s.animate,
  animateSpeed: s.animateSpeed,
  animateReverse: s.animateReverse,
  animateEasing: s.animateEasing,
  shadow: s.shadow,
  renderQuality: s.renderQuality,
  groundPlane: s.groundPlane,
  groundReflection: s.groundReflection,
  showGrid: s.showGrid,
});

const effectsSelector = (s: Studio3DState) => ({
  renderQuality: s.renderQuality,
  resetKey: s.resetKey,
  bloomEnabled: s.bloomEnabled,
  bloomIntensity: s.bloomIntensity,
  bloomThreshold: s.bloomThreshold,
  dofEnabled: s.dofEnabled,
  dofFocusDistance: s.dofFocusDistance,
  dofBokehScale: s.dofBokehScale,
  vignetteEnabled: s.vignetteEnabled,
  vignetteIntensity: s.vignetteIntensity,
  ssaoEnabled: s.ssaoEnabled,
  ssaoIntensity: s.ssaoIntensity,
  chromaticAberrationEnabled: s.chromaticAberrationEnabled,
  chromaticAberrationOffset: s.chromaticAberrationOffset,
  noiseEnabled: s.noiseEnabled,
  noiseOpacity: s.noiseOpacity,
  colorGradingEnabled: s.colorGradingEnabled,
  cgBrightness: s.cgBrightness,
  cgContrast: s.cgContrast,
  cgHue: s.cgHue,
  cgSaturation: s.cgSaturation,
  shaderEnabled: s.shaderEnabled,
  shaderType: s.shaderType,
  shaderValues: s.shaderValues,
  getShaderSettings: s.getShaderSettings,
  effectsBypass: s.effectsBypass,
});

function GradientBackground({ type, gradient }: { type: 'linear' | 'radial'; gradient: any }) {
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      uColor1: { value: new THREE.Color(gradient.color1) },
      uColor2: { value: new THREE.Color(gradient.color2) },
      uAngle: { value: (gradient.angle * Math.PI) / 180 },
      uType: { value: type === 'linear' ? 0 : 1 },
    }),
    [gradient.color1, gradient.color2, gradient.angle, type]
  );

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

function SceneFog({ color, near, far }: { color: string; near: number; far: number }) {
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog(color, near, far);
    return () => {
      scene.fog = null;
    };
  }, [scene, color, near, far]);
  return null;
}

function SyncCamera({ fov }: { fov: number }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if ('fov' in camera) {
      (camera as THREE.PerspectiveCamera).fov = fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [camera, fov]);
  return null;
}

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

function HdriLoadingFallback() {
  return (
    <Environment background={false} environmentIntensity={1} frames={1}>
      <mesh position={[0, 25, 0]}>
        <sphereGeometry args={[20, 32, 32]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </Environment>
  );
}

// Stage = camera sync, intro/loop animation, orbit controls, shadows, ground,
// grid. Owns the animation group ref + mesh ref that GeometryContent renders
// into. Subscribes only to camera/animation/ground state.
function StageContent({ children }: { children: React.ReactNode }) {
  const s = useStudio3DStore(useShallow(stageSelector));
  const meshGroupRef = useRef<THREE.Group>(null);
  const animGroupRef = useRef<THREE.Group>(null);

  return (
    <>
      <SyncCamera fov={s.fov} />
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
        type={prefersReducedMotion ? 'none' : s.animate}
        speed={s.animateSpeed}
        reverse={s.animateReverse}
        easing={s.animateEasing}
        meshRef={animGroupRef}
      />

      <group ref={animGroupRef}>
        <GeometryContent meshGroupRef={meshGroupRef} animGroupRef={animGroupRef} />
      </group>

      {s.shadow && (
        <ContactShadows
          position={[0, -3, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
          resolution={RENDER_QUALITY_CONFIG[s.renderQuality].shadowRes}
        />
      )}

      {s.groundPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
          <planeGeometry args={[20, 20]} />
          <MeshReflectorMaterial
            mirror={s.groundReflection}
            blur={[300, 100]}
            resolution={512}
            mixBlur={1}
            mixStrength={40}
            roughness={1}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#101010"
            metalness={0.5}
          />
        </mesh>
      )}

      {s.showGrid && <gridHelper args={[10, 10, '#333333', '#1a1a1a']} position={[0, -1.5, 0]} />}

      {children}
    </>
  );
}

// GeometryContent = the heavy subtree (svg trace → extrude / GLB). Isolated so
// camera/lighting/effects changes never re-run the svgString/material memos or
// reconcile ExtrudedSVG. Receives the scale via objectScale on its own group.
function GeometryContent({
  meshGroupRef,
  animGroupRef: _animGroupRef,
}: {
  meshGroupRef: React.RefObject<THREE.Group>;
  animGroupRef: React.RefObject<THREE.Group>;
}) {
  const s = useStudio3DStore(useShallow(geometrySelector));

  const materialSettings = useMemo(
    () =>
      resolveMaterial(s.material, {
        metalness: s.metalness,
        roughness: s.roughness,
        opacity: s.opacity,
        wireframe: s.wireframe,
      }),
    [s.material, s.metalness, s.roughness, s.opacity, s.wireframe]
  );

  const loadedFont = useFont(s.font);
  const svgString = useMemo(() => {
    if (s.svgData) return s.svgData;
    const text = s.text || '®';
    if (!loadedFont) return '';
    return textToSvg(text, loadedFont);
  }, [s.svgData, s.text, loadedFont]);

  return (
    <group scale={s.objectScale}>
      {s.inputMode === 'model' && s.modelUrl ? (
        <ImportedModel
          url={s.modelUrl}
          groupRef={meshGroupRef}
          rotationX={s.rotationX}
          rotationY={s.rotationY}
          objectScale={1}
          overrideColor={s.color}
          overrideMetalness={s.metalness}
          overrideRoughness={s.roughness}
          overrideWireframe={s.wireframe}
          overrideOpacity={s.opacity}
        />
      ) : (
        svgString &&
        (s.animate === 'physicsFall' ? (
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
            coinRadius={s.coinRadius}
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
            envMapIntensity={s.envMapIntensity}
            fresnelColor={s.fresnelColor || undefined}
            fresnelStrength={s.fresnelStrength}
            normalMapUrl={s.normalMapUrl || undefined}
            roughnessMapUrl={s.roughnessMapUrl || undefined}
            metalnessMapUrl={s.metalnessMapUrl || undefined}
            shapeType={s.shapeType}
            coinRadius={s.coinRadius}
            badgeWidth={s.badgeWidth}
            badgeHeight={s.badgeHeight}
            badgeRadius={s.badgeRadius}
            stampRadius={s.stampRadius}
            stampTeeth={s.stampTeeth}
            stampToothDepth={s.stampToothDepth}
            shieldWidth={s.shieldWidth}
            shieldHeight={s.shieldHeight}
            hexRadius={s.hexRadius}
            chainLinks={s.chainLinks}
            chainScale={s.chainScale}
            showChain={s.showChain}
            bailSize={s.bailSize}
            bailOffset={s.bailOffset}
            chainOffset={s.chainOffset}
            chainColor={s.chainColor}
            shapeColor={s.shapeColor}
            reliefDepth={s.reliefDepth}
            blendMode={s.blendMode}
          />
        ))
      )}
    </group>
  );
}

// LightingContent = ambient + directional + point lights. Re-renders only on
// lighting changes.
function LightingContent() {
  const s = useStudio3DStore(useShallow(lightingSelector));
  return (
    <>
      <ambientLight intensity={s.ambientIntensity} />
      <directionalLight position={s.lightPosition} intensity={s.lightIntensity} castShadow />
      <directionalLight position={s.fillLightPosition} intensity={s.fillLightIntensity} />
      <directionalLight position={s.bounceLightPosition} intensity={s.bounceLightIntensity} />
      <pointLight position={s.pointLightPosition} intensity={s.pointLightIntensity} />
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />
    </>
  );
}

// EnvironmentContent = HDRI, fog, scene background. Re-renders only on
// environment changes — importantly NOT on geometry/effects changes, so the
// HDRI <Environment> (which re-fetches/re-bakes) stays stable.
function EnvironmentContent() {
  const s = useStudio3DStore(useShallow(environmentSelector));

  const hdriRotationEuler = useMemo(
    () => [0, (s.hdriRotation * Math.PI) / 180, 0] as [number, number, number],
    [s.hdriRotation]
  );

  return (
    <>
      {s.fogEnabled && <SceneFog color={s.fogColor} near={s.fogNear} far={s.fogFar} />}

      {!s.transparentBg &&
        !s.hdriBackground &&
        s.bgType !== 'image' &&
        (s.bgType === 'solid' ? (
          <mesh scale={100}>
            <sphereGeometry args={[1, 64, 64]} />
            <meshBasicMaterial color={s.background} side={THREE.BackSide} toneMapped={false} />
          </mesh>
        ) : (
          <GradientBackground type={s.bgType as any} gradient={s.bgGradient} />
        ))}

      <Suspense fallback={<HdriLoadingFallback />}>
        {(() => {
          const hdriUrl =
            s.customHdriUrl || ENVIRONMENT_PRESETS.find((p) => p.id === s.environment)?.file;
          return hdriUrl ? (
            <Environment
              background={s.hdriBackground}
              files={hdriUrl}
              backgroundBlurriness={s.hdriBlur}
              backgroundIntensity={s.hdriIntensity}
              environmentIntensity={s.hdriIntensity}
              environmentRotation={hdriRotationEuler}
              backgroundRotation={hdriRotationEuler}
            />
          ) : (
            <Environment background={false} environmentIntensity={1.5} frames={1}>
              <mesh position={[0, 25, 0]}>
                <sphereGeometry args={[20, 32, 32]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            </Environment>
          );
        })()}
      </Suspense>
    </>
  );
}

// When postprocessing is on, @react-three/postprocessing's EffectComposer takes
// over the render and sets gl.autoClear = false (it clears manually). If the
// composer then unmounts (e.g. the last effect — bloom — is toggled off), the
// renderer is left with autoClear = false, so r3f's default render no longer
// clears the buffer and the frame appears frozen. Re-enabling an effect remounts
// the composer and "fixes" it. Mounting this in place of the null branch restores
// the renderer to a clean state whenever no composer is active.
function RendererReset() {
  const gl = useThree((st) => st.gl);
  const invalidate = useThree((st) => st.invalidate);
  useEffect(() => {
    gl.autoClear = true;
    invalidate();
  }, [gl, invalidate]);
  return null;
}

// EffectsContent = postprocessing / shader pass. Re-renders only on FX changes.
function EffectsContent() {
  const s = useStudio3DStore(useShallow(effectsSelector));

  const shaderSettings = useMemo(() => {
    if (!s.shaderEnabled) return null;
    return s.getShaderSettings();
  }, [s.shaderEnabled, s.shaderType, s.shaderValues, s.getShaderSettings]);

  const halftoneVariant = s.shaderValues.halftoneVariant ?? 'ellipse';

  if (shaderSettings) {
    return (
      <ShaderPostProcess
        shaderType={s.shaderType}
        settings={shaderSettings}
        halftoneVariant={halftoneVariant}
      />
    );
  }

  const anyEffect =
    !s.effectsBypass &&
    (s.bloomEnabled ||
      s.dofEnabled ||
      s.vignetteEnabled ||
      s.ssaoEnabled ||
      s.chromaticAberrationEnabled ||
      s.noiseEnabled ||
      s.colorGradingEnabled);

  if (!anyEffect) return <RendererReset />;

  return (
    <EffectComposer key={s.resetKey} multisampling={RENDER_QUALITY_CONFIG[s.renderQuality].msaa}>
      {s.ssaoEnabled && s.renderQuality !== 'performance' && (
        <N8AO intensity={s.ssaoIntensity} aoRadius={0.5} distanceFalloff={1} />
      )}
      {s.bloomEnabled && (
        <Bloom
          intensity={s.bloomIntensity}
          luminanceThreshold={s.bloomThreshold}
          luminanceSmoothing={0.9}
        />
      )}
      {s.dofEnabled && s.renderQuality !== 'performance' && (
        <DepthOfField
          focusDistance={s.dofFocusDistance}
          focalLength={0.02}
          bokehScale={s.dofBokehScale}
          height={RENDER_QUALITY_CONFIG[s.renderQuality].msaa > 0 ? 480 : 240}
        />
      )}
      {s.chromaticAberrationEnabled && s.renderQuality !== 'performance' && (
        <ChromaticAberration
          offset={[s.chromaticAberrationOffset, s.chromaticAberrationOffset] as any}
        />
      )}
      {s.noiseEnabled && (
        <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={s.noiseOpacity} />
      )}
      {s.colorGradingEnabled && (
        <BrightnessContrast brightness={s.cgBrightness} contrast={s.cgContrast} />
      )}
      {s.colorGradingEnabled && <HueSaturation hue={s.cgHue} saturation={s.cgSaturation} />}
      {s.vignetteEnabled && <Vignette darkness={s.vignetteIntensity} offset={0.3} />}
    </EffectComposer>
  );
}

// Composition root. Holds NO store subscription itself — each child subscribes
// to its own domain slice, so a change in one domain re-renders only that
// child. CameraBridge() returns null but is kept mounted for parity.
function SceneContent() {
  return (
    <>
      <LightingContent />
      <StageContent>
        <EnvironmentContent />
        <CameraBridge />
        <EffectsContent />
      </StageContent>
    </>
  );
}

const TONE_MAP: Record<ToneMappingType, THREE.ToneMapping> = {
  ACES: THREE.ACESFilmicToneMapping,
  AgX: THREE.AgXToneMapping,
  Neutral: THREE.NeutralToneMapping,
  Reinhard: THREE.ReinhardToneMapping,
  Cineon: THREE.CineonToneMapping,
  Linear: THREE.LinearToneMapping,
};

export const SceneCanvas: React.FC<SceneCanvasProps> = React.memo(
  ({ onCanvasReady, onSceneReady }) => {
    const s = useStudio3DStore(
      useShallow((st) => ({
        background: st.background,
        transparentBg: st.transparentBg,
        bgType: st.bgType,
        backgroundImageUrl: st.backgroundImageUrl,
        zoom: st.zoom,
        resetKey: st.resetKey,
        toneMapping: st.toneMapping,
        toneMappingExposure: st.toneMappingExposure,
        showStats: st.showStats,
        renderQuality: st.renderQuality,
        fov: st.fov,
        orthographic: st.orthographic,
      }))
    );

    const [sceneHandle, setSceneHandle] = useState<SceneHandle | null>(null);

    const bg = s.transparentBg ? 'transparent' : s.background;
    const bgStyle: React.CSSProperties =
      s.bgType === 'image' && s.backgroundImageUrl
        ? {
            backgroundImage: `url(${s.backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }
        : { background: bg };

    return (
      <SceneRefContext.Provider value={sceneHandle}>
        <Canvas
          key={`${s.resetKey}-${s.orthographic}`}
          orthographic={s.orthographic}
          camera={
            s.orthographic
              ? { position: [0, 0, s.zoom], zoom: 80 }
              : { position: [0, 0, s.zoom], fov: s.fov }
          }
          dpr={RENDER_QUALITY_CONFIG[s.renderQuality].dpr}
          // touchAction: 'none' lets the canvas own all touch gestures (1-finger
          // orbit, 2-finger pinch/pan) instead of the browser hijacking them for
          // page scroll/zoom. Without it, dragging on mobile scrolls the page.
          style={{ ...bgStyle, width: '100%', height: '100%', touchAction: 'none' }}
          gl={{
            antialias: s.renderQuality !== 'performance',
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: false,
            toneMapping: TONE_MAP[s.toneMapping],
            toneMappingExposure: s.toneMappingExposure,
          }}
          onCreated={({ gl, scene, camera }) => {
            onCanvasReady(gl.domElement);
            const handle: SceneHandle = { scene, gl, camera };
            setSceneHandle(handle);
            onSceneReady?.(handle);

            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              import('sonner').then(({ toast }) =>
                toast.error('WebGL context lost — attempting recovery...', { id: 'webgl-context' })
              );
            });
            gl.domElement.addEventListener('webglcontextrestored', () => {
              import('sonner').then(({ toast }) =>
                toast.success('WebGL context restored', { id: 'webgl-context' })
              );
              useStudio3DStore.setState({ resetKey: Date.now() });
            });
          }}
        >
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <PerformanceMonitor />
          <SceneContent />
          {s.showStats && <Stats className="!absolute !left-2 !top-2" />}
        </Canvas>
      </SceneRefContext.Provider>
    );
  }
);

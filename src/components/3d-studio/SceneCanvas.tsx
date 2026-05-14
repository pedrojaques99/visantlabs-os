import React, { useCallback } from 'react';
import { SVG3D } from '3dsvg';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';

interface SceneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
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
  interactive: s.interactive,
  lightPosition: s.lightPosition,
  lightIntensity: s.lightIntensity,
  ambientIntensity: s.ambientIntensity,
  shadow: s.shadow,
  animate: s.animate,
  animateSpeed: s.animateSpeed,
  animateReverse: s.animateReverse,
  transparentBg: s.transparentBg,
  background: s.background,
  resetKey: s.resetKey,
});

export const SceneCanvas: React.FC<SceneCanvasProps> = React.memo(({ onCanvasReady }) => {
  const s = useStudio3DStore(useShallow(sceneSelector));

  const handleRegisterCanvas = useCallback((canvas: HTMLCanvasElement) => {
    onCanvasReady(canvas);
  }, [onCanvasReady]);

  const hasSvg = !!s.svgData;
  const hasText = !!s.text;
  const hasContent = hasSvg || hasText;

  if (!hasContent) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: s.background }}>
        <div className="w-16 h-16 rounded-2xl border border-dashed border-neutral-700 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-neutral-600">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
        </div>
        <p className="text-neutral-600 text-[10px] uppercase tracking-widest">
          Drop SVG / PNG or use the panel
        </p>
      </div>
    );
  }

  return (
    <SVG3D
      key={s.resetKey}
      svg={hasSvg ? s.svgData : undefined}
      text={hasText && !hasSvg ? s.text : undefined}
      font={s.font}
      depth={s.depth}
      smoothness={s.smoothness}
      color={s.color}
      material={s.material}
      metalness={s.metalness}
      roughness={s.roughness}
      opacity={s.opacity}
      wireframe={s.wireframe}
      texture={s.texture || undefined}
      textureRepeat={s.textureRepeat}
      textureRotation={s.textureRotation}
      rotationX={s.rotationX}
      rotationY={s.rotationY}
      zoom={s.zoom}
      interactive
      cursorOrbit={s.interactive}
      draggable
      scrollZoom
      lightPosition={s.lightPosition}
      lightIntensity={s.lightIntensity}
      ambientIntensity={s.ambientIntensity}
      shadow={s.shadow}
      animate={s.animate}
      animateSpeed={s.animateSpeed}
      animateReverse={s.animateReverse}
      intro="zoom"
      introDuration={0.6}
      background={s.transparentBg ? 'transparent' : s.background}
      width="100%"
      height="100%"
      registerCanvas={handleRegisterCanvas}
    />
  );
});

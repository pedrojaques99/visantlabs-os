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
      <div className="w-full h-full flex items-center justify-center" style={{ background: s.background }}>
        <p className="text-neutral-600 text-xs uppercase tracking-widest">
          Upload SVG / PNG or type text
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

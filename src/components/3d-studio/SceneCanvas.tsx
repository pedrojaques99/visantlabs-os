import React, { useCallback } from 'react';
import { SVG3D } from '3dsvg';
import { useStudio3DStore } from '@/stores/studio3dStore';

interface SceneCanvasProps {
  onCanvasReady: (canvas: HTMLCanvasElement) => void;
}

export const SceneCanvas: React.FC<SceneCanvasProps> = ({ onCanvasReady }) => {
  const store = useStudio3DStore();

  const handleRegisterCanvas = useCallback((canvas: HTMLCanvasElement) => {
    onCanvasReady(canvas);
  }, [onCanvasReady]);

  const hasSvg = !!store.svgData;
  const hasText = !!store.text;
  const hasContent = hasSvg || hasText;

  if (!hasContent) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: store.background }}>
        <p className="text-neutral-600 text-xs uppercase tracking-widest">
          Upload SVG / PNG or type text
        </p>
      </div>
    );
  }

  return (
    <SVG3D
      key={store.resetKey}
      svg={hasSvg ? store.svgData : undefined}
      text={hasText && !hasSvg ? store.text : undefined}
      font={store.font}
      depth={store.depth}
      smoothness={store.smoothness}
      color={store.color}
      material={store.material}
      metalness={store.metalness}
      roughness={store.roughness}
      opacity={store.opacity}
      wireframe={store.wireframe}
      texture={store.texture || undefined}
      textureRepeat={store.textureRepeat}
      textureRotation={store.textureRotation}
      rotationX={store.rotationX}
      rotationY={store.rotationY}
      zoom={store.zoom}
      interactive={store.interactive}
      cursorOrbit={store.interactive}
      draggable={store.interactive}
      scrollZoom
      lightPosition={store.lightPosition}
      lightIntensity={store.lightIntensity}
      ambientIntensity={store.ambientIntensity}
      shadow={store.shadow}
      animate={store.animate}
      animateSpeed={store.animateSpeed}
      animateReverse={store.animateReverse}
      intro="zoom"
      introDuration={0.6}
      background={store.transparentBg ? 'transparent' : store.background}
      width="100%"
      height="100%"
      registerCanvas={handleRegisterCanvas}
    />
  );
};

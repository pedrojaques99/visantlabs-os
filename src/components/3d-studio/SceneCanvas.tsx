import React, { useCallback, useMemo } from 'react';
import { SVG3D } from '3dsvg';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import { ShaderPostProcess } from '@/effects/ShaderPostProcess';
import { CameraBridge } from './CameraBridge';

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

export const SceneCanvas: React.FC<SceneCanvasProps> = React.memo(({ onCanvasReady }) => {
  const s = useStudio3DStore(useShallow(sceneSelector));

  const shaderSettings = useMemo(() => {
    if (!s.shaderEnabled) return null;
    return s.getShaderSettings();
  }, [s.shaderEnabled, s.shaderType, s.shaderValues, s.getShaderSettings]);

  const halftoneVariant = s.shaderValues.halftoneVariant ?? 'ellipse';

  const handleRegisterCanvas = useCallback((canvas: HTMLCanvasElement) => {
    onCanvasReady(canvas);
  }, [onCanvasReady]);

  const hasSvg = !!s.svgData;
  const hasText = !!s.text;
  const hasContent = hasSvg || hasText;

  return (
    <SVG3D
      key={s.resetKey}
      svg={hasSvg ? s.svgData : undefined}
      text={!hasSvg ? (hasText ? s.text : '®') : undefined}
      font={s.font}
      depth={s.depth}
      smoothness={s.smoothness}
      color={s.color}
      material={s.material as any}
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
      interactive={true}
      cursorOrbit={false}
      draggable={true}
      scrollZoom={true}
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
    >
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
    </SVG3D>
  );
});

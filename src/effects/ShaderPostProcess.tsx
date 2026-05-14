import React, { useEffect, useMemo, useRef } from 'react';
import { Vector2 } from 'three';
import { EffectComposer } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { DynamicShaderEffect } from './createShaderEffect';
import type { ShaderType, HalftoneVariant } from '@/utils/shaders/shaderRegistry';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';

interface ShaderPostProcessProps {
  shaderType: ShaderType;
  settings: ShaderSettings;
  halftoneVariant?: HalftoneVariant;
}

const ShaderEffectBridge: React.FC<{
  shaderType: ShaderType;
  settings: ShaderSettings;
  halftoneVariant: HalftoneVariant;
}> = ({ shaderType, settings, halftoneVariant }) => {
  const effectRef = useRef<DynamicShaderEffect | null>(null);

  const effect = useMemo(() => {
    const e = new DynamicShaderEffect(shaderType, settings, halftoneVariant);
    effectRef.current = e;
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderType, halftoneVariant]);

  useEffect(() => {
    effect.updateUniforms(settings);
  }, [effect, settings]);

  useFrame((_state, delta) => {
    effect.update(null, null, delta);
  });

  useEffect(() => {
    return () => {
      effectRef.current?.dispose();
      effectRef.current = null;
    };
  }, [effect]);

  return <primitive object={effect} dispose={null} />;
};

export const ShaderPostProcess: React.FC<ShaderPostProcessProps> = React.memo(
  ({ shaderType, settings, halftoneVariant = 'ellipse' }) => {
    return (
      <EffectComposer multisampling={0}>
        <ShaderEffectBridge
          shaderType={shaderType}
          settings={settings}
          halftoneVariant={halftoneVariant}
        />
      </EffectComposer>
    );
  },
);

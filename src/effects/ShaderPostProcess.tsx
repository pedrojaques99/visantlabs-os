import React, { useEffect, useMemo, useRef } from 'react';
import { EffectComposer } from '@react-three/postprocessing';
import { useFrame, useThree } from '@react-three/fiber';
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
  const prevEffectRef = useRef<DynamicShaderEffect | null>(null);
  const { size } = useThree();

  const effect = useMemo(() => {
    const prev = prevEffectRef.current;
    const e = new DynamicShaderEffect(shaderType, settings, halftoneVariant);
    prevEffectRef.current = e;
    if (prev) prev.dispose();
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shaderType, halftoneVariant]);

  useEffect(() => {
    effect.updateUniforms(settings);
  }, [effect, settings]);

  useFrame((_state, delta) => {
    effect.update(null, null, delta, size.width, size.height);
  });

  useEffect(() => {
    return () => {
      prevEffectRef.current?.dispose();
      prevEffectRef.current = null;
    };
  }, []);

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

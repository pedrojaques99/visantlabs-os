import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from './_shared';
import { ToolPanelDisclosure, ToolPanelRow } from '@/components/shared/ToolPanel';
import { ShaderControls } from '@/components/shared/ShaderControls';

// Fine-grained subscription: only the post-processing / effects slice (was a
// full-store subscription re-rendering on any mutation). Actions are stable
// identities, so including them under useShallow is free.
const effectsPanelSelector = (s: StoreState) => ({
  effectsBypass: s.effectsBypass,
  bloomEnabled: s.bloomEnabled,
  bloomIntensity: s.bloomIntensity,
  bloomThreshold: s.bloomThreshold,
  dofEnabled: s.dofEnabled,
  dofFocusDistance: s.dofFocusDistance,
  dofBokehScale: s.dofBokehScale,
  chromaticAberrationEnabled: s.chromaticAberrationEnabled,
  chromaticAberrationOffset: s.chromaticAberrationOffset,
  ssaoEnabled: s.ssaoEnabled,
  ssaoIntensity: s.ssaoIntensity,
  noiseEnabled: s.noiseEnabled,
  noiseOpacity: s.noiseOpacity,
  vignetteEnabled: s.vignetteEnabled,
  vignetteIntensity: s.vignetteIntensity,
  colorGradingEnabled: s.colorGradingEnabled,
  cgBrightness: s.cgBrightness,
  cgContrast: s.cgContrast,
  cgHue: s.cgHue,
  cgSaturation: s.cgSaturation,
  shaderEnabled: s.shaderEnabled,
  shaderType: s.shaderType,
  shaderValues: s.shaderValues,
  setEffectsBypass: s.setEffectsBypass,
  setBloomEnabled: s.setBloomEnabled,
  setBloomIntensity: s.setBloomIntensity,
  setBloomThreshold: s.setBloomThreshold,
  setDofEnabled: s.setDofEnabled,
  setDofFocusDistance: s.setDofFocusDistance,
  setDofBokehScale: s.setDofBokehScale,
  setChromaticAberrationEnabled: s.setChromaticAberrationEnabled,
  setChromaticAberrationOffset: s.setChromaticAberrationOffset,
  setSsaoEnabled: s.setSsaoEnabled,
  setSsaoIntensity: s.setSsaoIntensity,
  setNoiseEnabled: s.setNoiseEnabled,
  setNoiseOpacity: s.setNoiseOpacity,
  setVignetteEnabled: s.setVignetteEnabled,
  setVignetteIntensity: s.setVignetteIntensity,
  setColorGradingEnabled: s.setColorGradingEnabled,
  setCgBrightness: s.setCgBrightness,
  setCgContrast: s.setCgContrast,
  setCgHue: s.setCgHue,
  setCgSaturation: s.setCgSaturation,
  setShaderEnabled: s.setShaderEnabled,
  setShaderType: s.setShaderType,
  setShaderValue: s.setShaderValue,
});

export const EffectsTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore(useShallow(effectsPanelSelector));

  const [ssaoIntensity, setSsaoIntensity] = useDebouncedSlider(
    store.ssaoIntensity,
    store.setSsaoIntensity
  );
  const [bloomIntensity, setBloomIntensity] = useDebouncedSlider(
    store.bloomIntensity,
    store.setBloomIntensity
  );
  const [bloomThreshold, setBloomThreshold] = useDebouncedSlider(
    store.bloomThreshold,
    store.setBloomThreshold
  );
  const [chromaticAberrationOffset, setChromaticAberrationOffset] = useDebouncedSlider(
    store.chromaticAberrationOffset,
    store.setChromaticAberrationOffset
  );
  const [dofFocusDistance, setDofFocusDistance] = useDebouncedSlider(
    store.dofFocusDistance,
    store.setDofFocusDistance
  );
  const [dofBokehScale, setDofBokehScale] = useDebouncedSlider(
    store.dofBokehScale,
    store.setDofBokehScale
  );
  const [noiseOpacity, setNoiseOpacity] = useDebouncedSlider(
    store.noiseOpacity,
    store.setNoiseOpacity
  );
  const [vignetteIntensity, setVignetteIntensity] = useDebouncedSlider(
    store.vignetteIntensity,
    store.setVignetteIntensity
  );
  const [cgBrightness, setCgBrightness] = useDebouncedSlider(
    store.cgBrightness,
    store.setCgBrightness
  );
  const [cgContrast, setCgContrast] = useDebouncedSlider(store.cgContrast, store.setCgContrast);
  const [cgHue, setCgHue] = useDebouncedSlider(store.cgHue, store.setCgHue);
  const [cgSaturation, setCgSaturation] = useDebouncedSlider(
    store.cgSaturation,
    store.setCgSaturation
  );

  return (
    <>
      <ToolPanelRow label="Before / After">
        <Switch
          checked={!store.effectsBypass}
          onCheckedChange={(v) => store.setEffectsBypass(!v)}
          aria-label="Toggle all effects"
        />
      </ToolPanelRow>

      {/* Bloom */}
      <ToolPanelRow label={t('studio3d.panels.bloom')}>
        <Switch
          checked={store.bloomEnabled}
          onCheckedChange={store.setBloomEnabled}
          aria-label="Bloom"
        />
      </ToolPanelRow>
      {store.bloomEnabled && (
        <div className="grid grid-cols-2 gap-1.5">
          <ScrubInput
            label="Intensity"
            value={bloomIntensity}
            min={0}
            max={5}
            step={0.1}
            onChange={setBloomIntensity}
            hint="Bloom glow strength"
          />
          <ScrubInput
            label="Threshold"
            value={bloomThreshold}
            min={0}
            max={1}
            step={0.01}
            onChange={setBloomThreshold}
            hint="Brightness cutoff — only pixels above this value glow"
          />
        </div>
      )}

      {/* Depth of Field — enable visible, numerics under Advanced */}
      <ToolPanelRow label={t('studio3d.panels.depthOfField')}>
        <Switch
          checked={store.dofEnabled}
          onCheckedChange={store.setDofEnabled}
          aria-label="Depth of field"
        />
      </ToolPanelRow>

      {/* Film Grain */}
      <ToolPanelRow label={t('studio3d.panels.filmGrain')}>
        <Switch
          checked={store.noiseEnabled}
          onCheckedChange={store.setNoiseEnabled}
          aria-label="Film grain"
        />
      </ToolPanelRow>
      {store.noiseEnabled && (
        <ScrubInput
          label="Amount"
          value={noiseOpacity}
          min={0}
          max={0.5}
          step={0.01}
          onChange={setNoiseOpacity}
        />
      )}

      {/* Vignette */}
      <ToolPanelRow label={t('studio3d.panels.vignette')}>
        <Switch
          checked={store.vignetteEnabled}
          onCheckedChange={store.setVignetteEnabled}
          aria-label="Vignette"
        />
      </ToolPanelRow>
      {store.vignetteEnabled && (
        <ScrubInput
          label="Darkness"
          value={vignetteIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={setVignetteIntensity}
        />
      )}

      {/* Color Grading — own top-level disclosure */}
      <ToolPanelDisclosure label={t('studio3d.panels.colorGrading')}>
        <ToolPanelRow label="Enable">
          <Switch
            checked={store.colorGradingEnabled}
            onCheckedChange={store.setColorGradingEnabled}
            aria-label="Color grading"
          />
        </ToolPanelRow>
        {store.colorGradingEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="Bright"
              value={cgBrightness}
              min={-0.5}
              max={0.5}
              step={0.01}
              onChange={setCgBrightness}
            />
            <ScrubInput
              label="Contrast"
              value={cgContrast}
              min={-0.5}
              max={0.5}
              step={0.01}
              onChange={setCgContrast}
            />
            <ScrubInput
              label="Hue"
              value={cgHue}
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              onChange={setCgHue}
            />
            <ScrubInput
              label="Sat"
              value={cgSaturation}
              min={-1}
              max={1}
              step={0.01}
              onChange={setCgSaturation}
            />
          </div>
        )}
      </ToolPanelDisclosure>

      {/* Shader FX */}
      <ToolPanelDisclosure label={t('studio3d.panels.shaderFx')}>
        <ToolPanelRow label="Enable">
          <Switch
            checked={store.shaderEnabled}
            onCheckedChange={store.setShaderEnabled}
            aria-label="Shader FX"
          />
        </ToolPanelRow>
        {store.shaderEnabled && (
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
            hideToggle
          />
        )}
      </ToolPanelDisclosure>

      {/* Advanced — over-senior controls */}
      <ToolPanelDisclosure label="Advanced" defaultOpen={false}>
        {store.dofEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label="DOF Focus"
              value={dofFocusDistance}
              min={0}
              max={0.1}
              step={0.001}
              onChange={setDofFocusDistance}
              hint="Focus distance — objects at this depth stay sharp"
            />
            <ScrubInput
              label="DOF Bokeh"
              value={dofBokehScale}
              min={0}
              max={10}
              step={0.1}
              onChange={setDofBokehScale}
              hint="Blur intensity for out-of-focus areas"
            />
          </div>
        )}

        <ToolPanelRow label={t('studio3d.panels.chromaticAberration')}>
          <Switch
            checked={store.chromaticAberrationEnabled}
            onCheckedChange={store.setChromaticAberrationEnabled}
            aria-label="Chromatic aberration"
          />
        </ToolPanelRow>
        {store.chromaticAberrationEnabled && (
          <ScrubInput
            label="Offset"
            value={chromaticAberrationOffset}
            min={0}
            max={0.02}
            step={0.0005}
            onChange={setChromaticAberrationOffset}
            hint="RGB color fringe at edges — simulates lens imperfection"
          />
        )}

        <ToolPanelRow label={t('studio3d.panels.ambientOcclusion')}>
          <Switch
            checked={store.ssaoEnabled}
            onCheckedChange={store.setSsaoEnabled}
            aria-label="SSAO"
          />
        </ToolPanelRow>
        {store.ssaoEnabled && (
          <ScrubInput
            label="AO Intensity"
            value={ssaoIntensity}
            min={0}
            max={2}
            step={0.05}
            onChange={setSsaoIntensity}
            hint="Screen-space ambient occlusion — darkens crevices and contact areas"
          />
        )}
      </ToolPanelDisclosure>
    </>
  );
});

import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { ToolPanelSection, ToolPanelDisclosure, ToolPanelRow } from '@/components/shared/ToolPanel';
import { ShaderControls } from '@/components/shared/ShaderControls';

export const EffectsTab: React.FC = React.memo(() => {
  const store = useStudio3DStore();

  const [ssaoIntensity, setSsaoIntensity] = useDebouncedSlider(store.ssaoIntensity, store.setSsaoIntensity);
  const [bloomIntensity, setBloomIntensity] = useDebouncedSlider(store.bloomIntensity, store.setBloomIntensity);
  const [bloomThreshold, setBloomThreshold] = useDebouncedSlider(store.bloomThreshold, store.setBloomThreshold);
  const [chromaticAberrationOffset, setChromaticAberrationOffset] = useDebouncedSlider(store.chromaticAberrationOffset, store.setChromaticAberrationOffset);
  const [dofFocusDistance, setDofFocusDistance] = useDebouncedSlider(store.dofFocusDistance, store.setDofFocusDistance);
  const [dofBokehScale, setDofBokehScale] = useDebouncedSlider(store.dofBokehScale, store.setDofBokehScale);
  const [noiseOpacity, setNoiseOpacity] = useDebouncedSlider(store.noiseOpacity, store.setNoiseOpacity);
  const [vignetteIntensity, setVignetteIntensity] = useDebouncedSlider(store.vignetteIntensity, store.setVignetteIntensity);
  const [cgBrightness, setCgBrightness] = useDebouncedSlider(store.cgBrightness, store.setCgBrightness);
  const [cgContrast, setCgContrast] = useDebouncedSlider(store.cgContrast, store.setCgContrast);
  const [cgHue, setCgHue] = useDebouncedSlider(store.cgHue, store.setCgHue);
  const [cgSaturation, setCgSaturation] = useDebouncedSlider(store.cgSaturation, store.setCgSaturation);

  return (
    <>
      {/* Post-processing — always visible */}
      <ToolPanelSection title="POST-PROCESSING">
        <ToolPanelRow label="Ambient Occlusion">
          <Switch checked={store.ssaoEnabled} onCheckedChange={store.setSsaoEnabled} aria-label="SSAO" />
        </ToolPanelRow>
        {store.ssaoEnabled && (
          <ScrubInput label="AO Intensity" value={ssaoIntensity} min={0} max={2} step={0.05} onChange={setSsaoIntensity} />
        )}

        {/* Bloom */}
        <ToolPanelRow label="Bloom">
          <Switch checked={store.bloomEnabled} onCheckedChange={store.setBloomEnabled} aria-label="Bloom" />
        </ToolPanelRow>
        {store.bloomEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Intensity" value={bloomIntensity} min={0} max={5} step={0.1} onChange={setBloomIntensity} />
            <ScrubInput label="Threshold" value={bloomThreshold} min={0} max={1} step={0.01} onChange={setBloomThreshold} />
          </div>
        )}

        {/* Chromatic Aberration */}
        <ToolPanelRow label="Chromatic Aberration">
          <Switch checked={store.chromaticAberrationEnabled} onCheckedChange={store.setChromaticAberrationEnabled} aria-label="Chromatic aberration" />
        </ToolPanelRow>
        {store.chromaticAberrationEnabled && (
          <ScrubInput label="Offset" value={chromaticAberrationOffset} min={0} max={0.02} step={0.0005} onChange={setChromaticAberrationOffset} />
        )}

        {/* DOF */}
        <ToolPanelRow label="Depth of Field">
          <Switch checked={store.dofEnabled} onCheckedChange={store.setDofEnabled} aria-label="Depth of field" />
        </ToolPanelRow>
        {store.dofEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Focus" value={dofFocusDistance} min={0} max={0.1} step={0.001} onChange={setDofFocusDistance} />
            <ScrubInput label="Bokeh" value={dofBokehScale} min={0} max={10} step={0.1} onChange={setDofBokehScale} />
          </div>
        )}

        {/* Film Grain */}
        <ToolPanelRow label="Film Grain">
          <Switch checked={store.noiseEnabled} onCheckedChange={store.setNoiseEnabled} aria-label="Film grain" />
        </ToolPanelRow>
        {store.noiseEnabled && (
          <ScrubInput label="Amount" value={noiseOpacity} min={0} max={0.5} step={0.01} onChange={setNoiseOpacity} />
        )}

        {/* Vignette */}
        <ToolPanelRow label="Vignette">
          <Switch checked={store.vignetteEnabled} onCheckedChange={store.setVignetteEnabled} aria-label="Vignette" />
        </ToolPanelRow>
        {store.vignetteEnabled && (
          <ScrubInput label="Darkness" value={vignetteIntensity} min={0} max={1} step={0.01} onChange={setVignetteIntensity} />
        )}

        {/* Color Grading */}
        <ToolPanelRow label="Color Grading">
          <Switch checked={store.colorGradingEnabled} onCheckedChange={store.setColorGradingEnabled} aria-label="Color grading" />
        </ToolPanelRow>
        {store.colorGradingEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Bright" value={cgBrightness} min={-0.5} max={0.5} step={0.01} onChange={setCgBrightness} />
            <ScrubInput label="Contrast" value={cgContrast} min={-0.5} max={0.5} step={0.01} onChange={setCgContrast} />
            <ScrubInput label="Hue" value={cgHue} min={-Math.PI} max={Math.PI} step={0.01} onChange={setCgHue} />
            <ScrubInput label="Sat" value={cgSaturation} min={-1} max={1} step={0.01} onChange={setCgSaturation} />
          </div>
        )}
      </ToolPanelSection>

      {/* Shader FX — collapsible */}
      <ToolPanelDisclosure label="Shader FX">
        <ShaderControls
          enabled={store.shaderEnabled}
          shaderType={store.shaderType}
          values={store.shaderValues}
          onEnabledChange={store.setShaderEnabled}
          onTypeChange={store.setShaderType}
          onValueChange={store.setShaderValue}
        />
      </ToolPanelDisclosure>
    </>
  );
});

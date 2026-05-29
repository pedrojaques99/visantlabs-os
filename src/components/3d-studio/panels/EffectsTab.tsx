import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { ToolPanelDisclosure, ToolPanelRow } from '@/components/shared/ToolPanel';
import { ShaderControls } from '@/components/shared/ShaderControls';

export const EffectsTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
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

  const lensCount = [store.bloomEnabled, store.dofEnabled, store.chromaticAberrationEnabled].filter(Boolean).length;
  const filmCount = [store.ssaoEnabled, store.noiseEnabled, store.vignetteEnabled].filter(Boolean).length;

  return (
    <>
      <ToolPanelRow label="Before / After">
        <Switch checked={!store.effectsBypass} onCheckedChange={(v) => store.setEffectsBypass(!v)} aria-label="Toggle all effects" />
      </ToolPanelRow>

      {/* Lens — optical effects */}
      <ToolPanelDisclosure
        label="Lens"
        defaultOpen
        badge={lensCount > 0 ? <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{lensCount}</span> : undefined}
      >
        <ToolPanelRow label={t('studio3d.panels.bloom')}>
          <Switch checked={store.bloomEnabled} onCheckedChange={store.setBloomEnabled} aria-label="Bloom" />
        </ToolPanelRow>
        {store.bloomEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Intensity" value={bloomIntensity} min={0} max={5} step={0.1} onChange={setBloomIntensity} hint="Bloom glow strength" />
            <ScrubInput label="Threshold" value={bloomThreshold} min={0} max={1} step={0.01} onChange={setBloomThreshold} hint="Brightness cutoff — only pixels above this value glow" />
          </div>
        )}

        <ToolPanelRow label={t('studio3d.panels.depthOfField')}>
          <Switch checked={store.dofEnabled} onCheckedChange={store.setDofEnabled} aria-label="Depth of field" />
        </ToolPanelRow>
        {store.dofEnabled && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Focus" value={dofFocusDistance} min={0} max={0.1} step={0.001} onChange={setDofFocusDistance} hint="Focus distance — objects at this depth stay sharp" />
            <ScrubInput label="Bokeh" value={dofBokehScale} min={0} max={10} step={0.1} onChange={setDofBokehScale} hint="Blur intensity for out-of-focus areas" />
          </div>
        )}

        <ToolPanelRow label={t('studio3d.panels.chromaticAberration')}>
          <Switch checked={store.chromaticAberrationEnabled} onCheckedChange={store.setChromaticAberrationEnabled} aria-label="Chromatic aberration" />
        </ToolPanelRow>
        {store.chromaticAberrationEnabled && (
          <ScrubInput label="Offset" value={chromaticAberrationOffset} min={0} max={0.02} step={0.0005} onChange={setChromaticAberrationOffset} hint="RGB color fringe at edges — simulates lens imperfection" />
        )}
      </ToolPanelDisclosure>

      {/* Film — texture & atmosphere */}
      <ToolPanelDisclosure
        label="Film"
        defaultOpen
        badge={filmCount > 0 ? <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{filmCount}</span> : undefined}
      >
        <ToolPanelRow label={t('studio3d.panels.ambientOcclusion')}>
          <Switch checked={store.ssaoEnabled} onCheckedChange={store.setSsaoEnabled} aria-label="SSAO" />
        </ToolPanelRow>
        {store.ssaoEnabled && (
          <ScrubInput label="AO Intensity" value={ssaoIntensity} min={0} max={2} step={0.05} onChange={setSsaoIntensity} hint="Screen-space ambient occlusion — darkens crevices and contact areas" />
        )}

        <ToolPanelRow label={t('studio3d.panels.filmGrain')}>
          <Switch checked={store.noiseEnabled} onCheckedChange={store.setNoiseEnabled} aria-label="Film grain" />
        </ToolPanelRow>
        {store.noiseEnabled && (
          <ScrubInput label="Amount" value={noiseOpacity} min={0} max={0.5} step={0.01} onChange={setNoiseOpacity} />
        )}

        <ToolPanelRow label={t('studio3d.panels.vignette')}>
          <Switch checked={store.vignetteEnabled} onCheckedChange={store.setVignetteEnabled} aria-label="Vignette" />
        </ToolPanelRow>
        {store.vignetteEnabled && (
          <ScrubInput label="Darkness" value={vignetteIntensity} min={0} max={1} step={0.01} onChange={setVignetteIntensity} />
        )}
      </ToolPanelDisclosure>

      {/* Color Grading */}
      <ToolPanelDisclosure
        label="Color"
        badge={store.colorGradingEnabled ? <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">on</span> : undefined}
      >
        <ToolPanelRow label={t('studio3d.panels.colorGrading')}>
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
      </ToolPanelDisclosure>

      {/* Shader FX — standardized disclosure */}
      <ToolPanelDisclosure
        label={t('studio3d.panels.shaderFx')}
        badge={store.shaderEnabled ? <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{store.shaderType}</span> : undefined}
      >
        <ToolPanelRow label="Enable">
          <Switch checked={store.shaderEnabled} onCheckedChange={store.setShaderEnabled} aria-label="Shader FX" />
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
    </>
  );
});

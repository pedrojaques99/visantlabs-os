import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  TONE_MAPPING_OPTIONS,
  ENVIRONMENT_PRESETS,
  LIGHTING_PRESETS,
} from '@/stores/studio3dStore';
import { ToolPanelDisclosure, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { HexColorPicker } from 'react-colorful';
import { setCameraView, resetCamera } from '../CameraBridge';
import { LightPositionSliders } from './_shared';

export const CameraTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();
  const hdriInputRef = useRef<HTMLInputElement>(null);
  const [bgColorPickerOpen, setBgColorPickerOpen] = useState(false);

  const [fov, setFov] = useDebouncedSlider(store.fov, store.setFov);
  const [toneMappingExposure, setToneMappingExposure] = useDebouncedSlider(store.toneMappingExposure, store.setToneMappingExposure);
  const [groundReflection, setGroundReflection] = useDebouncedSlider(store.groundReflection, store.setGroundReflection);
  const [lightIntensity, setLightIntensity] = useDebouncedSlider(store.lightIntensity, store.setLightIntensity);
  const [ambientIntensity, setAmbientIntensity] = useDebouncedSlider(store.ambientIntensity, store.setAmbientIntensity);
  const [fillLightIntensity, setFillLightIntensity] = useDebouncedSlider(store.fillLightIntensity, store.setFillLightIntensity);
  const [bounceLightIntensity, setBounceLightIntensity] = useDebouncedSlider(store.bounceLightIntensity, store.setBounceLightIntensity);
  const [pointLightIntensity, setPointLightIntensity] = useDebouncedSlider(store.pointLightIntensity, store.setPointLightIntensity);
  const [bgAngle, setBgAngle] = useDebouncedSlider(store.bgGradient.angle, (v) => store.setBgGradient({ angle: v }));
  const [hdriBlur, setHdriBlur] = useDebouncedSlider(store.hdriBlur, store.setHdriBlur);
  const [hdriIntensity, setHdriIntensity] = useDebouncedSlider(store.hdriIntensity, store.setHdriIntensity);
  const [hdriRotation, setHdriRotation] = useDebouncedSlider(store.hdriRotation, store.setHdriRotation);
  const [fogNear, setFogNear] = useDebouncedSlider(store.fogNear, store.setFogNear);
  const [fogFar, setFogFar] = useDebouncedSlider(store.fogFar, store.setFogFar);

  return (
    <>
      {/* Camera Views */}
      <ToolPanelDisclosure label={t('studio3d.camera.title')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {(['front', 'top', 'right', 'back', 'iso'] as const).map((view) => (
            <ToolPanelChip key={view} active={store._cameraInfo?.view === view} onClick={() => setCameraView(view)}>
              {t(`studio3d.camera.${view}`)}
            </ToolPanelChip>
          ))}
          <ToolPanelChip onClick={() => resetCamera()}>
            {t('studio3d.camera.reset')}
          </ToolPanelChip>
        </ToolPanelGrid>
        <div className="grid grid-cols-2 gap-1.5">
          <ToolPanelChip active={!store.orthographic} onClick={() => store.setOrthographic(false)}>Perspective</ToolPanelChip>
          <ToolPanelChip active={store.orthographic} onClick={() => store.setOrthographic(true)}>Orthographic</ToolPanelChip>
        </div>
        {!store.orthographic && (
          <ScrubInput label="FOV" value={fov} min={15} max={120} step={1} suffix="°" onChange={setFov} />
        )}
      </ToolPanelDisclosure>

      {/* Lighting */}
      <ToolPanelDisclosure label={t('studio3d.lighting.title')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {Object.keys(LIGHTING_PRESETS).map((name) => (
            <ToolPanelChip key={name} onClick={() => store.applyLightingPreset(name)}>
              {LIGHTING_PRESETS[name].label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <div className="grid grid-cols-2 gap-1.5">
          <ScrubInput label="Key" value={lightIntensity} min={0} max={3} step={0.05} onChange={setLightIntensity} />
          <ScrubInput label="Ambient" value={ambientIntensity} min={0} max={2} step={0.05} onChange={setAmbientIntensity} />
          <ScrubInput label="Fill" value={fillLightIntensity} min={0} max={2} step={0.05} onChange={setFillLightIntensity} />
          <ScrubInput label="Bounce" value={bounceLightIntensity} min={0} max={2} step={0.05} onChange={setBounceLightIntensity} />
        </div>
        <ScrubInput label="Top Light" value={pointLightIntensity} min={0} max={2} step={0.05} onChange={setPointLightIntensity} />
      </ToolPanelDisclosure>

      {/* Light Positions */}
      <ToolPanelDisclosure label="Light Positions">
        <LightPositionSliders label="Key Position" position={store.lightPosition} onChange={store.setLightPosition} />
        <LightPositionSliders label="Fill Position" position={store.fillLightPosition} onChange={store.setFillLightPosition} />
        <LightPositionSliders label="Bounce Position" position={store.bounceLightPosition} onChange={store.setBounceLightPosition} />
        <LightPositionSliders label="Top Position" position={store.pointLightPosition} onChange={store.setPointLightPosition} />
      </ToolPanelDisclosure>

      {/* Rendering & Tone Mapping */}
      <ToolPanelDisclosure label="RENDERING" defaultOpen>
        <ToolPanelGrid cols={3}>
          {(['performance', 'balanced', 'quality'] as const).map((q) => (
            <ToolPanelChip key={q} active={store.renderQuality === q} onClick={() => store.setRenderQuality(q)}>
              {t(`studio3d.geometry.quality${q.charAt(0).toUpperCase() + q.slice(1)}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <ScrubInput label="Exposure" value={toneMappingExposure} min={0.1} max={3} step={0.05} onChange={setToneMappingExposure} />
        <ToolPanelGrid cols={3}>
          {TONE_MAPPING_OPTIONS.map((tm) => (
            <ToolPanelChip key={tm.id} active={store.toneMapping === tm.id} onClick={() => store.setToneMapping(tm.id)}>
              {tm.label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
      </ToolPanelDisclosure>

      {/* Environment (HDRI + Background) */}
      <ToolPanelDisclosure label="Environment">
        <ToolPanelDisclosure label="HDRI" defaultOpen>
          <ToolPanelGrid cols={3}>
            {ENVIRONMENT_PRESETS.map((env) => (
              <ToolPanelChip key={env.id} active={store.environment === env.id && !store.customHdriUrl} onClick={() => store.setEnvironment(env.id)}>
                {env.label}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          <button
            onClick={() => hdriInputRef.current?.click()}
            className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
          >
            {store.customHdriUrl ? 'Custom HDRI loaded' : 'Upload .HDR'}
          </button>
          <input
            ref={hdriInputRef}
            type="file"
            accept=".hdr,.exr"
            aria-label="Upload custom HDRI"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                store.setCustomHdriUrl(url);
                toast.success('HDRI loaded');
              }
              e.target.value = '';
            }}
            className="hidden"
          />
          <ToolPanelRow label={t('studio3d.environment.hdriBackground')}>
            <Switch checked={store.hdriBackground} onCheckedChange={store.setHdriBackground} aria-label="HDRI as background" />
          </ToolPanelRow>
          <ScrubInput label="Rotation" value={hdriRotation} min={0} max={360} step={1} suffix="°" onChange={setHdriRotation} />
          {store.hdriBackground && (
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput label="Blur" value={hdriBlur} min={0} max={1} step={0.01} onChange={setHdriBlur} />
              <ScrubInput label="Intensity" value={hdriIntensity} min={0} max={3} step={0.05} onChange={setHdriIntensity} />
            </div>
          )}
          {store.customHdriUrl && (
            <button onClick={() => store.setEnvironment('studio')} className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors">
              Remove custom HDRI
            </button>
          )}
        </ToolPanelDisclosure>

        <ToolPanelDisclosure label={t('studio3d.background.title')} defaultOpen>
          <ToolPanelGrid cols={3}>
            {(['solid', 'linear', 'radial'] as const).map((type) => (
              <ToolPanelChip key={type} active={store.bgType === type} onClick={() => store.setBgType(type)}>
                {t(`studio3d.background.types.${type}`)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          {store.bgType === 'solid' ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBgColorPickerOpen(!bgColorPickerOpen)}
                  className="w-6 h-6 rounded border border-white/10 shrink-0 cursor-pointer hover:border-white/30 transition-colors"
                  style={{ backgroundColor: store.background }}
                  aria-label="Toggle background color picker"
                />
                <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-1">
                  <span className="text-[10px] text-neutral-500 mr-1">#</span>
                  <input
                    type="text"
                    value={store.background.replace('#', '').toUpperCase()}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setBackground(`#${v}`); }}
                    onBlur={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setBackground(`#${v}`); }}
                    maxLength={6}
                    aria-label="Background color"
                    className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
                    placeholder="0A0A0A"
                  />
                </div>
              </div>
              {bgColorPickerOpen && (
                <div className="animate-fade-in">
                  <div className="custom-color-picker"><HexColorPicker color={store.background} onChange={store.setBackground} /></div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{t('studio3d.background.color1')}</span>
                    <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: store.bgGradient.color1 }} />
                  </div>
                  <div className="custom-color-picker-mini"><HexColorPicker color={store.bgGradient.color1} onChange={(c) => store.setBgGradient({ color1: c })} /></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-neutral-500 uppercase tracking-widest">{t('studio3d.background.color2')}</span>
                    <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: store.bgGradient.color2 }} />
                  </div>
                  <div className="custom-color-picker-mini"><HexColorPicker color={store.bgGradient.color2} onChange={(c) => store.setBgGradient({ color2: c })} /></div>
                </div>
              </div>
              {store.bgType === 'linear' && (
                <ScrubInput label={t('studio3d.background.angle')} value={bgAngle} min={0} max={360} step={1} suffix="°" onChange={setBgAngle} />
              )}
            </div>
          )}
          <ToolPanelRow label={t('studio3d.background.transparent')}>
            <Switch checked={store.transparentBg} onCheckedChange={store.setTransparentBg} aria-label="Transparent background" />
          </ToolPanelRow>
        </ToolPanelDisclosure>
      </ToolPanelDisclosure>

      {/* Atmosphere */}
      <ToolPanelDisclosure label="Atmosphere">
        <ToolPanelRow label="Fog">
          <Switch checked={store.fogEnabled} onCheckedChange={store.setFogEnabled} aria-label="Fog" />
        </ToolPanelRow>
        {store.fogEnabled && (
          <>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded border border-white/10 shrink-0" style={{ backgroundColor: store.fogColor }} />
              <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                <span className="text-[10px] text-neutral-500 mr-1">#</span>
                <input
                  type="text"
                  value={store.fogColor.replace('#', '').toUpperCase()}
                  onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setFogColor(`#${v}`); }}
                  maxLength={6}
                  aria-label="Fog color"
                  className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput label="Near" value={fogNear} min={1} max={50} step={0.5} onChange={setFogNear} />
              <ScrubInput label="Far" value={fogFar} min={5} max={100} step={0.5} onChange={setFogFar} />
            </div>
          </>
        )}
      </ToolPanelDisclosure>

      {/* Scene Options */}
      <ToolPanelDisclosure label="Scene Options">
        <ToolPanelRow label={t('studio3d.lighting.shadows')}>
          <Switch checked={store.shadow} onCheckedChange={store.setShadow} aria-label="Shadow" />
        </ToolPanelRow>
        {store.shadow && (
          <ToolPanelGrid cols={3}>
            {(['low', 'medium', 'high'] as const).map((q) => (
              <ToolPanelChip key={q} active={store.shadowQuality === q} onClick={() => store.setShadowQuality(q)}>
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        )}
        <ToolPanelRow label="Ground Plane">
          <Switch checked={store.groundPlane} onCheckedChange={store.setGroundPlane} aria-label="Ground plane" />
        </ToolPanelRow>
        {store.groundPlane && (
          <ScrubInput label="Reflection" value={groundReflection} min={0} max={1} step={0.05} onChange={setGroundReflection} />
        )}
        <ToolPanelRow label={t('studio3d.lighting.grid')}>
          <Switch checked={store.showGrid} onCheckedChange={store.setShowGrid} aria-label="Grid" />
        </ToolPanelRow>
      </ToolPanelDisclosure>
    </>
  );
});

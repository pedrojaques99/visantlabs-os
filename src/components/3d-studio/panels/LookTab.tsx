import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  MATERIAL_PRESETS,
  ENVIRONMENT_PRESETS,
  LIGHTING_PRESETS,
} from '@/stores/studio3dStore';
import {
  ToolPanelSection, ToolPanelDisclosure, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { HexColorPicker } from 'react-colorful';
import { MaterialCategoryTabs, TextureControls, PbrMapUpload, LightPositionSliders } from './_shared';

export const LookTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();
  const hdriInputRef = useRef<HTMLInputElement>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [bgColorPickerOpen, setBgColorPickerOpen] = useState(false);

  const [metalness, setMetalness] = useDebouncedSlider(store.metalness, store.setMetalness);
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, store.setRoughness);
  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, store.setOpacity);
  const [textureOpacity, setTextureOpacity] = useDebouncedSlider(store.textureOpacity, store.setTextureOpacity);
  const [textureRotation, setTextureRotation] = useDebouncedSlider(store.textureRotation, store.setTextureRotation);
  const [lightIntensity, setLightIntensity] = useDebouncedSlider(store.lightIntensity, store.setLightIntensity);
  const [ambientIntensity, setAmbientIntensity] = useDebouncedSlider(store.ambientIntensity, store.setAmbientIntensity);
  const [fillLightIntensity, setFillLightIntensity] = useDebouncedSlider(store.fillLightIntensity, store.setFillLightIntensity);
  const [bounceLightIntensity, setBounceLightIntensity] = useDebouncedSlider(store.bounceLightIntensity, store.setBounceLightIntensity);
  const [pointLightIntensity, setPointLightIntensity] = useDebouncedSlider(store.pointLightIntensity, store.setPointLightIntensity);
  const [bgAngle, setBgAngle] = useDebouncedSlider(store.bgGradient.angle, (v) => store.setBgGradient({ angle: v }));

  return (
    <>
      {/* Material — always visible */}
      <ToolPanelSection title={t('studio3d.material.title')}>
        <MaterialCategoryTabs activeCat={MATERIAL_PRESETS.find((m) => m.id === store.material)?.category ?? 'basic'} store={store} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setColorPickerOpen(!colorPickerOpen)}
              className="w-8 h-8 rounded border border-white/10 shrink-0 cursor-pointer hover:border-white/30 transition-colors"
              style={{ backgroundColor: store.color }}
              aria-label="Toggle color picker"
            />
            <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-1">
              <span className="text-[10px] text-neutral-500 mr-1">#</span>
              <input
                type="text"
                value={store.color.replace('#', '').toUpperCase()}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setColor(`#${v}`); }}
                onBlur={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setColor(`#${v}`); }}
                maxLength={6}
                aria-label="Material color"
                className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
                placeholder="00E5FF"
              />
            </div>
          </div>
          {colorPickerOpen && (
            <div className="animate-fade-in">
              <div className="custom-color-picker"><HexColorPicker color={store.color} onChange={store.setColor} /></div>
            </div>
          )}
        </div>
      </ToolPanelSection>

      {/* Surface — always visible */}
      <ToolPanelSection title="SURFACE">
        <div className="grid grid-cols-3 gap-1.5">
          <ScrubInput label="Metal" value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} />
          <ScrubInput label="Rough" value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} />
          <ScrubInput label="Alpha" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
        </div>
        <ToolPanelRow label={t('studio3d.properties.wireframe')}>
          <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} aria-label="Wireframe" />
        </ToolPanelRow>
      </ToolPanelSection>

      {/* Texture & PBR — collapsible */}
      <ToolPanelDisclosure label="Texture & PBR">
        <TextureControls store={store} textureOpacity={textureOpacity} setTextureOpacity={setTextureOpacity} textureRotation={textureRotation} setTextureRotation={setTextureRotation} />
        <PbrMapUpload label="Normal Map" value={store.normalMapUrl} onChange={store.setNormalMapUrl} />
        <PbrMapUpload label="Roughness Map" value={store.roughnessMapUrl} onChange={store.setRoughnessMapUrl} />
        <PbrMapUpload label="Metalness Map" value={store.metalnessMapUrl} onChange={store.setMetalnessMapUrl} />
      </ToolPanelDisclosure>

      {/* Lighting — always visible */}
      <ToolPanelSection title={t('studio3d.lighting.title')}>
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
      </ToolPanelSection>

      {/* Light Positions — collapsible */}
      <ToolPanelDisclosure label="Light Positions">
        <LightPositionSliders label="Key Position" position={store.lightPosition} onChange={store.setLightPosition} />
        <LightPositionSliders label="Fill Position" position={store.fillLightPosition} onChange={store.setFillLightPosition} />
        <LightPositionSliders label="Bounce Position" position={store.bounceLightPosition} onChange={store.setBounceLightPosition} />
        <LightPositionSliders label="Top Position" position={store.pointLightPosition} onChange={store.setPointLightPosition} />
      </ToolPanelDisclosure>

      {/* Environment — collapsible */}
      <ToolPanelDisclosure label="Environment">
        <ToolPanelSection title="HDRI">
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
          {store.customHdriUrl && (
            <button onClick={() => store.setEnvironment('studio')} className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors">
              Remove custom HDRI
            </button>
          )}
        </ToolPanelSection>

        <ToolPanelSection title={t('studio3d.background.title')}>
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
        </ToolPanelSection>
      </ToolPanelDisclosure>
    </>
  );
});

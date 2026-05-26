import React, { useRef } from 'react';
import { toast } from 'sonner';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  MATERIAL_PRESETS,
  ENVIRONMENT_PRESETS,
  LIGHTING_PRESETS,
} from '@/stores/studio3dStore';
import { Diamond, Layers, Sun, Globe } from 'lucide-react';
import {
  ToolPanelSection, ToolPanelDisclosure, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { HexColorPicker } from 'react-colorful';
import { MaterialCategoryTabs, TextureControls, PbrMapUpload, LightPositionSliders } from './_shared';

export const LookTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();
  const hdriInputRef = useRef<HTMLInputElement>(null);

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
      {/* Material */}
      <ToolPanelDisclosure label={t('studio3d.material.title')} icon={<Diamond size={13} />} id="sec-material" defaultOpen>
        <MaterialCategoryTabs activeCat={MATERIAL_PRESETS.find((m) => m.id === store.material)?.category ?? 'basic'} store={store} />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded border border-white/10 shrink-0" style={{ backgroundColor: store.color }} />
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
          <div className="custom-color-picker"><HexColorPicker color={store.color} onChange={store.setColor} /></div>
        </div>
      </ToolPanelDisclosure>

      {/* Surface */}
      <ToolPanelDisclosure label="Surface" icon={<Layers size={13} />} id="sec-surface">
        <div className="space-y-3">
          <NodeSlider label={t('studio3d.properties.metalness')} value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} />
          <NodeSlider label={t('studio3d.properties.roughness')} value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} />
          <NodeSlider label={t('studio3d.properties.opacity')} value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
          <ToolPanelRow label={t('studio3d.properties.wireframe')}>
            <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} aria-label="Wireframe" />
          </ToolPanelRow>
        </div>
        <TextureControls store={store} textureOpacity={textureOpacity} setTextureOpacity={setTextureOpacity} textureRotation={textureRotation} setTextureRotation={setTextureRotation} />
        <PbrMapUpload label="Normal Map" value={store.normalMapUrl} onChange={store.setNormalMapUrl} />
        <PbrMapUpload label="Roughness Map" value={store.roughnessMapUrl} onChange={store.setRoughnessMapUrl} />
        <PbrMapUpload label="Metalness Map" value={store.metalnessMapUrl} onChange={store.setMetalnessMapUrl} />
      </ToolPanelDisclosure>

      {/* Lighting */}
      <ToolPanelDisclosure label={t('studio3d.lighting.title')} icon={<Sun size={13} />} id="sec-lighting">
        <ToolPanelGrid cols={3}>
          {Object.keys(LIGHTING_PRESETS).map((name) => (
            <ToolPanelChip key={name} onClick={() => store.applyLightingPreset(name)}>
              {LIGHTING_PRESETS[name].label}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <NodeSlider label={t('studio3d.lighting.keyLight')} value={lightIntensity} min={0} max={3} step={0.05} onChange={setLightIntensity} />
        <LightPositionSliders label="Key Position" position={store.lightPosition} onChange={store.setLightPosition} />
        <NodeSlider label={t('studio3d.lighting.ambient')} value={ambientIntensity} min={0} max={2} step={0.05} onChange={setAmbientIntensity} />
        <NodeSlider label="Fill Light" value={fillLightIntensity} min={0} max={2} step={0.05} onChange={setFillLightIntensity} />
        <LightPositionSliders label="Fill Position" position={store.fillLightPosition} onChange={store.setFillLightPosition} />
        <NodeSlider label="Bounce Light" value={bounceLightIntensity} min={0} max={2} step={0.05} onChange={setBounceLightIntensity} />
        <LightPositionSliders label="Bounce Position" position={store.bounceLightPosition} onChange={store.setBounceLightPosition} />
        <NodeSlider label="Top Light" value={pointLightIntensity} min={0} max={2} step={0.05} onChange={setPointLightIntensity} />
        <LightPositionSliders label="Top Position" position={store.pointLightPosition} onChange={store.setPointLightPosition} />
      </ToolPanelDisclosure>

      {/* Environment */}
      <ToolPanelDisclosure label="Environment" icon={<Globe size={13} />} id="sec-environment">
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
                <div className="w-6 h-6 rounded border border-white/10 shrink-0" style={{ backgroundColor: store.background }} />
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
              <div className="custom-color-picker"><HexColorPicker color={store.background} onChange={store.setBackground} /></div>
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
                <NodeSlider label={t('studio3d.background.angle')} value={bgAngle} min={0} max={360} step={1} onChange={setBgAngle} />
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

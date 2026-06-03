import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  MATERIAL_PRESETS,
  BLEND_MODE_OPTIONS,
} from '@/stores/studio3dStore';
import { ToolPanelDisclosure, ToolPanelRow, ExpandableColorPicker,
} from '@/components/shared/ToolPanel';
import { MaterialCategoryTabs, TextureControls, PbrMapUpload } from './_shared';

export const LookTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();

  const [metalness, setMetalness] = useDebouncedSlider(store.metalness, store.setMetalness);
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, store.setRoughness);
  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, store.setOpacity);
  const [envMapIntensity, setEnvMapIntensity] = useDebouncedSlider(store.envMapIntensity, store.setEnvMapIntensity);
  const [fresnelStrength, setFresnelStrength] = useDebouncedSlider(store.fresnelStrength, store.setFresnelStrength);
  const [textureOpacity, setTextureOpacity] = useDebouncedSlider(store.textureOpacity, store.setTextureOpacity);
  const [textureRotation, setTextureRotation] = useDebouncedSlider(store.textureRotation, store.setTextureRotation);

  return (
    <>
      <ToolPanelDisclosure label={t('studio3d.material.title')} defaultOpen>
        <MaterialCategoryTabs activeCat={MATERIAL_PRESETS.find((m) => m.id === store.material)?.category ?? 'basic'} store={store} />
        <ExpandableColorPicker color={store.color} onChange={store.setColor} label="Material color" />
      </ToolPanelDisclosure>

      <ToolPanelDisclosure label={t('studio3d.panels.surface')} defaultOpen>
        <div className="grid grid-cols-3 gap-1.5">
          <ScrubInput label="Metal" value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} hint="Metallic reflectivity — 0 = dielectric, 1 = full metal" />
          <ScrubInput label="Rough" value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} hint="Surface roughness — 0 = mirror, 1 = matte" />
          <ScrubInput label="Alpha" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} hint="Material opacity — 0 = transparent, 1 = solid" />
        </div>
        <ToolPanelRow label="Blend Mode">
          <select
            value={store.blendMode}
            onChange={(e) => store.setBlendMode(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            {BLEND_MODE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id} className="bg-neutral-900">{o.label}</option>
            ))}
          </select>
        </ToolPanelRow>
        <ScrubInput label="Env Reflect" value={envMapIntensity} min={0} max={5} step={0.1} onChange={setEnvMapIntensity} hint="Environment map intensity — higher = more reflective/glossy" />
        <ToolPanelRow label={t('studio3d.properties.wireframe')}>
          <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} aria-label="Wireframe" />
        </ToolPanelRow>
      </ToolPanelDisclosure>

      <ToolPanelDisclosure label="Fresnel Gradient">
        <ScrubInput label="Strength" value={fresnelStrength} min={0} max={1} step={0.01} onChange={setFresnelStrength} hint="Fresnel edge color intensity — 0 = off, 1 = full" />
        {fresnelStrength > 0 && (
          <ExpandableColorPicker color={store.fresnelColor || '#000000'} onChange={store.setFresnelColor} label="Fresnel color" />
        )}
      </ToolPanelDisclosure>

      <ToolPanelDisclosure label={t('studio3d.panels.texturePbr')}>
        <TextureControls store={store} textureOpacity={textureOpacity} setTextureOpacity={setTextureOpacity} textureRotation={textureRotation} setTextureRotation={setTextureRotation} />
        <PbrMapUpload label="Normal Map" value={store.normalMapUrl} onChange={store.setNormalMapUrl} />
        <PbrMapUpload label="Roughness Map" value={store.roughnessMapUrl} onChange={store.setRoughnessMapUrl} />
        <PbrMapUpload label="Metalness Map" value={store.metalnessMapUrl} onChange={store.setMetalnessMapUrl} />
      </ToolPanelDisclosure>
    </>
  );
});

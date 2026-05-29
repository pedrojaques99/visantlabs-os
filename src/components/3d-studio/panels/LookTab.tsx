import React, { useState } from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useStudio3DStore,
  MATERIAL_PRESETS,
} from '@/stores/studio3dStore';
import { ToolPanelDisclosure, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { HexColorPicker } from 'react-colorful';
import { MaterialCategoryTabs, TextureControls, PbrMapUpload } from './_shared';

export const LookTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const store = useStudio3DStore();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const [metalness, setMetalness] = useDebouncedSlider(store.metalness, store.setMetalness);
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, store.setRoughness);
  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, store.setOpacity);
  const [textureOpacity, setTextureOpacity] = useDebouncedSlider(store.textureOpacity, store.setTextureOpacity);
  const [textureRotation, setTextureRotation] = useDebouncedSlider(store.textureRotation, store.setTextureRotation);

  return (
    <>
      <ToolPanelDisclosure label={t('studio3d.material.title')} defaultOpen>
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
      </ToolPanelDisclosure>

      <ToolPanelDisclosure label={t('studio3d.panels.surface')} defaultOpen>
        <div className="grid grid-cols-3 gap-1.5">
          <ScrubInput label="Metal" value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} hint="Metallic reflectivity — 0 = dielectric, 1 = full metal" />
          <ScrubInput label="Rough" value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} hint="Surface roughness — 0 = mirror, 1 = matte" />
          <ScrubInput label="Alpha" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} hint="Material opacity — 0 = transparent, 1 = solid" />
        </div>
        <ToolPanelRow label={t('studio3d.properties.wireframe')}>
          <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} aria-label="Wireframe" />
        </ToolPanelRow>
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

import React from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { Select, type SelectOption } from '@/components/ui/select';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudio3DStore, MATERIAL_PRESETS, BLEND_MODE_OPTIONS } from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import {
  ToolPanelDisclosure,
  ToolPanelRow,
  ExpandableColorPicker,
} from '@/components/shared/ToolPanel';
import { MaterialCategoryTabs, TextureControls, PbrMapUpload, type StoreState } from './_shared';

// Fine-grained subscription: only the material / surface / texture / PBR slice
// (was a full-store subscription). Includes the fields the shared
// MaterialCategoryTabs and TextureControls children read off `store`.
const lookPanelSelector = (s: StoreState) => ({
  material: s.material,
  color: s.color,
  metalness: s.metalness,
  roughness: s.roughness,
  opacity: s.opacity,
  blendMode: s.blendMode,
  envMapIntensity: s.envMapIntensity,
  wireframe: s.wireframe,
  fresnelColor: s.fresnelColor,
  fresnelStrength: s.fresnelStrength,
  texture: s.texture,
  textureRepeat: s.textureRepeat,
  textureOpacity: s.textureOpacity,
  textureRotation: s.textureRotation,
  normalMapUrl: s.normalMapUrl,
  roughnessMapUrl: s.roughnessMapUrl,
  metalnessMapUrl: s.metalnessMapUrl,
  setMaterial: s.setMaterial,
  setColor: s.setColor,
  setMetalness: s.setMetalness,
  setRoughness: s.setRoughness,
  setOpacity: s.setOpacity,
  setBlendMode: s.setBlendMode,
  setEnvMapIntensity: s.setEnvMapIntensity,
  setWireframe: s.setWireframe,
  setFresnelColor: s.setFresnelColor,
  setFresnelStrength: s.setFresnelStrength,
  setTexture: s.setTexture,
  setTextureRepeat: s.setTextureRepeat,
  setTextureOpacity: s.setTextureOpacity,
  setTextureRotation: s.setTextureRotation,
  setNormalMapUrl: s.setNormalMapUrl,
  setRoughnessMapUrl: s.setRoughnessMapUrl,
  setMetalnessMapUrl: s.setMetalnessMapUrl,
});

export const LookTab: React.FC = React.memo(() => {
  const { t, tOr } = useTranslation();
  const store = useStudio3DStore(useShallow(lookPanelSelector));

  // Blend Mode options for the shared <Select> (mapped from the store SSoT).
  const blendModeOptions: SelectOption[] = BLEND_MODE_OPTIONS.map((o) => ({
    value: o.id,
    label: tOr(`studio3d.properties.blendModes.${o.id}`, o.label),
  }));

  const [metalness, setMetalness] = useDebouncedSlider(store.metalness, store.setMetalness);
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, store.setRoughness);
  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, store.setOpacity);
  const [envMapIntensity, setEnvMapIntensity] = useDebouncedSlider(
    store.envMapIntensity,
    store.setEnvMapIntensity
  );
  const [fresnelStrength, setFresnelStrength] = useDebouncedSlider(
    store.fresnelStrength,
    store.setFresnelStrength
  );
  const [textureOpacity, setTextureOpacity] = useDebouncedSlider(
    store.textureOpacity,
    store.setTextureOpacity
  );
  const [textureRotation, setTextureRotation] = useDebouncedSlider(
    store.textureRotation,
    store.setTextureRotation
  );

  return (
    <>
      {/* Essentials — material + core surface controls, always visible */}
      <ToolPanelDisclosure label={t('studio3d.material.title')} defaultOpen>
        <MaterialCategoryTabs
          activeCat={MATERIAL_PRESETS.find((m) => m.id === store.material)?.category ?? 'basic'}
          store={store}
        />
        <ExpandableColorPicker
          color={store.color}
          onChange={store.setColor}
          label={t('studio3d.basics.materialColor')}
        />
        <div className="grid grid-cols-3 gap-1.5">
          <ScrubInput
            label={t('studio3d.properties.metalness')}
            value={metalness}
            min={0}
            max={1}
            step={0.01}
            onChange={setMetalness}
            hint={t('studio3d.properties.metalnessHint')}
          />
          <ScrubInput
            label={t('studio3d.properties.roughness')}
            value={roughness}
            min={0}
            max={1}
            step={0.01}
            onChange={setRoughness}
            hint={t('studio3d.properties.roughnessHint')}
          />
          <ScrubInput
            label={t('studio3d.properties.opacity')}
            value={opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={setOpacity}
            hint={t('studio3d.properties.opacityHint')}
          />
        </div>
      </ToolPanelDisclosure>

      {/* Texture — secondary, kept visible */}
      <ToolPanelDisclosure label={t('studio3d.panels.texturePbr')}>
        <TextureControls
          store={store}
          textureOpacity={textureOpacity}
          setTextureOpacity={setTextureOpacity}
          textureRotation={textureRotation}
          setTextureRotation={setTextureRotation}
        />
      </ToolPanelDisclosure>

      {/* Advanced — over-senior controls, flat (no nesting), collapsed by default */}
      <ToolPanelDisclosure label={t('studio3d.panels.advanced')} defaultOpen={false}>
        <ToolPanelRow label={t('studio3d.properties.wireframe')}>
          <Switch
            checked={store.wireframe}
            onCheckedChange={store.setWireframe}
            aria-label={t('studio3d.properties.wireframe')}
          />
        </ToolPanelRow>

        <ScrubInput
          label={t('studio3d.properties.fresnel')}
          value={fresnelStrength}
          min={0}
          max={1}
          step={0.01}
          onChange={setFresnelStrength}
          hint={t('studio3d.properties.fresnelHint')}
        />
        {fresnelStrength > 0 && (
          <ExpandableColorPicker
            color={store.fresnelColor || '#000000'}
            onChange={store.setFresnelColor}
            label={t('studio3d.properties.fresnelColor')}
          />
        )}

        <PbrMapUpload
          label={t('studio3d.properties.normalMap')}
          value={store.normalMapUrl}
          onChange={store.setNormalMapUrl}
        />
        <PbrMapUpload
          label={t('studio3d.properties.roughnessMap')}
          value={store.roughnessMapUrl}
          onChange={store.setRoughnessMapUrl}
        />
        <PbrMapUpload
          label={t('studio3d.properties.metalnessMap')}
          value={store.metalnessMapUrl}
          onChange={store.setMetalnessMapUrl}
        />

        <ScrubInput
          label={t('studio3d.properties.envReflection')}
          value={envMapIntensity}
          min={0}
          max={5}
          step={0.1}
          onChange={setEnvMapIntensity}
          hint={t('studio3d.properties.envReflectionHint')}
        />

        <span className="text-2xs text-muted-foreground">{t('studio3d.properties.blendMode')}</span>
        <Select
          options={blendModeOptions}
          value={store.blendMode}
          onChange={(v) => store.setBlendMode(v as typeof store.blendMode)}
        />
      </ToolPanelDisclosure>
    </>
  );
});

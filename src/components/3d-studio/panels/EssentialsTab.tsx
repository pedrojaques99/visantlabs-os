/**
 * EssentialsTab — the default, essentialist view of the 3D Studio.
 *
 * Surfaces only the controls most people reach for first (scene presets, material
 * color, object size, background, bloom, shader) so the studio opens simple. Every
 * advanced control still lives in the Model/Object/Scene/Animate/FX tabs. When a
 * brand is applied, its colors flow in as color-picker presets.
 */
import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Sparkles, Box, Image as ImageIcon, Wand2 } from 'lucide-react';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import {
  ToolPanelDisclosure,
  ToolPanelRow,
  ExpandableColorPicker,
} from '@/components/shared/ToolPanel';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Switch } from '@/components/ui/switch';
import { Select, type SelectOption } from '@/components/ui/select';
import { SHADER_DEFINITIONS } from '@/utils/shaders/shaderParams';
import type { StoreState } from './_shared';
import { ScenePresetsStrip } from '../ScenePresetsStrip';

const essentialsSelector = (s: StoreState) => ({
  color: s.color,
  setColor: s.setColor,
  objectScale: s.objectScale,
  setObjectScale: s.setObjectScale,
  depth: s.depth,
  setDepth: s.setDepth,
  bgType: s.bgType,
  setBgType: s.setBgType,
  background: s.background,
  setBackground: s.setBackground,
  bloomEnabled: s.bloomEnabled,
  setBloomEnabled: s.setBloomEnabled,
  bloomIntensity: s.bloomIntensity,
  setBloomIntensity: s.setBloomIntensity,
  shaderEnabled: s.shaderEnabled,
  setShaderEnabled: s.setShaderEnabled,
  shaderType: s.shaderType,
  setShaderType: s.setShaderType,
  _brandGuidelineId: s._brandGuidelineId,
});

const BG_TYPE_OPTIONS: SelectOption[] = [
  { value: 'solid', label: 'Solid color' },
  { value: 'linear', label: 'Linear gradient' },
  { value: 'radial', label: 'Radial gradient' },
  { value: 'image', label: 'Image' },
];

const SHADER_OPTIONS: SelectOption[] = SHADER_DEFINITIONS.map((d) => ({
  value: d.id,
  label: d.label,
}));

export const EssentialsTab: React.FC = React.memo(() => {
  const store = useStudio3DStore(useShallow(essentialsSelector));

  const [scale, setScale] = useDebouncedSlider(store.objectScale, store.setObjectScale);
  const [depth, setDepth] = useDebouncedSlider(store.depth, store.setDepth);
  const [bloom, setBloom] = useDebouncedSlider(store.bloomIntensity, store.setBloomIntensity);

  // Brand colors (when a brand is applied) become one-tap swatches on the pickers.
  const { data: brandGuidelines = [] } = useBrandGuidelines(true);
  const brandSwatches = useMemo(() => {
    const g = brandGuidelines.find((b) => b.id === store._brandGuidelineId);
    return (g?.colors ?? []).map((c) => c.hex).filter(Boolean).slice(0, 8);
  }, [brandGuidelines, store._brandGuidelineId]);

  return (
    <>
      {/* Quick-start presets (+ on-brand scenes when a brand is applied) */}
      <ScenePresetsStrip />

      {/* Object — color + size */}
      <ToolPanelDisclosure label="Object" icon={<Box size={13} />} defaultOpen>
        <ExpandableColorPicker
          label="Material color"
          color={store.color}
          onChange={store.setColor}
          presets={brandSwatches.length ? brandSwatches : undefined}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ScrubInput
            label="Size"
            value={scale}
            min={0.2}
            max={3}
            step={0.05}
            onChange={setScale}
          />
          <ScrubInput label="Depth" value={depth} min={0.1} max={10} step={0.1} onChange={setDepth} />
        </div>
      </ToolPanelDisclosure>

      {/* Background — type select + color */}
      <ToolPanelDisclosure label="Background" icon={<ImageIcon size={13} />} defaultOpen>
        <Select
          options={BG_TYPE_OPTIONS}
          value={store.bgType}
          onChange={(v) => store.setBgType(v as StoreState['bgType'])}
        />
        <div className="mt-2">
          <ExpandableColorPicker
            label="Background color"
            color={store.background}
            onChange={store.setBackground}
            presets={brandSwatches.length ? brandSwatches : undefined}
          />
        </div>
      </ToolPanelDisclosure>

      {/* Effects — the two the user reaches for first: bloom + shader */}
      <ToolPanelDisclosure label="Effects" icon={<Sparkles size={13} />} defaultOpen>
        <ToolPanelRow label="Bloom">
          <Switch
            checked={store.bloomEnabled}
            onCheckedChange={store.setBloomEnabled}
            aria-label="Toggle bloom"
          />
        </ToolPanelRow>
        {store.bloomEnabled && (
          <div className="mt-2">
            <ScrubInput
              label="Intensity"
              value={bloom}
              min={0}
              max={5}
              step={0.1}
              onChange={setBloom}
            />
          </div>
        )}
      </ToolPanelDisclosure>

      {/* Shader */}
      <ToolPanelDisclosure label="Shader" icon={<Wand2 size={13} />} defaultOpen>
        <ToolPanelRow label="Shader FX">
          <Switch
            checked={store.shaderEnabled}
            onCheckedChange={store.setShaderEnabled}
            aria-label="Toggle shader"
          />
        </ToolPanelRow>
        {store.shaderEnabled && (
          <div className="mt-2">
            <Select
              options={SHADER_OPTIONS}
              value={store.shaderType}
              onChange={(v) => store.setShaderType(v as StoreState['shaderType'])}
            />
            <p className="mt-1.5 text-[9px] text-neutral-500">
              Fine-tune shader parameters in the FX tab.
            </p>
          </div>
        )}
      </ToolPanelDisclosure>
    </>
  );
});

EssentialsTab.displayName = 'EssentialsTab';

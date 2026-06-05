import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  useTextureFilterStore,
  BLEND_MODES,
  TEXTURE_PRESETS,
  FILTER_PRESETS,
  TEXTURE_FILTER_DEFAULTS,
  type TextureFilterSettings,
} from '@/stores/textureFilterStore';
import { UploadIcon, Layers, Blend, Move, RotateCw, Grid, Palette } from 'lucide-react';
import { SectionNavSidebar, type SectionNavItem } from '@/components/shared/SectionNavSidebar';

const SECTION_NAV: SectionNavItem[] = [
  { id: 'sec-texture', icon: <Layers size={14} />, label: 'Texture' },
  { id: 'sec-mode', icon: <Blend size={14} />, label: 'Mode' },
  { id: 'sec-appearance', icon: <RotateCw size={14} />, label: 'Appearance' },
  { id: 'sec-position', icon: <Move size={14} />, label: 'Position' },
  { id: 'sec-tile', icon: <Grid size={14} />, label: 'Tile' },
  { id: 'sec-color', icon: <Palette size={14} />, label: 'Color' },
];

import { SendToButton } from '@/components/shared/SendToButton';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel,
  ToolPanelContent,
  ToolPanelDisclosure,
  ToolPanelGrid,
  ToolPanelRow,
  ToolPanelSection,
  InlineColorPicker,
  ToolPanelExportActions,
} from '@/components/shared/ToolPanel';

const FILTER_PRESET_ITEMS = Object.keys(FILTER_PRESETS).map((name) => ({ name }));

interface TextureFilterControlsProps {
  onExport: () => void;
  onCopyAsPng?: () => void;
}

export const TextureFilterControls: React.FC<TextureFilterControlsProps> = React.memo(
  ({ onExport, onCopyAsPng }) => {
    const store = useTextureFilterStore();

    const update = useCallback(
      <K extends string>(key: K, value: any) => {
        store.updateSetting(key as any, value);
      },
      [store]
    );

    return (
      <ToolPanel className="flex-row">
        <SectionNavSidebar items={SECTION_NAV} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <PresetThumbnailStrip
            imageUrl={store.imageUrl}
            presets={FILTER_PRESET_ITEMS}
            onSelect={(name) => {
              const preset = FILTER_PRESETS[name];
              Object.entries(preset).forEach(([k, v]) => {
                store.updateSetting(k as keyof TextureFilterSettings, v as any);
              });
              toast.success(`Applied "${name}"`);
            }}
          />

          <ToolPanelContent>
            {/* Texture */}
            <ToolPanelSection title="Texture" id="sec-texture">
              <Select
                options={TEXTURE_PRESETS.map((p) => ({ value: p.name, label: p.name }))}
                value={store.textureName}
                onChange={(name) => {
                  const p = TEXTURE_PRESETS.find((t) => t.name === name);
                  if (p) store.applyPreset(p);
                }}
                variant="node"
              />
              <label className="flex items-center gap-2 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
                <UploadIcon size={12} />
                <span className="text-[10px] uppercase tracking-widest">Custom texture</span>
                <input
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  aria-label="Upload custom texture"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      store.setTexture(URL.createObjectURL(file), file.name);
                      toast.success(`Texture: ${file.name}`);
                    }
                    if (e.target) e.target.value = '';
                  }}
                />
              </label>
            </ToolPanelSection>

            {/* Mode */}
            <ToolPanelSection
              title="Mode"
              id="sec-mode"
              onReset={() => {
                update('blendMode', TEXTURE_FILTER_DEFAULTS.blendMode);
                update('maskMode', false);
                update('maskInvert', false);
              }}
            >
              <ToolPanelRow label="Mode">
                <Select
                  options={[
                    { value: 'blend', label: 'Blend' },
                    { value: 'mask', label: 'Mask' },
                  ]}
                  value={store.maskMode ? 'mask' : 'blend'}
                  onChange={(v) => update('maskMode', v === 'mask')}
                  variant="node"
                />
              </ToolPanelRow>

              {!store.maskMode ? (
                <ToolPanelRow label="Blend">
                  <Select
                    options={BLEND_MODES.map((m) => ({ value: m.id, label: m.label }))}
                    value={store.blendMode}
                    onChange={(v) => update('blendMode', v)}
                    variant="node"
                  />
                </ToolPanelRow>
              ) : (
                <ToolPanelRow label="Invert">
                  <Switch
                    checked={store.maskInvert}
                    onCheckedChange={(v) => update('maskInvert', v)}
                  />
                </ToolPanelRow>
              )}
            </ToolPanelSection>

            {/* Appearance */}
            <ToolPanelSection
              title="Appearance"
              id="sec-appearance"
              onReset={() => {
                update('opacity', TEXTURE_FILTER_DEFAULTS.opacity);
                update('scale', TEXTURE_FILTER_DEFAULTS.scale);
              }}
            >
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="Opacity"
                  value={store.opacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => update('opacity', v)}
                />
                <ScrubInput
                  label="Scale"
                  value={store.scale}
                  min={0.1}
                  max={5}
                  step={0.01}
                  onChange={(v) => update('scale', v)}
                />
              </div>
            </ToolPanelSection>

            {/* Position */}
            <ToolPanelSection
              title="Position"
              id="sec-position"
              onReset={() => {
                update('rotation', 0);
                update('offsetX', 0);
                update('offsetY', 0);
              }}
            >
              <ScrubInput
                label="Rotation"
                value={store.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(v) => update('rotation', v)}
              />
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="X"
                  value={store.offsetX}
                  min={-2000}
                  max={2000}
                  step={1}
                  suffix="px"
                  onChange={(v) => update('offsetX', v)}
                />
                <ScrubInput
                  label="Y"
                  value={store.offsetY}
                  min={-2000}
                  max={2000}
                  step={1}
                  suffix="px"
                  onChange={(v) => update('offsetY', v)}
                />
              </div>
            </ToolPanelSection>

            {/* Tile */}
            <ToolPanelSection
              title="Tile"
              id="sec-tile"
              onReset={() => {
                update('tileGapX', 0);
                update('tileGapY', 0);
              }}
            >
              <ToolPanelRow label="Repeat">
                <Switch checked={store.tileMode} onCheckedChange={(v) => update('tileMode', v)} />
              </ToolPanelRow>
              {store.tileMode && (
                <ToolPanelGrid>
                  <ScrubInput
                    label="Gap X"
                    value={store.tileGapX}
                    min={-100}
                    max={200}
                    step={1}
                    suffix="px"
                    onChange={(v) => update('tileGapX', v)}
                  />
                  <ScrubInput
                    label="Gap Y"
                    value={store.tileGapY}
                    min={-100}
                    max={200}
                    step={1}
                    suffix="px"
                    onChange={(v) => update('tileGapY', v)}
                  />
                </ToolPanelGrid>
              )}
            </ToolPanelSection>

            {/* Color */}
            <ToolPanelDisclosure label="Color" id="sec-color">
              <ToolPanelRow label="Original color">
                <Switch
                  checked={store.useOriginalColor}
                  onCheckedChange={(v) => update('useOriginalColor', v)}
                />
              </ToolPanelRow>
              {!store.useOriginalColor && (
                <ToolPanelRow label="Color">
                  <InlineColorPicker
                    value={store.textureColor}
                    onChange={(v) => update('textureColor', v)}
                  />
                </ToolPanelRow>
              )}
            </ToolPanelDisclosure>
          </ToolPanelContent>

          <ToolPanelExportActions
            onExport={onExport}
            isExporting={store.isExporting}
            disabled={!store.imageUrl}
            sendTo={
              store.imageUrl ? (
                <SendToButton
                  source="texture-filter"
                  outputMime="image/png"
                  imageUrl={store.imageUrl}
                />
              ) : undefined
            }
            onCopyAsPng={onCopyAsPng}
          />
        </div>
      </ToolPanel>
    );
  }
);

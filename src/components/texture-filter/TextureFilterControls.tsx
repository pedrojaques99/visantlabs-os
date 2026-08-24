import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { useTranslation } from '@/hooks/useTranslation';
import { VectorPad } from '@/components/controls';
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
import { UploadIcon, Layers, Blend, Move, RotateCw, Grid, Palette } from '@/lib/ui/icons';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import { SendToButton } from '@/components/shared/SendToButton';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel,
  ToolPanelGrid,
  ToolPanelRow,
  InlineColorPicker,
  ToolPanelExportActions,
} from '@/components/shared/ToolPanel';

const FILTER_PRESET_ITEMS = Object.keys(FILTER_PRESETS).map((name) => ({ name }));

const ResetBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="text-2xs text-neutral-700 hover:text-neutral-400 transition-colors uppercase tracking-wider"
  >
    Reset
  </button>
);

interface TextureFilterControlsProps {
  onExport: () => void;
  onCopyAsPng?: () => void;
}

export const TextureFilterControls: React.FC<TextureFilterControlsProps> = React.memo(
  ({ onExport, onCopyAsPng }) => {
    const { t } = useTranslation();
    const store = useTextureFilterStore();

    const update = useCallback(
      <K extends string>(key: K, value: any) => {
        store.updateSetting(key as any, value);
      },
      [store]
    );

    const tabs: PanelTab[] = [
      {
        id: 'texture',
        label: 'Texture',
        icon: <Layers size={16} />,
        content: (
          <div className="space-y-3">
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
              <span className="text-2xs uppercase tracking-widest">Custom texture</span>
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
          </div>
        ),
      },
      {
        id: 'mode',
        label: 'Mode',
        icon: <Blend size={16} />,
        action: (
          <ResetBtn
            onClick={() => {
              update('blendMode', TEXTURE_FILTER_DEFAULTS.blendMode);
              update('maskMode', false);
              update('maskInvert', false);
            }}
          />
        ),
        content: (
          <div className="space-y-3">
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
          </div>
        ),
      },
      {
        id: 'appearance',
        label: 'Appearance',
        icon: <RotateCw size={16} />,
        action: (
          <ResetBtn
            onClick={() => {
              update('opacity', TEXTURE_FILTER_DEFAULTS.opacity);
              update('scale', TEXTURE_FILTER_DEFAULTS.scale);
            }}
          />
        ),
        content: (
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
        ),
      },
      {
        id: 'position',
        label: 'Position',
        icon: <Move size={16} />,
        action: (
          <ResetBtn
            onClick={() => {
              update('rotation', 0);
              update('offsetX', 0);
              update('offsetY', 0);
            }}
          />
        ),
        content: (
          <div className="space-y-3">
            <div className="flex justify-center pb-1">
              <VectorPad
                value={{ x: store.offsetX, y: store.offsetY }}
                onChange={(v) => {
                  update('offsetX', Math.round(v.x));
                  update('offsetY', Math.round(v.y));
                }}
                minX={-2000}
                maxX={2000}
                minY={-2000}
                maxY={2000}
                invertY={false}
                size={120}
                label={t('common.dragToPosition')}
              />
            </div>
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
          </div>
        ),
      },
      {
        id: 'tile',
        label: 'Tile',
        icon: <Grid size={16} />,
        action: (
          <ResetBtn
            onClick={() => {
              update('tileGapX', 0);
              update('tileGapY', 0);
            }}
          />
        ),
        content: (
          <div className="space-y-3">
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
          </div>
        ),
      },
      {
        id: 'color',
        label: 'Color',
        icon: <Palette size={16} />,
        content: (
          <div className="space-y-3">
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
          </div>
        ),
      },
    ];

    return (
      <ToolPanel>
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

        <PanelSectionTabs tabs={tabs} />

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
      </ToolPanel>
    );
  }
);

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
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel,
  ToolPanelGrid,
  ToolPanelRow,
  InlineColorPicker,
  ToolPanelExportActions,
} from '@/components/shared/ToolPanel';

const FILTER_PRESET_ITEMS = Object.keys(FILTER_PRESETS).map((name) => ({ name }));

const ResetBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="text-2xs text-muted-foreground hover:text-muted-foreground transition-colors uppercase tracking-wider"
    >
      {t('common.reset')}
    </button>
  );
};

interface TextureFilterControlsProps {
  onExport: () => void;
  onCopyAsPng?: () => void;
}

export const TextureFilterControls: React.FC<TextureFilterControlsProps> = React.memo(
  ({ onExport, onCopyAsPng }) => {
    const { t, tOr } = useTranslation();
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
        label: t('imagelab.texture.title'),
        icon: <Layers size={16} />,
        content: (
          <div className="space-y-3">
            <Select
              options={TEXTURE_PRESETS.map((p) => ({
                value: p.name,
                label: tOr(`imagelab.texture.presets.${p.name}`, p.name),
              }))}
              value={store.textureName}
              onChange={(name) => {
                const p = TEXTURE_PRESETS.find((preset) => preset.name === name);
                if (p) store.applyPreset(p);
              }}
              variant="node"
            />
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-muted-foreground transition-colors">
              <UploadIcon size={12} />
              <span className="text-2xs uppercase tracking-widest">
                {t('imagelab.texture.custom')}
              </span>
              <input
                type="file"
                accept="image/*,.svg"
                className="hidden"
                aria-label={t('imagelab.texture.uploadCustom')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    store.setTexture(URL.createObjectURL(file), file.name);
                    toast.success(t('imagelab.texture.loaded', { name: file.name }));
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
        label: t('imagelab.controls.mode'),
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
            <ToolPanelRow label={t('imagelab.controls.mode')}>
              <Select
                options={[
                  { value: 'blend', label: t('imagelab.controls.blend') },
                  { value: 'mask', label: t('imagelab.texture.mask') },
                ]}
                value={store.maskMode ? 'mask' : 'blend'}
                onChange={(v) => update('maskMode', v === 'mask')}
                variant="node"
              />
            </ToolPanelRow>
            {!store.maskMode ? (
              <ToolPanelRow label={t('imagelab.controls.blend')}>
                <Select
                  options={BLEND_MODES.map((m) => ({
                    value: m.id,
                    label: tOr(`imagelab.texture.blendModes.${m.id}`, m.label),
                  }))}
                  value={store.blendMode}
                  onChange={(v) => update('blendMode', v)}
                  variant="node"
                />
              </ToolPanelRow>
            ) : (
              <ToolPanelRow label={t('imagelab.texture.invert')}>
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
        label: t('imagelab.texture.appearance'),
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
              label={t('imagelab.controls.opacity')}
              value={store.opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => update('opacity', v)}
            />
            <ScrubInput
              label={t('imagelab.texture.scale')}
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
        label: t('imagelab.texture.position'),
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
              label={t('imagelab.texture.rotation')}
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
        label: t('imagelab.texture.tile'),
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
            <ToolPanelRow label={t('imagelab.texture.repeat')}>
              <Switch checked={store.tileMode} onCheckedChange={(v) => update('tileMode', v)} />
            </ToolPanelRow>
            {store.tileMode && (
              <ToolPanelGrid>
                <ScrubInput
                  label={t('imagelab.texture.gapX')}
                  value={store.tileGapX}
                  min={-100}
                  max={200}
                  step={1}
                  suffix="px"
                  onChange={(v) => update('tileGapX', v)}
                />
                <ScrubInput
                  label={t('imagelab.texture.gapY')}
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
        label: t('imagelab.texture.color'),
        icon: <Palette size={16} />,
        content: (
          <div className="space-y-3">
            <ToolPanelRow label={t('imagelab.texture.originalColor')}>
              <Switch
                checked={store.useOriginalColor}
                onCheckedChange={(v) => update('useOriginalColor', v)}
              />
            </ToolPanelRow>
            {!store.useOriginalColor && (
              <ToolPanelRow label={t('imagelab.texture.color')}>
                <InlineColorPicker
                  value={store.textureColor}
                  onChange={(v) => update('textureColor', v)}
                  label={t('imagelab.texture.color')}
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
            toast.success(t('toolEditor.presets.applied', { name }));
          }}
        />

        <PanelSectionTabs tabs={tabs} />

        <ToolPanelExportActions
          onExport={onExport}
          isExporting={store.isExporting}
          disabled={!store.imageUrl}
          onCopyAsPng={onCopyAsPng}
        />
      </ToolPanel>
    );
  }
);

import React, { useCallback, useState } from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Select } from '@/components/ui/select';
import { useHalftoneStore, BLEND_MODES, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel,
  ToolPanelRow,
  InlineColorPicker,
  ChannelRow,
  ToolPanelExportActions,
} from '@/components/shared/ToolPanel';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import { ApplyBrandButton } from '@/components/shared/BrandSwatchRow';
import { CircleDot, Layers, Blend, Image, SlidersHorizontal } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';

const HALFTONE_PRESET_ITEMS = Object.keys(HALFTONE_PRESETS).map((name) => ({ name }));

const CHANNELS = [
  {
    key: 'Cyan',
    color: '#00FFFF',
    showKey: 'showCyan',
    inkKey: 'cyanInk',
    alphaKey: 'cyanAlpha',
    angleKey: 'cyanAngle',
  },
  {
    key: 'Magenta',
    color: '#FF00FF',
    showKey: 'showMagenta',
    inkKey: 'magentaInk',
    alphaKey: 'magentaAlpha',
    angleKey: 'magentaAngle',
  },
  {
    key: 'Yellow',
    color: '#FFFF00',
    showKey: 'showYellow',
    inkKey: 'yellowInk',
    alphaKey: 'yellowAlpha',
    angleKey: 'yellowAngle',
  },
  {
    key: 'Black',
    color: '#333333',
    showKey: 'showBlack',
    inkKey: 'blackInk',
    alphaKey: 'blackAlpha',
    angleKey: 'blackAngle',
  },
] as const;

interface HalftoneControlsProps {
  onExport: () => void;
  onCopyAsPng?: () => void;
}

export const HalftoneControls: React.FC<HalftoneControlsProps> = React.memo(
  ({ onExport, onCopyAsPng }) => {
    const { t, tOr } = useTranslation();
    const store = useHalftoneStore();
    const [expandedChannel, setExpandedChannel] = useState<number | null>(null);

    const set = useCallback(
      <K extends string>(key: K, value: any) => {
        store.updateSetting(key as any, value);
      },
      [store]
    );

    const tabs: PanelTab[] = [
      {
        id: 'screen',
        label: t('imagelab.controls.halftone'),
        icon: <CircleDot size={16} />,
        content: (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label={t('imagelab.controls.frequency')}
              value={store.frequency}
              min={20}
              max={500}
              step={1}
              onChange={(v) => set('frequency', v)}
            />
            <ScrubInput
              label={t('imagelab.controls.dot')}
              value={store.dotSize}
              min={0.1}
              max={1}
              step={0.01}
              onChange={(v) => set('dotSize', v)}
            />
            <ScrubInput
              label={t('imagelab.controls.space')}
              value={store.dotSpacing}
              min={0}
              max={0.8}
              step={0.01}
              onChange={(v) => set('dotSpacing', v)}
            />
          </div>
        ),
      },
      {
        id: 'channels',
        label: t('imagelab.controls.channels'),
        icon: <Layers size={16} />,
        action: (
          <ApplyBrandButton
            onApply={(colors) => {
              CHANNELS.forEach((ch, i) => {
                if (colors[i]) set(ch.inkKey, colors[i]);
              });
            }}
          />
        ),
        content: (
          <div className="space-y-1">
            {CHANNELS.map((ch, i) => (
              <ChannelRow
                key={ch.key}
                color={store[ch.inkKey]}
                onColorChange={(v) => set(ch.inkKey, v)}
                label={tOr(`imagelab.controls.channelNames.${ch.key}`, ch.key)}
                visible={store[ch.showKey]}
                onToggleVisible={() => set(ch.showKey, !store[ch.showKey])}
                expanded={expandedChannel === i}
                onToggleExpand={() => setExpandedChannel(expandedChannel === i ? null : i)}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label={t('imagelab.controls.opacity')}
                    value={(store as any)[ch.alphaKey]}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => set(ch.alphaKey, v)}
                  />
                  <ScrubInput
                    label={t('imagelab.controls.angle')}
                    value={(store as any)[ch.angleKey]}
                    min={0}
                    max={360}
                    step={5}
                    suffix="°"
                    onChange={(v) => set(ch.angleKey, v)}
                  />
                </div>
              </ChannelRow>
            ))}
          </div>
        ),
      },
      {
        id: 'paper',
        label: t('imagelab.controls.paperAndBlend'),
        icon: <Blend size={16} />,
        content: (
          <div className="space-y-3">
            <ToolPanelRow label={t('imagelab.controls.paper')}>
              <InlineColorPicker
                value={store.paperColor}
                onChange={(v) => set('paperColor', v)}
                label={t('imagelab.controls.paperColor')}
              />
            </ToolPanelRow>
            <ScrubInput
              label={t('imagelab.controls.paperOpacity')}
              value={store.paperAlpha}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set('paperAlpha', v)}
            />
            <ToolPanelRow label={t('imagelab.controls.blend')}>
              <Select
                options={BLEND_MODES.map((m) => ({
                  value: String(m.id),
                  label: tOr(`imagelab.controls.blendModes.${m.id}`, m.label),
                }))}
                value={String(store.blendMode)}
                onChange={(v) => set('blendMode', Number(v))}
                variant="node"
              />
            </ToolPanelRow>
          </div>
        ),
      },
      {
        id: 'image',
        label: t('imagelab.controls.imageAndTexture'),
        icon: <Image size={16} />,
        content: (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label={t('imagelab.controls.contrast')}
                value={store.contrast}
                min={0.3}
                max={2}
                step={0.01}
                onChange={(v) => set('contrast', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.light')}
                value={store.lightness}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => set('lightness', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.blur')}
                value={store.blur}
                min={0}
                max={30}
                step={0.5}
                suffix="px"
                onChange={(v) => set('blur', v)}
              />
              <ScrubInput
                label={t('imagelab.controls.grain')}
                value={store.paperNoise}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('paperNoise', v)}
              />
            </div>
            <ScrubInput
              label={t('imagelab.controls.inkNoise')}
              value={store.inkNoise}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set('inkNoise', v)}
            />
          </div>
        ),
      },
      {
        id: 'advanced',
        label: t('imagelab.controls.dotAdvanced'),
        icon: <SlidersHorizontal size={16} />,
        content: (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label={t('imagelab.controls.rough')}
              value={store.roughness}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => set('roughness', v)}
            />
            <ScrubInput
              label={t('imagelab.controls.fuzz')}
              value={store.fuzz}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => set('fuzz', v)}
            />
            <ScrubInput
              label={t('imagelab.controls.random')}
              value={store.randomness}
              min={0}
              max={0.4}
              step={0.01}
              onChange={(v) => set('randomness', v)}
            />
            <ScrubInput
              label={t('imagelab.controls.threshold')}
              value={store.threshold}
              min={0}
              max={0.5}
              step={0.01}
              onChange={(v) => set('threshold', v)}
            />
          </div>
        ),
      },
    ];

    return (
      <ToolPanel>
        <PresetThumbnailStrip
          imageUrl={store.imageUrl}
          presets={HALFTONE_PRESET_ITEMS}
          onSelect={(name) => store.applyPreset(name)}
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

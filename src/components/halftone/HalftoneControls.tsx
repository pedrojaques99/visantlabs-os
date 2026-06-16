import React, { useCallback, useState } from 'react';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Select } from '@/components/ui/select';
import { useHalftoneStore, BLEND_MODES, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { SendToButton } from '@/components/shared/SendToButton';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel,
  ToolPanelContent,
  ToolPanelSection,
  ToolPanelDisclosure,
  ToolPanelRow,
  InlineColorPicker,
  ChannelRow,
  ToolPanelExportActions,
} from '@/components/shared/ToolPanel';

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
    const store = useHalftoneStore();
    const [expandedChannel, setExpandedChannel] = useState<number | null>(null);

    const set = useCallback(
      <K extends string>(key: K, value: any) => {
        store.updateSetting(key as any, value);
      },
      [store]
    );

    return (
      <ToolPanel>
        <PresetThumbnailStrip
          imageUrl={store.imageUrl}
          presets={HALFTONE_PRESET_ITEMS}
          onSelect={(name) => store.applyPreset(name)}
        />

        <ToolPanelContent>
          {/* Halftone */}
          <ToolPanelSection title="HALFTONE">
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Freq"
                value={store.frequency}
                min={20}
                max={500}
                step={1}
                onChange={(v) => set('frequency', v)}
              />
              <ScrubInput
                label="Dot"
                value={store.dotSize}
                min={0.1}
                max={1}
                step={0.01}
                onChange={(v) => set('dotSize', v)}
              />
              <ScrubInput
                label="Space"
                value={store.dotSpacing}
                min={0}
                max={0.8}
                step={0.01}
                onChange={(v) => set('dotSpacing', v)}
              />
            </div>
          </ToolPanelSection>

          {/* Channels */}
          <ToolPanelSection title="CHANNELS">
            {CHANNELS.map((ch, i) => (
              <ChannelRow
                key={ch.key}
                color={store[ch.inkKey]}
                onColorChange={(v) => set(ch.inkKey, v)}
                label={ch.key}
                visible={store[ch.showKey]}
                onToggleVisible={() => set(ch.showKey, !store[ch.showKey])}
                expanded={expandedChannel === i}
                onToggleExpand={() => setExpandedChannel(expandedChannel === i ? null : i)}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label="Opacity"
                    value={(store as any)[ch.alphaKey]}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(v) => set(ch.alphaKey, v)}
                  />
                  <ScrubInput
                    label="Angle"
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
          </ToolPanelSection>

          {/* Paper & Blend */}
          <ToolPanelSection title="PAPER & BLEND">
            <ToolPanelRow label="Paper">
              <InlineColorPicker
                value={store.paperColor}
                onChange={(v) => set('paperColor', v)}
                label="Paper color"
              />
            </ToolPanelRow>
            <ScrubInput
              label="Paper Opacity"
              value={store.paperAlpha}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set('paperAlpha', v)}
            />
            <ToolPanelRow label="Blend">
              <Select
                options={BLEND_MODES.map((m) => ({ value: String(m.id), label: m.label }))}
                value={String(store.blendMode)}
                onChange={(v) => set('blendMode', Number(v))}
                variant="node"
              />
            </ToolPanelRow>
          </ToolPanelSection>

          {/* Image & Texture */}
          <ToolPanelSection title="IMAGE & TEXTURE">
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Contrast"
                value={store.contrast}
                min={0.3}
                max={2}
                step={0.01}
                onChange={(v) => set('contrast', v)}
              />
              <ScrubInput
                label="Light"
                value={store.lightness}
                min={-0.5}
                max={0.5}
                step={0.01}
                onChange={(v) => set('lightness', v)}
              />
              <ScrubInput
                label="Blur"
                value={store.blur}
                min={0}
                max={30}
                step={0.5}
                suffix="px"
                onChange={(v) => set('blur', v)}
              />
              <ScrubInput
                label="Grain"
                value={store.paperNoise}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => set('paperNoise', v)}
              />
            </div>
            <ScrubInput
              label="Ink Noise"
              value={store.inkNoise}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => set('inkNoise', v)}
            />
          </ToolPanelSection>

          {/* Dot Advanced */}
          <ToolPanelDisclosure label="Dot Advanced">
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label="Rough"
                value={store.roughness}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => set('roughness', v)}
              />
              <ScrubInput
                label="Fuzz"
                value={store.fuzz}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => set('fuzz', v)}
              />
              <ScrubInput
                label="Random"
                value={store.randomness}
                min={0}
                max={0.4}
                step={0.01}
                onChange={(v) => set('randomness', v)}
              />
              <ScrubInput
                label="Thresh"
                value={store.threshold}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(v) => set('threshold', v)}
              />
            </div>
          </ToolPanelDisclosure>
        </ToolPanelContent>

        <ToolPanelExportActions
          onExport={onExport}
          isExporting={store.isExporting}
          disabled={!store.imageUrl}
          sendTo={
            store.imageUrl ? (
              <SendToButton source="halftone" outputMime="image/png" imageUrl={store.imageUrl} />
            ) : undefined
          }
          onCopyAsPng={onCopyAsPng}
        />
      </ToolPanel>
    );
  }
);

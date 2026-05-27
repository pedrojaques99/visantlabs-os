import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Select } from '@/components/ui/select';
import { useHalftoneStore, BLEND_MODES, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { Eye, EyeOff, Download, ChevronDown } from 'lucide-react';
import { SendToButton } from '@/components/shared/SendToButton';
import { ImageLabHeader } from '@/components/shared/ImageLabHeader';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import {
  ToolPanel, ToolPanelContent, ToolPanelSection,
  ToolPanelDisclosure, ToolPanelActions, ToolPanelRow,
} from '@/components/shared/ToolPanel';

const HALFTONE_PRESET_ITEMS = Object.keys(HALFTONE_PRESETS).map((name) => ({ name }));

const CHANNELS = [
  { key: 'Cyan', color: '#00FFFF', showKey: 'showCyan', inkKey: 'cyanInk', alphaKey: 'cyanAlpha', angleKey: 'cyanAngle' },
  { key: 'Magenta', color: '#FF00FF', showKey: 'showMagenta', inkKey: 'magentaInk', alphaKey: 'magentaAlpha', angleKey: 'magentaAngle' },
  { key: 'Yellow', color: '#FFFF00', showKey: 'showYellow', inkKey: 'yellowInk', alphaKey: 'yellowAlpha', angleKey: 'yellowAngle' },
  { key: 'Black', color: '#333333', showKey: 'showBlack', inkKey: 'blackInk', alphaKey: 'blackAlpha', angleKey: 'blackAngle' },
] as const;

interface HalftoneControlsProps {
  onExport: () => void;
  onClosePanel?: () => void;
}

export const HalftoneControls: React.FC<HalftoneControlsProps> = React.memo(({ onExport, onClosePanel }) => {
  const store = useHalftoneStore();
  const [expandedChannel, setExpandedChannel] = useState<number | null>(null);

  const set = useCallback(<K extends string>(key: K, value: any) => {
    store.updateSetting(key as any, value);
  }, [store]);

  return (
    <ToolPanel>
      <ImageLabHeader
        imageUrl={store.imageUrl}
        fileName={store.fileName}
        onLoad={(url, name) => store.setImageUrl(url, name)}
        onClear={() => store.setImageUrl('', '')}
        onResetSettings={store.resetSettings}
        onClosePanel={onClosePanel}
      />

      <PresetThumbnailStrip
        imageUrl={store.imageUrl}
        presets={HALFTONE_PRESET_ITEMS}
        onSelect={(name) => store.applyPreset(name)}
      />

      <ToolPanelContent>
        {/* Halftone */}
        <ToolPanelSection title="HALFTONE">
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Freq" value={store.frequency} min={20} max={500} step={1} onChange={(v) => set('frequency', v)} />
            <ScrubInput label="Dot" value={store.dotSize} min={0.1} max={1} step={0.01} onChange={(v) => set('dotSize', v)} />
          </div>
        </ToolPanelSection>

        {/* Channels */}
        <ToolPanelSection title="CHANNELS">
          <div className="space-y-1">
            {CHANNELS.map((ch, i) => {
              const isExpanded = expandedChannel === i;
              const visible = (store as any)[ch.showKey] as boolean;
              const inkColor = (store as any)[ch.inkKey] as string;
              return (
                <div key={ch.key} className={cn('rounded-lg border transition-colors', isExpanded ? 'border-neutral-700 bg-neutral-900/50' : 'border-transparent')}>
                  <button
                    onClick={() => setExpandedChannel(isExpanded ? null : i)}
                    className="flex items-center gap-3 w-full py-2 px-2 hover:bg-neutral-800/30 rounded-lg transition-colors"
                  >
                    <input
                      type="color"
                      value={inkColor}
                      aria-label={`${ch.key} ink color`}
                      onChange={(e) => { e.stopPropagation(); set(ch.inkKey, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 shrink-0"
                    />
                    <span className="text-[11px] text-neutral-400 font-mono uppercase flex-1 text-left tracking-wider">{ch.key}</span>
                    <div className="flex items-center gap-1">
                      <span
                        role="button"
                        aria-label={`Toggle ${ch.key} visibility`}
                        onClick={(e) => { e.stopPropagation(); set(ch.showKey, !visible); }}
                        className="text-neutral-500 hover:text-white transition-colors p-1"
                      >
                        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </span>
                      <ChevronDown size={14} className={cn('text-neutral-600 transition-transform', isExpanded && 'rotate-180')} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-1 grid grid-cols-2 gap-1.5">
                      <ScrubInput label="Opacity" value={(store as any)[ch.alphaKey]} min={0} max={1} step={0.01} onChange={(v) => set(ch.alphaKey, v)} />
                      <ScrubInput label="Angle" value={(store as any)[ch.angleKey]} min={0} max={360} step={5} suffix="°" onChange={(v) => set(ch.angleKey, v)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ToolPanelSection>

        {/* Paper */}
        <ToolPanelRow label="Paper">
          <div className="flex items-center gap-2">
            <input type="color" value={store.paperColor} onChange={(e) => set('paperColor', e.target.value)} aria-label="Paper color" className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0" />
            <span className="text-[10px] text-neutral-500 font-mono uppercase">{store.paperColor}</span>
          </div>
        </ToolPanelRow>
        <ScrubInput label="Paper Opacity" value={store.paperAlpha} min={0} max={1} step={0.01} onChange={(v) => set('paperAlpha', v)} />

        {/* Blend Mode */}
        <ToolPanelRow label="Blend">
          <Select
            options={BLEND_MODES.map((m) => ({ value: m.id, label: m.label }))}
            value={store.blendMode}
            onChange={(v) => set('blendMode', v)}
            variant="node"
          />
        </ToolPanelRow>

        {/* Image & Texture */}
        <ToolPanelSection title="IMAGE & TEXTURE">
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Contrast" value={store.contrast} min={0.3} max={2} step={0.01} onChange={(v) => set('contrast', v)} />
            <ScrubInput label="Light" value={store.lightness} min={-0.5} max={0.5} step={0.01} onChange={(v) => set('lightness', v)} />
            <ScrubInput label="Blur" value={store.blur} min={0} max={30} step={0.5} suffix="px" onChange={(v) => set('blur', v)} />
            <ScrubInput label="Grain" value={store.paperNoise} min={0} max={1} step={0.01} onChange={(v) => set('paperNoise', v)} />
          </div>
          <ScrubInput label="Ink Noise" value={store.inkNoise} min={0} max={1} step={0.01} onChange={(v) => set('inkNoise', v)} />
        </ToolPanelSection>

        {/* Dot Advanced */}
        <ToolPanelDisclosure label="Dot Advanced">
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Rough" value={store.roughness} min={0} max={2} step={0.05} onChange={(v) => set('roughness', v)} />
            <ScrubInput label="Fuzz" value={store.fuzz} min={0} max={0.5} step={0.01} onChange={(v) => set('fuzz', v)} />
            <ScrubInput label="Random" value={store.randomness} min={0} max={0.4} step={0.01} onChange={(v) => set('randomness', v)} />
            <ScrubInput label="Thresh" value={store.threshold} min={0} max={0.5} step={0.01} onChange={(v) => set('threshold', v)} />
          </div>
        </ToolPanelDisclosure>
      </ToolPanelContent>

      <ToolPanelActions>
        <div className="flex gap-2 w-full">
          <Button onClick={onExport} disabled={store.isExporting || !store.imageUrl} aria-label="Export" className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2">
            <Download size={14} />
            {store.isExporting ? 'Exporting...' : 'Export'}
          </Button>
          {store.imageUrl && <SendToButton source="halftone" imageUrl={store.imageUrl} />}
        </div>
      </ToolPanelActions>
    </ToolPanel>
  );
});

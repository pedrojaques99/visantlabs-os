import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { useRisoStore } from '@/stores/risoStore';
import { RISO_INK_PRESETS, RISO_FULL_PRESETS } from '@/components/riso/RisoRenderer';
import { hexToRgb } from '@/utils/colorUtils';
import { SendToButton } from '@/components/shared/SendToButton';
import {
  ToolPanel, ToolPanelContent, ToolPanelSection,
  ToolPanelActions, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { ImageLabHeader } from '@/components/shared/ImageLabHeader';
import { PresetThumbnailStrip } from '@/components/shared/PresetThumbnailStrip';
import { Eye, EyeOff, Zap, Loader2, Focus, Download, ChevronDown } from 'lucide-react';

const RISO_PRESET_ITEMS = Object.entries(RISO_FULL_PRESETS).map(([name, p]) => ({ name, colors: p.colors }));

interface RisoControlsProps {
  onExport: () => void;
  onAiEnhance?: () => void;
  isAiProcessing?: boolean;
  onClosePanel?: () => void;
}

export const RisoControls: React.FC<RisoControlsProps> = React.memo(({ onExport, onAiEnhance, isAiProcessing, onClosePanel }) => {
  const store = useRisoStore();
  const [expandedLayer, setExpandedLayer] = useState<number | null>(null);

  const set = useCallback(<K extends string>(key: K, value: any) => {
    store.updateSetting(key as any, value);
  }, [store]);

  const applyFullPreset = useCallback((name: string) => {
    const preset = RISO_FULL_PRESETS[name];
    if (!preset) return;
    const layers = preset.colors.map((hex, i) => ({
      color: hexToRgb(hex), hex, visible: true, alpha: 0.85,
      angle: i * 22.5, offsetX: [1, -1, 1, -1][i], offsetY: [-1, 1, 1, -1][i],
    }));
    store.setLayers(layers);
    store.updateSetting('frequency', preset.frequency);
    store.updateSetting('dotSize', preset.dotSize);
    store.updateSetting('paperColor', preset.paperColor);
    store.updateSetting('paperNoise', preset.paperNoise);
    store.updateSetting('inkNoise', preset.inkNoise);
    store.updateSetting('inkDropout', preset.inkDropout);
    store.updateSetting('misregistration', preset.misregistration);
    store.updateSetting('edgeBleed', preset.edgeBleed);
    toast.success(`Applied "${name}"`);
  }, [store]);

  return (
    <ToolPanel>
      <ImageLabHeader
        imageUrl={store.imageUrl}
        fileName={store.fileName}
        onLoad={(url, name) => store.setImageUrl(url, name)}
        onClear={() => { store.setImageUrl('', ''); store.setLayers([]); }}
        onResetSettings={() => { store.resetSettings(); store.setLayers([]); }}
        onClosePanel={onClosePanel}
      />

      <PresetThumbnailStrip
        imageUrl={store.imageUrl}
        presets={RISO_PRESET_ITEMS}
        onSelect={(name) => applyFullPreset(name)}
      />

      <ToolPanelContent>
        {/* Ink count */}
        <ToolPanelRow label="Ink Layers">
          <div className="flex gap-1">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                aria-label={`Set ink layer count to ${n}`}
                onClick={() => store.updateSetting('colorCount', n)}
                className={cn(
                  'w-8 h-8 rounded-md text-[11px] font-mono transition-all duration-200 border',
                  store.colorCount === n
                    ? 'bg-white/10 text-white border-white/20'
                    : 'bg-neutral-900/50 text-neutral-500 border-neutral-800/50 hover:bg-neutral-800/30'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </ToolPanelRow>

        {/* Channels — each card expands to show ink color params */}
        {store.layers.length > 0 && (
          <ToolPanelSection title="CHANNELS">
            <div className="space-y-1">
              {store.layers.map((layer, i) => {
                const isExpanded = expandedLayer === i;
                return (
                  <div key={i} className={cn('rounded-lg border transition-colors', isExpanded ? 'border-neutral-700 bg-neutral-900/50' : 'border-transparent')}>
                    <button
                      onClick={() => setExpandedLayer(isExpanded ? null : i)}
                      className="flex items-center gap-3 w-full py-2 px-2 hover:bg-neutral-800/30 rounded-lg transition-colors"
                    >
                      <input
                        type="color"
                        value={layer.hex}
                        aria-label={`Layer ${i + 1} color`}
                        onChange={(e) => { e.stopPropagation(); store.updateLayer(i, { hex: e.target.value }); }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 shrink-0"
                      />
                      <span className="text-[11px] text-neutral-500 font-mono uppercase flex-1 text-left">{layer.hex}</span>
                      <div className="flex items-center gap-1">
                        <span
                          role="button"
                          aria-label={`Solo layer ${i + 1}`}
                          onClick={(e) => { e.stopPropagation(); store.setSoloLayer(i); }}
                          className={cn('transition-colors p-1 rounded-md', store.soloLayer === i ? 'text-cyan-400 bg-cyan-400/10' : 'text-neutral-600 hover:text-neutral-300')}
                        >
                          <Focus size={14} />
                        </span>
                        <span
                          role="button"
                          aria-label={`Toggle layer ${i + 1} visibility`}
                          onClick={(e) => { e.stopPropagation(); store.updateLayer(i, { visible: !layer.visible }); }}
                          className="text-neutral-500 hover:text-white transition-colors p-1"
                        >
                          {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </span>
                        <ChevronDown size={14} className={cn('text-neutral-600 transition-transform', isExpanded && 'rotate-180')} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2 pt-1 grid grid-cols-2 gap-1.5">
                        <ScrubInput label="Opacity" value={layer.alpha} min={0} max={1} step={0.01} onChange={(v) => store.updateLayer(i, { alpha: v })} />
                        <ScrubInput label="Angle" value={layer.angle} min={0} max={90} step={2.5} suffix="°" onChange={(v) => store.updateLayer(i, { angle: v })} />
                        <ScrubInput label="X" value={layer.offsetX} min={-5} max={5} step={0.5} suffix="px" onChange={(v) => store.updateLayer(i, { offsetX: v })} />
                        <ScrubInput label="Y" value={layer.offsetY} min={-5} max={5} step={0.5} suffix="px" onChange={(v) => store.updateLayer(i, { offsetY: v })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ToolPanelSection>
        )}

        {/* Halftone */}
        <ToolPanelSection title="HALFTONE">
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Freq" value={store.frequency} min={15} max={200} step={1} onChange={(v) => set('frequency', v)} />
            <ScrubInput label="Dot" value={store.dotSize} min={0.3} max={1} step={0.01} onChange={(v) => set('dotSize', v)} />
          </div>
          <ScrubInput label="Misreg" value={store.misregistration} min={0} max={8} step={0.5} suffix="px" onChange={(v) => set('misregistration', v)} />
        </ToolPanelSection>

        {/* Image & Texture */}
        <ToolPanelSection title="IMAGE & TEXTURE">
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Contrast" value={store.contrast} min={0.3} max={2.5} step={0.01} onChange={(v) => set('contrast', v)} />
            <ScrubInput label="Light" value={store.lightness} min={-0.5} max={0.5} step={0.01} onChange={(v) => set('lightness', v)} />
          </div>
          <ToolPanelRow label="Paper">
            <div className="flex items-center gap-2">
              <input type="color" value={store.paperColor} aria-label="Paper color" onChange={(e) => store.updateSetting('paperColor', e.target.value)} className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase">{store.paperColor}</span>
            </div>
          </ToolPanelRow>
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Grain" value={store.paperNoise} min={0} max={1} step={0.01} onChange={(v) => set('paperNoise', v)} />
            <ScrubInput label="Noise" value={store.inkNoise} min={0} max={1} step={0.01} onChange={(v) => set('inkNoise', v)} />
            <ScrubInput label="Dropout" value={store.inkDropout} min={0} max={0.15} step={0.005} onChange={(v) => set('inkDropout', v)} />
            <ScrubInput label="Bleed" value={store.edgeBleed} min={0} max={4} step={0.5} suffix="px" onChange={(v) => set('edgeBleed', v)} />
          </div>
        </ToolPanelSection>

        {/* Ink Palettes */}
        <ToolPanelSection title="INK PALETTES">
          <ToolPanelGrid>
            {Object.entries(RISO_INK_PRESETS).map(([name, colors]) => (
              <ToolPanelChip key={name} onClick={() => {
                const layers = colors.map((hex, i) => ({
                  color: hexToRgb(hex), hex, visible: true, alpha: 0.85,
                  angle: i * 22.5, offsetX: [1, -1, 1, -1][i], offsetY: [-1, 1, 1, -1][i],
                }));
                store.setLayers(layers);
              }}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 shrink-0">
                    {colors.map((c, i) => <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />)}
                  </div>
                  <span className="truncate">{name}</span>
                </div>
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>

      </ToolPanelContent>

      <ToolPanelActions>
        <div className="flex gap-2 w-full">
          <Button aria-label="Export" onClick={onExport} disabled={store.isExporting || !store.imageUrl} className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2">
            <Download size={14} />
            {store.isExporting ? 'Exporting...' : 'Export'}
          </Button>
          {store.imageUrl && <SendToButton source="riso" imageUrl={store.imageUrl} />}
        </div>
        {onAiEnhance && (
          <Button aria-label="AI Enhance" onClick={onAiEnhance} disabled={isAiProcessing || !store.imageUrl} variant="ghost" className="w-full text-neutral-400 hover:text-white h-9 text-xs gap-2">
            {isAiProcessing ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Zap size={14} /> AI Enhance</>}
          </Button>
        )}
      </ToolPanelActions>
    </ToolPanel>
  );
});


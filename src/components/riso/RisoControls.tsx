import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useRisoStore } from '@/stores/risoStore';
import { RISO_INK_PRESETS, RISO_FULL_PRESETS } from '@/components/riso/RisoRenderer';
import { hexToRgb } from '@/utils/colorUtils';
import { ShaderControls } from '@/components/shared/ShaderControls';
import { SendToButton } from '@/components/shared/SendToButton';
import {
  ToolPanel, ToolPanelHeader, ToolPanelContent, ToolPanelSection,
  ToolPanelDisclosure, ToolPanelActions, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { Eye, EyeOff, X, ImageIcon, Zap, Loader2, Focus, Download } from 'lucide-react';

interface RisoControlsProps {
  onExport: () => void;
  onAiEnhance?: () => void;
  isAiProcessing?: boolean;
}

export const RisoControls: React.FC<RisoControlsProps> = React.memo(({ onExport, onAiEnhance, isAiProcessing }) => {
  const store = useRisoStore();

  const update = useCallback(<K extends string>(key: K, value: any) => {
    store.updateSetting(key as any, value);
  }, [store]);

  const [frequency, setFrequency] = useDebouncedSlider(store.frequency, (v) => update('frequency', v));
  const [dotSize, setDotSize] = useDebouncedSlider(store.dotSize, (v) => update('dotSize', v));
  const [contrast, setContrast] = useDebouncedSlider(store.contrast, (v) => update('contrast', v));
  const [lightness, setLightness] = useDebouncedSlider(store.lightness, (v) => update('lightness', v));
  const [paperNoise, setPaperNoise] = useDebouncedSlider(store.paperNoise, (v) => update('paperNoise', v));
  const [inkNoise, setInkNoise] = useDebouncedSlider(store.inkNoise, (v) => update('inkNoise', v));
  const [inkDropout, setInkDropout] = useDebouncedSlider(store.inkDropout, (v) => update('inkDropout', v));
  const [misregistration, setMisregistration] = useDebouncedSlider(store.misregistration, (v) => update('misregistration', v));
  const [edgeBleed, setEdgeBleed] = useDebouncedSlider(store.edgeBleed, (v) => update('edgeBleed', v));

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
      {/* Image header */}
      <ToolPanelHeader>
        {store.imageUrl ? (
          <div className="flex items-center gap-3">
            <img src={store.imageUrl} alt={store.fileName} className="w-10 h-10 rounded-md object-cover bg-neutral-800 shrink-0" />
            <span className="text-[11px] text-neutral-400 font-mono truncate flex-1">{store.fileName}</span>
            <button aria-label="Clear image" onClick={() => { store.setImageUrl('', ''); store.setLayers([]); }} className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0 p-1">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-3 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
            <ImageIcon size={16} />
            <span className="text-[11px] uppercase tracking-widest">Upload image</span>
            <input type="file" accept="image/*" className="hidden" aria-label="Upload image" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) { store.setImageUrl(URL.createObjectURL(file), file.name); toast.success(`Loaded ${file.name}`); }
              if (e.target) e.target.value = '';
            }} />
          </label>
        )}
      </ToolPanelHeader>

      <ToolPanelContent>
        {/* Presets */}
        <ToolPanelSection title="PRESETS">
          <ToolPanelGrid>
            {Object.entries(RISO_FULL_PRESETS).map(([name, preset]) => (
              <ToolPanelChip key={name} onClick={() => applyFullPreset(name)}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 shrink-0">
                    {preset.colors.map((c, i) => <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />)}
                  </div>
                  <span className="truncate">{name}</span>
                </div>
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>

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

        {/* Halftone */}
        <ToolPanelSection title="HALFTONE">
          <NodeSlider label="Frequency" value={frequency} min={15} max={200} step={1} onChange={setFrequency} />
          <NodeSlider label="Dot Size" value={dotSize} min={0.3} max={1} step={0.01} onChange={setDotSize} />
          <NodeSlider label="Misregistration" value={misregistration} min={0} max={8} step={0.5} onChange={setMisregistration} formatValue={(v) => `${v}px`} />
        </ToolPanelSection>

        {/* Layers */}
        {store.layers.length > 0 && (
          <ToolPanelSection title="LAYERS">
            <div className="space-y-2">
              {store.layers.map((layer, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <input type="color" value={layer.hex} aria-label={`Layer ${i + 1} color`} onChange={(e) => store.updateLayer(i, { hex: e.target.value })} className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 shrink-0" />
                  <span className="text-[11px] text-neutral-500 font-mono uppercase flex-1">{layer.hex}</span>
                  <button aria-label={`Solo layer ${i + 1}`} onClick={() => store.setSoloLayer(i)} className={cn('transition-colors p-1 rounded-md', store.soloLayer === i ? 'text-cyan-400 bg-cyan-400/10' : 'text-neutral-600 hover:text-neutral-300')}>
                    <Focus size={14} />
                  </button>
                  <button aria-label={`Toggle layer ${i + 1} visibility`} onClick={() => store.updateLayer(i, { visible: !layer.visible })} className="text-neutral-500 hover:text-white transition-colors p-1">
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              ))}
            </div>
          </ToolPanelSection>
        )}

        {/* Ink Palettes */}
        <ToolPanelDisclosure label="Ink Palettes">
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
        </ToolPanelDisclosure>

        {/* Image & Texture */}
        <ToolPanelDisclosure label="Image & Texture">
          <NodeSlider label="Contrast" value={contrast} min={0.3} max={2.5} step={0.01} onChange={setContrast} />
          <NodeSlider label="Lightness" value={lightness} min={-0.5} max={0.5} step={0.01} onChange={setLightness} />
          <div className="h-px bg-neutral-800/50 my-1" />
          <ToolPanelRow label="Paper">
            <div className="flex items-center gap-2">
              <input type="color" value={store.paperColor} aria-label="Paper color" onChange={(e) => store.updateSetting('paperColor', e.target.value)} className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0" />
              <span className="text-[10px] text-neutral-500 font-mono uppercase">{store.paperColor}</span>
            </div>
          </ToolPanelRow>
          <NodeSlider label="Paper Grain" value={paperNoise} min={0} max={1} step={0.01} onChange={setPaperNoise} />
          <NodeSlider label="Ink Noise" value={inkNoise} min={0} max={1} step={0.01} onChange={setInkNoise} />
          <NodeSlider label="Ink Dropout" value={inkDropout} min={0} max={0.15} step={0.005} onChange={setInkDropout} />
          <NodeSlider label="Edge Bleed" value={edgeBleed} min={0} max={4} step={0.5} onChange={setEdgeBleed} formatValue={(v) => `${v}px`} />
        </ToolPanelDisclosure>

        {/* Layer Details */}
        {store.layers.length > 0 && (
          <ToolPanelDisclosure label="Layer Details">
            <div className="space-y-5">
              {store.layers.map((layer, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.hex }} />
                    <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Layer {i + 1}</span>
                  </div>
                  <LayerSlider label="Opacity" value={layer.alpha} min={0} max={1} step={0.01} onChange={(v) => store.updateLayer(i, { alpha: v })} />
                  <LayerSlider label="Angle" value={layer.angle} min={0} max={90} step={2.5} onChange={(v) => store.updateLayer(i, { angle: v })} formatValue={(v) => `${v}°`} />
                  <LayerSlider label="Offset X" value={layer.offsetX} min={-5} max={5} step={0.5} onChange={(v) => store.updateLayer(i, { offsetX: v })} formatValue={(v) => `${v}px`} />
                  <LayerSlider label="Offset Y" value={layer.offsetY} min={-5} max={5} step={0.5} onChange={(v) => store.updateLayer(i, { offsetY: v })} formatValue={(v) => `${v}px`} />
                </div>
              ))}
            </div>
          </ToolPanelDisclosure>
        )}

        {/* Post-Processing */}
        <ToolPanelDisclosure label="Post-Processing">
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
          />
        </ToolPanelDisclosure>
      </ToolPanelContent>

      {/* Actions */}
      <ToolPanelActions>
        <div className="flex gap-2 w-full">
          <Button aria-label="Export PNG" onClick={onExport} disabled={store.isExporting || !store.imageUrl} className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2">
            <Download size={14} />
            {store.isExporting ? 'Exporting...' : 'Export PNG'}
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

const LayerSlider: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; formatValue?: (v: number) => string;
}> = ({ label, value, min, max, step, onChange, formatValue }) => {
  const [local, setLocal] = useDebouncedSlider(value, onChange);
  return <NodeSlider label={label} value={local} min={min} max={max} step={step} onChange={setLocal} formatValue={formatValue} />;
};

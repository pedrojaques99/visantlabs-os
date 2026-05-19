import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Button } from '@/components/ui/button';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useRisoStore } from '@/stores/risoStore';
import { RISO_INK_PRESETS } from '@/components/riso/RisoRenderer';
import { ShaderControls } from '@/components/shared/ShaderControls';
import { Sliders, Layers, Droplets, Download, Diamond, Eye, EyeOff, X, ImageIcon, ChevronRight, Sparkles, Loader2 } from 'lucide-react';

const TABS = [
  { id: 'riso' as const, label: 'Riso', icon: Sliders },
  { id: 'layers' as const, label: 'Layers', icon: Layers },
  { id: 'texture' as const, label: 'Texture', icon: Droplets },
  { id: 'shader' as const, label: 'Shader', icon: Diamond },
  { id: 'export' as const, label: 'Export', icon: Download },
] as const;

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

  return (
    <GlassPanel className="h-full overflow-hidden flex flex-col">
      {store.imageUrl && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
          <img
            src={store.imageUrl}
            alt={store.fileName}
            className="w-8 h-8 rounded object-cover bg-neutral-800 shrink-0"
          />
          <span className="text-[10px] text-neutral-400 font-mono truncate flex-1">{store.fileName}</span>
          <button
            onClick={() => { store.setImageUrl('', ''); store.setLayers([]); }}
            className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}
      {!store.imageUrl && (
        <label className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.06] shrink-0 cursor-pointer text-neutral-500 hover:text-neutral-300 transition-colors">
          <ImageIcon size={14} />
          <span className="text-[10px] uppercase tracking-widest">Upload image</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                store.setImageUrl(url, file.name);
                toast.success(`Loaded ${file.name}`);
              }
              if (e.target) e.target.value = '';
            }}
          />
        </label>
      )}
      <div className="flex overflow-x-auto border-b border-white/[0.06] shrink-0 gap-1 px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => store.setActiveTab(tab.id)}
            className={cn(
              'shrink-0 flex flex-col items-center gap-0.5 py-2 px-3 text-[9px] uppercase tracking-wider transition-colors',
              store.activeTab === tab.id
                ? 'text-white border-b border-white/40'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {store.activeTab === 'riso' && (
          <>
            <Section title="INK PRESETS">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(RISO_INK_PRESETS).map(([name, colors]) => (
                  <button
                    key={name}
                    onClick={() => {
                      const layers = colors.map((hex, i) => ({
                        color: hexToRgb(hex),
                        hex,
                        visible: true,
                        alpha: 0.85,
                        angle: i * 22.5,
                        offsetX: [1, -1, 1, -1][i],
                        offsetY: [-1, 1, 1, -1][i],
                      }));
                      store.setLayers(layers);
                    }}
                    className="flex items-center gap-2 px-2.5 py-2 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors text-left"
                  >
                    <div className="flex gap-0.5 shrink-0">
                      {colors.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="COLOR COUNT">
              <div className="grid grid-cols-3 gap-1">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => store.updateSetting('colorCount', n)}
                    className={cn(
                      'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors',
                      store.colorCount === n
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {n} inks
                  </button>
                ))}
              </div>
            </Section>

            <Section title="HALFTONE">
              <NodeSlider label="Frequency" value={frequency} min={15} max={120} step={1} onChange={setFrequency} />
              <NodeSlider label="Dot Size" value={dotSize} min={0.3} max={1} step={0.01} onChange={setDotSize} />
            </Section>

            <Section title="IMAGE">
              <NodeSlider label="Contrast" value={contrast} min={0.3} max={2.5} step={0.01} onChange={setContrast} />
              <NodeSlider label="Lightness" value={lightness} min={-0.5} max={0.5} step={0.01} onChange={setLightness} />
            </Section>

            <Section title="REGISTRATION">
              <NodeSlider label="Misregistration" value={misregistration} min={0} max={8} step={0.5} onChange={setMisregistration} formatValue={(v) => `${v}px`} />
              <NodeSlider label="Edge Bleed" value={edgeBleed} min={0} max={4} step={0.5} onChange={setEdgeBleed} formatValue={(v) => `${v}px`} />
            </Section>
          </>
        )}

        {store.activeTab === 'layers' && (
          <>
            {store.layers.length === 0 && (
              <p className="text-[10px] text-neutral-600 uppercase tracking-widest text-center py-8">
                Upload an image to extract ink layers
              </p>
            )}
            {store.layers.map((layer, i) => (
              <Section key={i} title={`LAYER ${i + 1}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={layer.hex}
                      onChange={(e) => store.updateLayer(i, { hex: e.target.value })}
                      className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="text-[10px] text-neutral-500 font-mono uppercase">{layer.hex}</span>
                  </div>
                  <button
                    onClick={() => store.updateLayer(i, { visible: !layer.visible })}
                    className="text-neutral-500 hover:text-white transition-colors"
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
                <LayerSlider label="Opacity" value={layer.alpha} min={0} max={1} step={0.01} onChange={(v) => store.updateLayer(i, { alpha: v })} />
                <LayerSlider label="Angle" value={layer.angle} min={0} max={90} step={2.5} onChange={(v) => store.updateLayer(i, { angle: v })} formatValue={(v) => `${v}°`} />
                <Disclosure label="Offset">
                  <LayerSlider label="X" value={layer.offsetX} min={-5} max={5} step={0.5} onChange={(v) => store.updateLayer(i, { offsetX: v })} formatValue={(v) => `${v}px`} />
                  <LayerSlider label="Y" value={layer.offsetY} min={-5} max={5} step={0.5} onChange={(v) => store.updateLayer(i, { offsetY: v })} formatValue={(v) => `${v}px`} />
                </Disclosure>
              </Section>
            ))}
          </>
        )}

        {store.activeTab === 'texture' && (
          <>
            <Section title="PAPER">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={store.paperColor}
                  onChange={(e) => store.updateSetting('paperColor', e.target.value)}
                  className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-[10px] text-neutral-500 font-mono uppercase">{store.paperColor}</span>
              </div>
              <NodeSlider label="Paper Grain" value={paperNoise} min={0} max={1} step={0.01} onChange={setPaperNoise} />
            </Section>

            <Section title="INK">
              <NodeSlider label="Ink Noise" value={inkNoise} min={0} max={1} step={0.01} onChange={setInkNoise} />
              <NodeSlider label="Ink Dropout" value={inkDropout} min={0} max={0.15} step={0.005} onChange={setInkDropout} />
            </Section>
          </>
        )}

        {store.activeTab === 'shader' && (
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
          />
        )}

        {store.activeTab === 'export' && (
          <>
            <Section title="DOWNLOAD">
              <Button
                onClick={onExport}
                disabled={store.isExporting || !store.imageUrl}
                className="w-full bg-white hover:bg-neutral-200 text-black font-medium"
              >
                {store.isExporting ? 'Exporting...' : 'Export PNG'}
              </Button>
            </Section>

            {onAiEnhance && (
              <Section title="AI ENHANCE">
                <p className="text-[10px] text-neutral-500 leading-relaxed mb-2">
                  Send current output to AI for enhanced risograph stylization with authentic texture and overprint effects.
                </p>
                <Button
                  onClick={onAiEnhance}
                  disabled={isAiProcessing || !store.imageUrl}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium gap-2"
                >
                  {isAiProcessing ? (
                    <><Loader2 size={14} className="animate-spin" /> Processing...</>
                  ) : (
                    <><Sparkles size={14} /> AI Riso Enhance</>
                  )}
                </Button>
              </Section>
            )}

            <Section title="RESET">
              <Button
                onClick={store.resetSettings}
                variant="ghost"
                className="w-full text-neutral-400 hover:text-white"
              >
                Reset to Defaults
              </Button>
            </Section>
          </>
        )}
      </div>
    </GlassPanel>
  );
});

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <MicroTitle>{title}</MicroTitle>
    {children}
  </div>
);

const Disclosure: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[9px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400 transition-colors py-1"
      >
        <ChevronRight size={10} className={cn('transition-transform', open && 'rotate-90')} />
        {label}
      </button>
      {open && <div className="space-y-3 pt-1">{children}</div>}
    </div>
  );
};

const LayerSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}> = ({ label, value, min, max, step, onChange, formatValue }) => {
  const [local, setLocal] = useDebouncedSlider(value, onChange);
  return <NodeSlider label={label} value={local} min={min} max={max} step={step} onChange={setLocal} formatValue={formatValue} />;
};

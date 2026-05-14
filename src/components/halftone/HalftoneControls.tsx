import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Button } from '@/components/ui/button';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useHalftoneStore, BLEND_MODES, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { Sliders, Palette, Layers, Download, Eye, EyeOff, ImageIcon, X, ChevronRight, Diamond } from 'lucide-react';
import { ShaderControls } from '@/components/shared/ShaderControls';

const TABS = [
  { id: 'halftone' as const, label: 'Halftone', icon: Sliders },
  { id: 'color' as const, label: 'Ink', icon: Palette },
  { id: 'channels' as const, label: 'Channels', icon: Layers },
  { id: 'shader' as const, label: 'Shader', icon: Diamond },
  { id: 'export' as const, label: 'Export', icon: Download },
] as const;

interface HalftoneControlsProps {
  onExport: () => void;
}

export const HalftoneControls: React.FC<HalftoneControlsProps> = React.memo(({ onExport }) => {
  const store = useHalftoneStore();

  const update = useCallback(<K extends string>(key: K, value: any) => {
    store.updateSetting(key as any, value);
  }, [store]);

  const [frequency, setFrequency] = useDebouncedSlider(store.frequency, (v) => update('frequency', v));
  const [dotSize, setDotSize] = useDebouncedSlider(store.dotSize, (v) => update('dotSize', v));
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, (v) => update('roughness', v));
  const [fuzz, setFuzz] = useDebouncedSlider(store.fuzz, (v) => update('fuzz', v));
  const [randomness, setRandomness] = useDebouncedSlider(store.randomness, (v) => update('randomness', v));
  const [threshold, setThreshold] = useDebouncedSlider(store.threshold, (v) => update('threshold', v));
  const [contrast, setContrast] = useDebouncedSlider(store.contrast, (v) => update('contrast', v));
  const [lightness, setLightness] = useDebouncedSlider(store.lightness, (v) => update('lightness', v));
  const [blur, setBlur] = useDebouncedSlider(store.blur, (v) => update('blur', v));
  const [paperNoise, setPaperNoise] = useDebouncedSlider(store.paperNoise, (v) => update('paperNoise', v));
  const [inkNoise, setInkNoise] = useDebouncedSlider(store.inkNoise, (v) => update('inkNoise', v));
  const [cyanAlpha, setCyanAlpha] = useDebouncedSlider(store.cyanAlpha, (v) => update('cyanAlpha', v));
  const [cyanAngle, setCyanAngle] = useDebouncedSlider(store.cyanAngle, (v) => update('cyanAngle', v));
  const [magentaAlpha, setMagentaAlpha] = useDebouncedSlider(store.magentaAlpha, (v) => update('magentaAlpha', v));
  const [magentaAngle, setMagentaAngle] = useDebouncedSlider(store.magentaAngle, (v) => update('magentaAngle', v));
  const [yellowAlpha, setYellowAlpha] = useDebouncedSlider(store.yellowAlpha, (v) => update('yellowAlpha', v));
  const [yellowAngle, setYellowAngle] = useDebouncedSlider(store.yellowAngle, (v) => update('yellowAngle', v));
  const [blackAlpha, setBlackAlpha] = useDebouncedSlider(store.blackAlpha, (v) => update('blackAlpha', v));
  const [blackAngle, setBlackAngle] = useDebouncedSlider(store.blackAngle, (v) => update('blackAngle', v));
  const [paperAlpha, setPaperAlpha] = useDebouncedSlider(store.paperAlpha, (v) => update('paperAlpha', v));

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
            onClick={() => store.setImageUrl('', '')}
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
      <div className="flex border-b border-white/[0.06] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => store.setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[9px] uppercase tracking-wider transition-colors',
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
        {store.activeTab === 'halftone' && (
          <>
            <Section title="PRESETS">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.keys(HALFTONE_PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => store.applyPreset(name)}
                    className="px-2.5 py-2 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors text-left"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="DOT">
              <NodeSlider label="Frequency" value={frequency} min={20} max={500} step={1} onChange={setFrequency} />
              <NodeSlider label="Dot Size" value={dotSize} min={0.1} max={1} step={0.01} onChange={setDotSize} />
              <Disclosure label="Advanced">
                <NodeSlider label="Roughness" value={roughness} min={0} max={2} step={0.05} onChange={setRoughness} />
                <NodeSlider label="Edge Fuzz" value={fuzz} min={0} max={0.5} step={0.01} onChange={setFuzz} />
                <NodeSlider label="Randomness" value={randomness} min={0} max={0.4} step={0.01} onChange={setRandomness} />
                <NodeSlider label="Threshold" value={threshold} min={0} max={0.5} step={0.01} onChange={setThreshold} />
              </Disclosure>
            </Section>

            <Section title="IMAGE">
              <NodeSlider label="Contrast" value={contrast} min={0.3} max={2} step={0.01} onChange={setContrast} />
              <NodeSlider label="Lightness" value={lightness} min={-0.5} max={0.5} step={0.01} onChange={setLightness} />
              <Disclosure label="Advanced">
                <NodeSlider label="Blur" value={blur} min={0} max={30} step={0.5} onChange={setBlur} />
                <NodeSlider label="Paper Noise" value={paperNoise} min={0} max={1} step={0.01} onChange={setPaperNoise} />
                <NodeSlider label="Ink Noise" value={inkNoise} min={0} max={1} step={0.01} onChange={setInkNoise} />
              </Disclosure>
            </Section>

            <Section title="BLEND MODE">
              <div className="grid grid-cols-1 gap-1">
                {BLEND_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => store.updateSetting('blendMode', m.id)}
                    className={cn(
                      'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                      store.blendMode === m.id
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {store.activeTab === 'color' && (
          <>
            <InkSection
              title="CYAN"
              color={store.cyanInk}
              alpha={cyanAlpha}
              angle={cyanAngle}
              onColor={(v) => store.updateSetting('cyanInk', v)}
              onAlpha={setCyanAlpha}
              onAngle={setCyanAngle}
            />
            <InkSection
              title="MAGENTA"
              color={store.magentaInk}
              alpha={magentaAlpha}
              angle={magentaAngle}
              onColor={(v) => store.updateSetting('magentaInk', v)}
              onAlpha={setMagentaAlpha}
              onAngle={setMagentaAngle}
            />
            <InkSection
              title="YELLOW"
              color={store.yellowInk}
              alpha={yellowAlpha}
              angle={yellowAngle}
              onColor={(v) => store.updateSetting('yellowInk', v)}
              onAlpha={setYellowAlpha}
              onAngle={setYellowAngle}
            />
            <InkSection
              title="BLACK"
              color={store.blackInk}
              alpha={blackAlpha}
              angle={blackAngle}
              onColor={(v) => store.updateSetting('blackInk', v)}
              onAlpha={setBlackAlpha}
              onAngle={setBlackAngle}
            />
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
              <NodeSlider label="Opacity" value={paperAlpha} min={0} max={1} step={0.01} onChange={setPaperAlpha} />
            </Section>
          </>
        )}

        {store.activeTab === 'channels' && (
          <>
            <Section title="VISIBILITY">
              <ChannelToggle label="Cyan" color="#00FFFF" visible={store.showCyan} onToggle={(v) => store.updateSetting('showCyan', v)} />
              <ChannelToggle label="Magenta" color="#FF00FF" visible={store.showMagenta} onToggle={(v) => store.updateSetting('showMagenta', v)} />
              <ChannelToggle label="Yellow" color="#FFFF00" visible={store.showYellow} onToggle={(v) => store.updateSetting('showYellow', v)} />
              <ChannelToggle label="Black" color="#333333" visible={store.showBlack} onToggle={(v) => store.updateSetting('showBlack', v)} />
            </Section>

            <Section title="SCREEN ANGLES">
              <NodeSlider label="Cyan" value={cyanAngle} min={0} max={360} step={5} onChange={setCyanAngle} formatValue={(v) => `${v}°`} />
              <NodeSlider label="Magenta" value={magentaAngle} min={0} max={360} step={5} onChange={setMagentaAngle} formatValue={(v) => `${v}°`} />
              <NodeSlider label="Yellow" value={yellowAngle} min={0} max={360} step={5} onChange={setYellowAngle} formatValue={(v) => `${v}°`} />
              <NodeSlider label="Black" value={blackAngle} min={0} max={360} step={5} onChange={setBlackAngle} formatValue={(v) => `${v}°`} />
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

const InkSection: React.FC<{
  title: string;
  color: string;
  alpha: number;
  angle: number;
  onColor: (v: string) => void;
  onAlpha: (v: number) => void;
  onAngle: (v: number) => void;
}> = ({ title, color, alpha, angle, onColor, onAlpha, onAngle }) => (
  <Section title={title}>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => onColor(e.target.value)}
        className="w-8 h-6 rounded cursor-pointer bg-transparent border-0"
      />
      <span className="text-[10px] text-neutral-500 font-mono uppercase">{color}</span>
    </div>
    <NodeSlider label="Opacity" value={alpha} min={0} max={1} step={0.01} onChange={onAlpha} />
    <NodeSlider label="Angle" value={angle} min={0} max={360} step={5} onChange={onAngle} formatValue={(v) => `${v}°`} />
  </Section>
);

const ChannelToggle: React.FC<{
  label: string;
  color: string;
  visible: boolean;
  onToggle: (v: boolean) => void;
}> = ({ label, color, visible, onToggle }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, opacity: visible ? 1 : 0.2 }} />
      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">{label}</span>
    </div>
    <button onClick={() => onToggle(!visible)} className="text-neutral-500 hover:text-white transition-colors">
      {visible ? <Eye size={14} /> : <EyeOff size={14} />}
    </button>
  </div>
);

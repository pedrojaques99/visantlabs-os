import React from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useHalftoneStore, BLEND_MODES, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { Sliders, Palette, Layers, Download, Eye, EyeOff } from 'lucide-react';

const TABS = [
  { id: 'halftone' as const, label: 'Halftone', icon: Sliders },
  { id: 'color' as const, label: 'Ink', icon: Palette },
  { id: 'channels' as const, label: 'Channels', icon: Layers },
  { id: 'export' as const, label: 'Export', icon: Download },
] as const;

interface HalftoneControlsProps {
  onExport: () => void;
}

export const HalftoneControls: React.FC<HalftoneControlsProps> = ({ onExport }) => {
  const store = useHalftoneStore();

  return (
    <GlassPanel className="h-full overflow-hidden flex flex-col">
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

      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {store.activeTab === 'halftone' && (
          <>
            <Section title="PRESETS">
              <div className="grid grid-cols-2 gap-1">
                {Object.keys(HALFTONE_PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => store.applyPreset(name)}
                    className="px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors text-left"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="DOT">
              <NodeSlider label="Frequency" value={store.frequency} min={20} max={500} step={1} onChange={(v) => store.updateSetting('frequency', v)} />
              <NodeSlider label="Dot Size" value={store.dotSize} min={0.1} max={1} step={0.01} onChange={(v) => store.updateSetting('dotSize', v)} />
              <NodeSlider label="Roughness" value={store.roughness} min={0} max={2} step={0.05} onChange={(v) => store.updateSetting('roughness', v)} />
              <NodeSlider label="Edge Fuzz" value={store.fuzz} min={0} max={0.5} step={0.01} onChange={(v) => store.updateSetting('fuzz', v)} />
              <NodeSlider label="Randomness" value={store.randomness} min={0} max={0.4} step={0.01} onChange={(v) => store.updateSetting('randomness', v)} />
              <NodeSlider label="Threshold" value={store.threshold} min={0} max={0.5} step={0.01} onChange={(v) => store.updateSetting('threshold', v)} />
            </Section>

            <Section title="IMAGE">
              <NodeSlider label="Contrast" value={store.contrast} min={0.3} max={2} step={0.01} onChange={(v) => store.updateSetting('contrast', v)} />
              <NodeSlider label="Lightness" value={store.lightness} min={-0.5} max={0.5} step={0.01} onChange={(v) => store.updateSetting('lightness', v)} />
              <NodeSlider label="Blur" value={store.blur} min={0} max={30} step={0.5} onChange={(v) => store.updateSetting('blur', v)} />
            </Section>

            <Section title="NOISE">
              <NodeSlider label="Paper Noise" value={store.paperNoise} min={0} max={1} step={0.01} onChange={(v) => store.updateSetting('paperNoise', v)} />
              <NodeSlider label="Ink Noise" value={store.inkNoise} min={0} max={1} step={0.01} onChange={(v) => store.updateSetting('inkNoise', v)} />
            </Section>

            <Section title="BLEND MODE">
              <div className="grid grid-cols-1 gap-1">
                {BLEND_MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => store.updateSetting('blendMode', m.id)}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
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
              alpha={store.cyanAlpha}
              angle={store.cyanAngle}
              onColor={(v) => store.updateSetting('cyanInk', v)}
              onAlpha={(v) => store.updateSetting('cyanAlpha', v)}
              onAngle={(v) => store.updateSetting('cyanAngle', v)}
            />
            <InkSection
              title="MAGENTA"
              color={store.magentaInk}
              alpha={store.magentaAlpha}
              angle={store.magentaAngle}
              onColor={(v) => store.updateSetting('magentaInk', v)}
              onAlpha={(v) => store.updateSetting('magentaAlpha', v)}
              onAngle={(v) => store.updateSetting('magentaAngle', v)}
            />
            <InkSection
              title="YELLOW"
              color={store.yellowInk}
              alpha={store.yellowAlpha}
              angle={store.yellowAngle}
              onColor={(v) => store.updateSetting('yellowInk', v)}
              onAlpha={(v) => store.updateSetting('yellowAlpha', v)}
              onAngle={(v) => store.updateSetting('yellowAngle', v)}
            />
            <InkSection
              title="BLACK"
              color={store.blackInk}
              alpha={store.blackAlpha}
              angle={store.blackAngle}
              onColor={(v) => store.updateSetting('blackInk', v)}
              onAlpha={(v) => store.updateSetting('blackAlpha', v)}
              onAngle={(v) => store.updateSetting('blackAngle', v)}
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
              <NodeSlider label="Opacity" value={store.paperAlpha} min={0} max={1} step={0.01} onChange={(v) => store.updateSetting('paperAlpha', v)} />
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
              <NodeSlider label="Cyan" value={store.cyanAngle} min={0} max={360} step={5} onChange={(v) => store.updateSetting('cyanAngle', v)} formatValue={(v) => `${v}°`} />
              <NodeSlider label="Magenta" value={store.magentaAngle} min={0} max={360} step={5} onChange={(v) => store.updateSetting('magentaAngle', v)} formatValue={(v) => `${v}°`} />
              <NodeSlider label="Yellow" value={store.yellowAngle} min={0} max={360} step={5} onChange={(v) => store.updateSetting('yellowAngle', v)} formatValue={(v) => `${v}°`} />
              <NodeSlider label="Black" value={store.blackAngle} min={0} max={360} step={5} onChange={(v) => store.updateSetting('blackAngle', v)} formatValue={(v) => `${v}°`} />
            </Section>
          </>
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
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <MicroTitle>{title}</MicroTitle>
    {children}
  </div>
);

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

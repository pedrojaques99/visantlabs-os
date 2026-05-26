import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useHalftoneStore, BLEND_MODES, HALFTONE_PRESETS } from '@/stores/halftoneStore';
import { Eye, EyeOff, ImageIcon, X, Download, Grid3X3, Layers, Droplets, Blend, Circle, Image, Palette, Sparkles } from 'lucide-react';
import { ShaderControls } from '@/components/shared/ShaderControls';
import { SendToButton } from '@/components/shared/SendToButton';
import {
  ToolPanel, ToolPanelHeader, ToolPanelContent, ToolPanelSection,
  ToolPanelDisclosure, ToolPanelActions, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { SectionNavSidebar, type SectionNavItem } from '@/components/shared/SectionNavSidebar';

const SECTION_NAV: SectionNavItem[] = [
  { id: 'sec-presets', icon: <Grid3X3 size={14} />, label: 'Presets' },
  { id: 'sec-halftone', icon: <Circle size={14} />, label: 'Halftone' },
  { id: 'sec-channels', icon: <Layers size={14} />, label: 'Channels' },
  { id: 'sec-blend', icon: <Blend size={14} />, label: 'Blend' },
  { id: 'sec-dot', icon: <Droplets size={14} />, label: 'Dot Advanced' },
  { id: 'sec-image', icon: <Image size={14} />, label: 'Image & Texture' },
  { id: 'sec-ink', icon: <Palette size={14} />, label: 'Ink Colors' },
  { id: 'sec-post', icon: <Sparkles size={14} />, label: 'Post-Processing' },
];

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
    <ToolPanel className="flex-row">
      <SectionNavSidebar items={SECTION_NAV} />
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Image header */}
      <ToolPanelHeader>
        {store.imageUrl ? (
          <div className="flex items-center gap-3">
            <img src={store.imageUrl} alt={store.fileName} className="w-10 h-10 rounded-md object-cover bg-neutral-800 shrink-0" />
            <span className="text-[11px] text-neutral-400 font-mono truncate flex-1">{store.fileName}</span>
            <button onClick={() => store.setImageUrl('', '')} aria-label="Clear image" className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0 p-1">
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
        <ToolPanelSection title="PRESETS" id="sec-presets">
          <ToolPanelGrid>
            {Object.keys(HALFTONE_PRESETS).map((name) => (
              <ToolPanelChip key={name} onClick={() => store.applyPreset(name)}>{name}</ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>

        {/* Halftone */}
        <ToolPanelSection title="HALFTONE" id="sec-halftone">
          <NodeSlider label="Frequency" value={frequency} min={20} max={500} step={1} onChange={setFrequency} />
          <NodeSlider label="Dot Size" value={dotSize} min={0.1} max={1} step={0.01} onChange={setDotSize} />
        </ToolPanelSection>

        {/* Channels */}
        <ToolPanelSection title="CHANNELS" id="sec-channels">
          <div className="space-y-2">
            <ChannelToggle label="Cyan" color="#00FFFF" visible={store.showCyan} onToggle={(v) => store.updateSetting('showCyan', v)} />
            <ChannelToggle label="Magenta" color="#FF00FF" visible={store.showMagenta} onToggle={(v) => store.updateSetting('showMagenta', v)} />
            <ChannelToggle label="Yellow" color="#FFFF00" visible={store.showYellow} onToggle={(v) => store.updateSetting('showYellow', v)} />
            <ChannelToggle label="Black" color="#333333" visible={store.showBlack} onToggle={(v) => store.updateSetting('showBlack', v)} />
          </div>
        </ToolPanelSection>

        {/* Blend Mode */}
        <ToolPanelSection title="BLEND" id="sec-blend">
          <ToolPanelGrid>
            {BLEND_MODES.map((m) => (
              <ToolPanelChip key={m.id} active={store.blendMode === m.id} onClick={() => store.updateSetting('blendMode', m.id)}>
                {m.label}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
        </ToolPanelSection>

        {/* Dot Advanced */}
        <ToolPanelDisclosure label="Dot Advanced" id="sec-dot">
          <NodeSlider label="Roughness" value={roughness} min={0} max={2} step={0.05} onChange={setRoughness} />
          <NodeSlider label="Edge Fuzz" value={fuzz} min={0} max={0.5} step={0.01} onChange={setFuzz} />
          <NodeSlider label="Randomness" value={randomness} min={0} max={0.4} step={0.01} onChange={setRandomness} />
          <NodeSlider label="Threshold" value={threshold} min={0} max={0.5} step={0.01} onChange={setThreshold} />
        </ToolPanelDisclosure>

        {/* Image & Texture */}
        <ToolPanelDisclosure label="Image & Texture" id="sec-image">
          <NodeSlider label="Contrast" value={contrast} min={0.3} max={2} step={0.01} onChange={setContrast} />
          <NodeSlider label="Lightness" value={lightness} min={-0.5} max={0.5} step={0.01} onChange={setLightness} />
          <NodeSlider label="Blur" value={blur} min={0} max={30} step={0.5} onChange={setBlur} />
          <div className="h-px bg-neutral-800/50 my-1" />
          <NodeSlider label="Paper Noise" value={paperNoise} min={0} max={1} step={0.01} onChange={setPaperNoise} />
          <NodeSlider label="Ink Noise" value={inkNoise} min={0} max={1} step={0.01} onChange={setInkNoise} />
        </ToolPanelDisclosure>

        {/* Ink Colors */}
        <ToolPanelDisclosure label="Ink Colors" id="sec-ink">
          <div className="space-y-5">
            <InkSection title="Cyan" color={store.cyanInk} alpha={cyanAlpha} angle={cyanAngle} onColor={(v) => store.updateSetting('cyanInk', v)} onAlpha={setCyanAlpha} onAngle={setCyanAngle} />
            <InkSection title="Magenta" color={store.magentaInk} alpha={magentaAlpha} angle={magentaAngle} onColor={(v) => store.updateSetting('magentaInk', v)} onAlpha={setMagentaAlpha} onAngle={setMagentaAngle} />
            <InkSection title="Yellow" color={store.yellowInk} alpha={yellowAlpha} angle={yellowAngle} onColor={(v) => store.updateSetting('yellowInk', v)} onAlpha={setYellowAlpha} onAngle={setYellowAngle} />
            <InkSection title="Black" color={store.blackInk} alpha={blackAlpha} angle={blackAngle} onColor={(v) => store.updateSetting('blackInk', v)} onAlpha={setBlackAlpha} onAngle={setBlackAngle} />
            <div className="space-y-3">
              <ToolPanelRow label="Paper">
                <div className="flex items-center gap-2">
                  <input type="color" value={store.paperColor} onChange={(e) => store.updateSetting('paperColor', e.target.value)} aria-label="Paper color" className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0" />
                  <span className="text-[10px] text-neutral-500 font-mono uppercase">{store.paperColor}</span>
                </div>
              </ToolPanelRow>
              <NodeSlider label="Opacity" value={paperAlpha} min={0} max={1} step={0.01} onChange={setPaperAlpha} />
            </div>
          </div>
        </ToolPanelDisclosure>

        {/* Post-Processing */}
        <ToolPanelDisclosure label="Post-Processing" id="sec-post">
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
          <Button onClick={onExport} disabled={store.isExporting || !store.imageUrl} aria-label="Export PNG" className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2">
            <Download size={14} />
            {store.isExporting ? 'Exporting...' : 'Export PNG'}
          </Button>
          {store.imageUrl && <SendToButton source="halftone" imageUrl={store.imageUrl} />}
        </div>
      </ToolPanelActions>
      </div>
    </ToolPanel>
  );
});

const InkSection: React.FC<{
  title: string; color: string; alpha: number; angle: number;
  onColor: (v: string) => void; onAlpha: (v: number) => void; onAngle: (v: number) => void;
}> = ({ title, color, alpha, angle, onColor, onAlpha, onAngle }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label={`${title} ink color`} className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 shrink-0" />
      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex-1">{title}</span>
      <span className="text-[10px] text-neutral-500 font-mono uppercase">{color}</span>
    </div>
    <NodeSlider label="Opacity" value={alpha} min={0} max={1} step={0.01} onChange={onAlpha} />
    <NodeSlider label="Angle" value={angle} min={0} max={360} step={5} onChange={onAngle} formatValue={(v) => `${v}°`} />
  </div>
);

const ChannelToggle: React.FC<{
  label: string; color: string; visible: boolean; onToggle: (v: boolean) => void;
}> = ({ label, color, visible, onToggle }) => (
  <div className="flex items-center justify-between py-1">
    <div className="flex items-center gap-3">
      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: color, opacity: visible ? 1 : 0.2 }} />
      <span className="text-[11px] text-neutral-400 uppercase tracking-wider">{label}</span>
    </div>
    <button onClick={() => onToggle(!visible)} aria-label={`Toggle ${label.toLowerCase()} channel`} className="text-neutral-500 hover:text-white transition-colors p-1">
      {visible ? <Eye size={14} /> : <EyeOff size={14} />}
    </button>
  </div>
);

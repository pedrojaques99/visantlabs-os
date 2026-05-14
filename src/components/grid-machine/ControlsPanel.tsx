import React from 'react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Download, FileCode, Trash2 } from 'lucide-react';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';

interface Props {
  onExportPng: () => void;
  onExportSvg: () => void;
}

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }> = ({ label, value, min, max, step, onChange, format }) => {
  const [local, setLocal] = useDebouncedSlider(value, onChange);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] text-neutral-500 shrink-0 w-[70px]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={local} onChange={(e) => setLocal(parseFloat(e.target.value))} className="min-w-0 flex-1 h-1 accent-[#00d4ff] bg-neutral-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00d4ff] [&::-webkit-slider-thumb]:appearance-none" />
      <span className="text-[10px] text-neutral-600 shrink-0 w-[32px] text-right tabular-nums">{format ? format(local) : local}</span>
    </div>
  );
};

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-neutral-400">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-neutral-500">{label}</span>
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-5 h-5 rounded border border-white/10 bg-transparent cursor-pointer" />
  </div>
);

export const GridMachineControls: React.FC<Props> = React.memo(({ onExportPng, onExportSvg }) => {
  const showAnchors = useGridMachineStore((s) => s.showAnchors);
  const showHandles = useGridMachineStore((s) => s.showHandles);
  const showHLines = useGridMachineStore((s) => s.showHLines);
  const showVLines = useGridMachineStore((s) => s.showVLines);
  const showDiagonals = useGridMachineStore((s) => s.showDiagonals);
  const showBaseGrid = useGridMachineStore((s) => s.showBaseGrid);
  const showOutline = useGridMachineStore((s) => s.showOutline);
  const lineOpacity = useGridMachineStore((s) => s.lineOpacity);
  const pointSize = useGridMachineStore((s) => s.pointSize);
  const logoOpacity = useGridMachineStore((s) => s.logoOpacity);
  const lineColor = useGridMachineStore((s) => s.lineColor);
  const anchorColor = useGridMachineStore((s) => s.anchorColor);
  const handleColor = useGridMachineStore((s) => s.handleColor);
  const bgMode = useGridMachineStore((s) => s.bgMode);
  const baseGridSpacing = useGridMachineStore((s) => s.baseGridSpacing);
  const hLineSpacing = useGridMachineStore((s) => s.hLineSpacing);
  const vLineSpacing = useGridMachineStore((s) => s.vLineSpacing);
  const diagonalSpacing = useGridMachineStore((s) => s.diagonalSpacing);
  const hiddenLines = useGridMachineStore((s) => s.hiddenLines);
  const isExporting = useGridMachineStore((s) => s.isExporting);
  const updateSetting = useGridMachineStore((s) => s.updateSetting);
  const clear = useGridMachineStore((s) => s.clear);

  return (
    <GlassPanel className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin">
      <div className="flex flex-col gap-4 p-3">

        <div className="flex flex-col gap-2">
          <MicroTitle>Display</MicroTitle>
          <Toggle label="Outline" checked={showOutline} onChange={(v) => updateSetting('showOutline', v)} />
          <Toggle label="Anchors" checked={showAnchors} onChange={(v) => updateSetting('showAnchors', v)} />
          <Toggle label="Handles" checked={showHandles} onChange={(v) => updateSetting('showHandles', v)} />
          <Toggle label="H-Lines" checked={showHLines} onChange={(v) => updateSetting('showHLines', v)} />
          {showHLines && (
            <Slider label="  Min Spacing" value={hLineSpacing} min={0} max={50} step={1} onChange={(v) => updateSetting('hLineSpacing', v)} format={(v) => v === 0 ? 'All' : `${v}`} />
          )}
          <Toggle label="V-Lines" checked={showVLines} onChange={(v) => updateSetting('showVLines', v)} />
          {showVLines && (
            <Slider label="  Min Spacing" value={vLineSpacing} min={0} max={50} step={1} onChange={(v) => updateSetting('vLineSpacing', v)} format={(v) => v === 0 ? 'All' : `${v}`} />
          )}
          <Toggle label="Diagonals" checked={showDiagonals} onChange={(v) => updateSetting('showDiagonals', v)} />
          {showDiagonals && (
            <Slider label="  Min Spacing" value={diagonalSpacing} min={0} max={50} step={1} onChange={(v) => updateSetting('diagonalSpacing', v)} format={(v) => v === 0 ? 'All' : `${v}`} />
          )}
          <Toggle label="Base Grid" checked={showBaseGrid} onChange={(v) => updateSetting('showBaseGrid', v)} />
          {hiddenLines.size > 0 && (
            <button onClick={() => useGridMachineStore.setState({ hiddenLines: new Set() })} className="text-[10px] text-cyan-400/70 hover:text-cyan-400 mt-1">
              Show {hiddenLines.size} hidden line{hiddenLines.size > 1 ? 's' : ''}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <MicroTitle>Style</MicroTitle>
          <Slider label="Line Opacity" value={lineOpacity} min={0.05} max={1} step={0.05} onChange={(v) => updateSetting('lineOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Point Size" value={pointSize} min={1} max={12} step={0.5} onChange={(v) => updateSetting('pointSize', v)} />
          <Slider label="Logo Opacity" value={logoOpacity} min={0} max={1} step={0.05} onChange={(v) => updateSetting('logoOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
          {showBaseGrid && (
            <Slider label="Grid Spacing" value={baseGridSpacing} min={5} max={100} step={5} onChange={(v) => updateSetting('baseGridSpacing', v)} />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <MicroTitle>Colors</MicroTitle>
          <ColorInput label="Lines" value={lineColor} onChange={(v) => updateSetting('lineColor', v)} />
          <ColorInput label="Anchors" value={anchorColor} onChange={(v) => updateSetting('anchorColor', v)} />
          <ColorInput label="Handles" value={handleColor} onChange={(v) => updateSetting('handleColor', v)} />
        </div>

        <div className="flex flex-col gap-2">
          <MicroTitle>Background</MicroTitle>
          <div className="flex gap-1">
            <button onClick={() => updateSetting('bgMode', 'dark')} className={`flex-1 text-[10px] py-1 rounded ${bgMode === 'dark' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Dark</button>
            <button onClick={() => updateSetting('bgMode', 'light')} className={`flex-1 text-[10px] py-1 rounded ${bgMode === 'light' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Light</button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <MicroTitle>Export</MicroTitle>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-[10px]" onClick={onExportPng} disabled={isExporting}>
            <Download size={12} /> Export PNG (2x)
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-[10px]" onClick={onExportSvg} disabled={isExporting}>
            <FileCode size={12} /> Export SVG
          </Button>
        </div>

        <div className="border-t border-white/5 pt-2">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-[10px] text-red-400/60 hover:text-red-400" onClick={clear}>
            <Trash2 size={12} /> Clear
          </Button>
        </div>
      </div>
    </GlassPanel>
  );
});

GridMachineControls.displayName = 'GridMachineControls';

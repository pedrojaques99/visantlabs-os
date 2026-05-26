import React from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { Download, FileCode, Trash2, Eye, SlidersHorizontal, Palette as PaletteIcon, Square } from 'lucide-react';
import { SectionNavSidebar, type SectionNavItem } from '@/components/shared/SectionNavSidebar';

const SECTION_NAV: SectionNavItem[] = [
  { id: 'sec-display', icon: <Eye size={14} />, label: 'Display' },
  { id: 'sec-style', icon: <SlidersHorizontal size={14} />, label: 'Style' },
  { id: 'sec-bg', icon: <Square size={14} />, label: 'Background' },
  { id: 'sec-colors', icon: <PaletteIcon size={14} />, label: 'Colors' },
];
import { SendToButton } from '@/components/shared/SendToButton';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import {
  ToolPanel, ToolPanelContent, ToolPanelSection,
  ToolPanelDisclosure, ToolPanelActions, ToolPanelRow,
} from '@/components/shared/ToolPanel';

interface Props {
  onExportPng: () => void;
  onExportSvg: () => void;
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
  <ToolPanelRow label={label}>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </ToolPanelRow>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }> = ({ label, value, min, max, step, onChange, format }) => {
  const [local, setLocal] = useDebouncedSlider(value, onChange);
  return <NodeSlider label={label} value={local} min={min} max={max} step={step} onChange={setLocal} formatValue={format} />;
};

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
  const svgContent = useGridMachineStore((s) => s.svgContent);
  const updateSetting = useGridMachineStore((s) => s.updateSetting);
  const clear = useGridMachineStore((s) => s.clear);

  return (
    <ToolPanel className="flex-row">
      <SectionNavSidebar items={SECTION_NAV} />
      <div className="flex-1 flex flex-col overflow-hidden">
      <ToolPanelContent>
        {/* Display */}
        <ToolPanelSection title="Display" id="sec-display">
          <Toggle label="Outline" checked={showOutline} onChange={(v) => updateSetting('showOutline', v)} />
          <Toggle label="Anchors" checked={showAnchors} onChange={(v) => updateSetting('showAnchors', v)} />
          <Toggle label="Handles" checked={showHandles} onChange={(v) => updateSetting('showHandles', v)} />
          <Toggle label="H-Lines" checked={showHLines} onChange={(v) => updateSetting('showHLines', v)} />
          {showHLines && <Slider label="Min Spacing" value={hLineSpacing} min={0} max={50} step={1} onChange={(v) => updateSetting('hLineSpacing', v)} format={(v) => v === 0 ? 'All' : `${v}`} />}
          <Toggle label="V-Lines" checked={showVLines} onChange={(v) => updateSetting('showVLines', v)} />
          {showVLines && <Slider label="Min Spacing" value={vLineSpacing} min={0} max={50} step={1} onChange={(v) => updateSetting('vLineSpacing', v)} format={(v) => v === 0 ? 'All' : `${v}`} />}
          <Toggle label="Diagonals" checked={showDiagonals} onChange={(v) => updateSetting('showDiagonals', v)} />
          {showDiagonals && <Slider label="Min Spacing" value={diagonalSpacing} min={0} max={50} step={1} onChange={(v) => updateSetting('diagonalSpacing', v)} format={(v) => v === 0 ? 'All' : `${v}`} />}
          <Toggle label="Base Grid" checked={showBaseGrid} onChange={(v) => updateSetting('showBaseGrid', v)} />
          {hiddenLines.size > 0 && (
            <button onClick={() => useGridMachineStore.setState({ hiddenLines: new Set() })} className="text-[11px] text-cyan-400/70 hover:text-cyan-400 mt-1">
              Show {hiddenLines.size} hidden line{hiddenLines.size > 1 ? 's' : ''}
            </button>
          )}
        </ToolPanelSection>

        {/* Style */}
        <ToolPanelSection title="Style" id="sec-style">
          <Slider label="Line Opacity" value={lineOpacity} min={0.05} max={1} step={0.05} onChange={(v) => updateSetting('lineOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Point Size" value={pointSize} min={1} max={12} step={0.5} onChange={(v) => updateSetting('pointSize', v)} />
          <Slider label="Logo Opacity" value={logoOpacity} min={0} max={1} step={0.05} onChange={(v) => updateSetting('logoOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
          {showBaseGrid && <Slider label="Grid Spacing" value={baseGridSpacing} min={5} max={100} step={5} onChange={(v) => updateSetting('baseGridSpacing', v)} />}
        </ToolPanelSection>

        {/* Background */}
        <ToolPanelSection title="Background" id="sec-bg">
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((mode) => (
              <button key={mode} onClick={() => updateSetting('bgMode', mode)} className={cn(
                'flex-1 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 border',
                bgMode === mode
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-neutral-900/50 text-neutral-500 border-neutral-800/50 hover:bg-neutral-800/30'
              )}>
                {mode}
              </button>
            ))}
          </div>
        </ToolPanelSection>

        {/* Colors */}
        <ToolPanelDisclosure label="Colors" id="sec-colors">
          <ColorInput label="Lines" value={lineColor} onChange={(v) => updateSetting('lineColor', v)} />
          <ColorInput label="Anchors" value={anchorColor} onChange={(v) => updateSetting('anchorColor', v)} />
          <ColorInput label="Handles" value={handleColor} onChange={(v) => updateSetting('handleColor', v)} />
        </ToolPanelDisclosure>
      </ToolPanelContent>

      {/* Actions */}
      <ToolPanelActions>
        <div className="flex gap-2 w-full">
          <Button onClick={onExportPng} disabled={isExporting} className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-9 text-xs gap-2">
            <Download size={14} /> Export PNG
          </Button>
          {svgContent && <SendToButton source="grid-machine" />}
        </div>
        <Button onClick={onExportSvg} disabled={isExporting} variant="ghost" className="w-full text-neutral-400 hover:text-white h-9 text-xs gap-2">
          <FileCode size={14} /> Export SVG
        </Button>
        <Button variant="ghost" onClick={clear} className="w-full text-neutral-600 hover:text-destructive h-8 text-xs gap-2">
          <Trash2 size={13} /> Clear
        </Button>
      </ToolPanelActions>
      </div>
    </ToolPanel>
  );
});

GridMachineControls.displayName = 'GridMachineControls';

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <ToolPanelRow label={label}>
    <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-6 h-6 rounded-md border border-neutral-800/50 bg-transparent cursor-pointer" />
  </ToolPanelRow>
);

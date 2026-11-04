import React from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import {
  FileCode,
  Trash2,
  Eye,
  SlidersHorizontal,
  Palette as PaletteIcon,
  Square,
} from '@/lib/ui/icons';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import { SendToButton } from '@/components/shared/SendToButton';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import {
  ToolPanel,
  ToolPanelExportActions,
  ToolPanelRow,
  ToolPanelDisclosure,
  InlineColorPicker,
} from '@/components/shared/ToolPanel';
import { useTranslation } from '@/hooks/useTranslation';

const DEFAULTS = useGridMachineStore.getInitialState();

interface Props {
  onExportPng: () => void;
  onExportSvg: () => void;
  /** Lazy capture of the grid as a PNG data URL, for "Send to". */
  getCanvasPng?: () => string | undefined;
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <ToolPanelRow label={label}>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </ToolPanelRow>
);

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  resetValue?: number;
}> = ({ label, value, min, max, step, onChange, format, resetValue }) => {
  const [local, setLocal] = useDebouncedSlider(value, onChange);
  return (
    <NodeSlider
      label={label}
      value={local}
      min={min}
      max={max}
      step={step}
      onChange={setLocal}
      formatValue={format}
      resetValue={resetValue}
    />
  );
};

export const GridMachineControls: React.FC<Props> = React.memo(
  ({ onExportPng, onExportSvg, getCanvasPng }) => {
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

    const { t, tOr } = useTranslation();

    const tabs: PanelTab[] = [
      {
        id: 'display',
        label: t('grid.machine.display'),
        icon: <Eye size={16} />,
        content: (
          <div className="space-y-2">
            <Toggle
              label={t('grid.machine.outline')}
              checked={showOutline}
              onChange={(v) => updateSetting('showOutline', v)}
            />
            <Toggle
              label={t('grid.machine.anchors')}
              checked={showAnchors}
              onChange={(v) => updateSetting('showAnchors', v)}
            />
            <Toggle
              label={t('grid.machine.handles')}
              checked={showHandles}
              onChange={(v) => updateSetting('showHandles', v)}
            />
            <Toggle
              label={t('grid.machine.hLines')}
              checked={showHLines}
              onChange={(v) => updateSetting('showHLines', v)}
            />
            {showHLines && (
              <Slider
                label={t('grid.machine.minSpacing')}
                value={hLineSpacing}
                resetValue={DEFAULTS.hLineSpacing}
                min={0}
                max={50}
                step={1}
                onChange={(v) => updateSetting('hLineSpacing', v)}
                format={(v) => (v === 0 ? t('grid.machine.all') : `${v}`)}
              />
            )}
            <Toggle
              label={t('grid.machine.vLines')}
              checked={showVLines}
              onChange={(v) => updateSetting('showVLines', v)}
            />
            {showVLines && (
              <Slider
                label={t('grid.machine.minSpacing')}
                value={vLineSpacing}
                resetValue={DEFAULTS.vLineSpacing}
                min={0}
                max={50}
                step={1}
                onChange={(v) => updateSetting('vLineSpacing', v)}
                format={(v) => (v === 0 ? t('grid.machine.all') : `${v}`)}
              />
            )}
            <Toggle
              label={t('grid.machine.diagonals')}
              checked={showDiagonals}
              onChange={(v) => updateSetting('showDiagonals', v)}
            />
            {showDiagonals && (
              <Slider
                label={t('grid.machine.minSpacing')}
                value={diagonalSpacing}
                resetValue={DEFAULTS.diagonalSpacing}
                min={0}
                max={50}
                step={1}
                onChange={(v) => updateSetting('diagonalSpacing', v)}
                format={(v) => (v === 0 ? t('grid.machine.all') : `${v}`)}
              />
            )}
            <Toggle
              label={t('grid.machine.baseGrid')}
              checked={showBaseGrid}
              onChange={(v) => updateSetting('showBaseGrid', v)}
            />
            {hiddenLines.size > 0 && (
              <button
                onClick={() => useGridMachineStore.setState({ hiddenLines: new Set() })}
                className="text-2xs text-brand-cyan/70 hover:text-brand-cyan mt-1"
              >
                {t(
                  hiddenLines.size > 1
                    ? 'grid.machine.showHiddenLines'
                    : 'grid.machine.showHiddenLine',
                  {
                    count: hiddenLines.size,
                  }
                )}
              </button>
            )}
          </div>
        ),
      },
      {
        id: 'style',
        label: t('grid.machine.style'),
        icon: <SlidersHorizontal size={16} />,
        content: (
          <div className="space-y-2">
            <Slider
              label={t('grid.machine.lineOpacity')}
              value={lineOpacity}
              resetValue={DEFAULTS.lineOpacity}
              min={0.05}
              max={1}
              step={0.05}
              onChange={(v) => updateSetting('lineOpacity', v)}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Slider
              label={t('grid.machine.logoOpacity')}
              value={logoOpacity}
              resetValue={DEFAULTS.logoOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateSetting('logoOpacity', v)}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <ToolPanelDisclosure label={t('canvasNodes.shared.advancedSettings')}>
              <Slider
                label={t('grid.machine.pointSize')}
                value={pointSize}
                resetValue={DEFAULTS.pointSize}
                min={1}
                max={12}
                step={0.5}
                onChange={(v) => updateSetting('pointSize', v)}
              />
              {showBaseGrid && (
                <Slider
                  label={t('grid.machine.gridSpacing')}
                  value={baseGridSpacing}
                  resetValue={DEFAULTS.baseGridSpacing}
                  min={5}
                  max={100}
                  step={5}
                  onChange={(v) => updateSetting('baseGridSpacing', v)}
                />
              )}
            </ToolPanelDisclosure>
          </div>
        ),
      },
      {
        id: 'bg',
        label: t('grid.machine.background'),
        icon: <Square size={16} />,
        content: (
          <div className="flex gap-1.5">
            {(['dark', 'light'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateSetting('bgMode', mode)}
                className={cn(
                  'flex-1 py-2 rounded-md text-2xs uppercase tracking-wider transition-colors duration-200 border',
                  bgMode === mode
                    ? 'bg-accent text-foreground border-border-hover'
                    : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                )}
              >
                {tOr(`grid.machine.bg.${mode}`, mode)}
              </button>
            ))}
          </div>
        ),
      },
      {
        id: 'colors',
        label: t('grid.machine.colors'),
        icon: <PaletteIcon size={16} />,
        content: (
          <div className="space-y-3">
            <ColorInput
              label={t('grid.machine.lines')}
              value={lineColor}
              onChange={(v) => updateSetting('lineColor', v)}
            />
            <ColorInput
              label={t('grid.machine.anchors')}
              value={anchorColor}
              onChange={(v) => updateSetting('anchorColor', v)}
            />
            <ColorInput
              label={t('grid.machine.handles')}
              value={handleColor}
              onChange={(v) => updateSetting('handleColor', v)}
            />
          </div>
        ),
      },
    ];

    return (
      <ToolPanel>
        <PanelSectionTabs tabs={tabs} />

        {/* Actions */}
        <ToolPanelExportActions
          onExport={onExportPng}
          isExporting={isExporting}
          disabled={!svgContent}
          sendTo={
            svgContent ? (
              <SendToButton
                source="grid-machine"
                outputMime="image/png"
                mimeType="image/png"
                getImageBase64={getCanvasPng}
              />
            ) : undefined
          }
        >
          <Button
            onClick={onExportSvg}
            disabled={isExporting}
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground h-9 text-xs gap-2"
          >
            <FileCode size={14} /> {t('grid.machine.exportSvg')}
          </Button>
          <Button
            variant="ghost"
            onClick={clear}
            className="w-full text-muted-foreground hover:text-destructive h-8 text-xs gap-2"
          >
            <Trash2 size={13} /> {t('grid.machine.clear')}
          </Button>
        </ToolPanelExportActions>
      </ToolPanel>
    );
  }
);

GridMachineControls.displayName = 'GridMachineControls';

const ColorInput: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="space-y-1">
    <span className="text-2xs uppercase tracking-widest text-muted-foreground">{label}</span>
    <InlineColorPicker value={value} onChange={onChange} label={label} />
  </div>
);

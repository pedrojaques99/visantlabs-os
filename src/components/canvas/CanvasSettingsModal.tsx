import React, { useEffect, useCallback } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { LucideIcon } from 'lucide-react';
import {
  X,
  Grid3x3,
  Maximize2,
  ZoomIn,
  Palette,
  MousePointer2,
  Beaker,
  Diamond,
  Link2,
  LayoutGrid,
  Paintbrush,
  Settings2,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ExpandableColorPicker,
  SectionLabel,
  SegmentedControl,
} from '@/components/shared/ToolPanel';
import { cn } from '@/lib/utils';

interface CanvasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
  gridColor?: string;
  onGridColorChange?: (color: string) => void;
  showGrid?: boolean;
  onShowGridChange?: (show: boolean) => void;
  showMinimap?: boolean;
  onShowMinimapChange?: (show: boolean) => void;
  showControls?: boolean;
  onShowControlsChange?: (show: boolean) => void;
  cursorColor?: string;
  onCursorColorChange?: (color: string) => void;
  brandCyan?: string;
  onBrandCyanChange?: (color: string) => void;
  experimentalMode?: boolean;
  onExperimentalModeChange?: (experimental: boolean) => void;
  edgeStyle?: 'solid' | 'dashed';
  onEdgeStyleChange?: (style: 'solid' | 'dashed') => void;
  edgeStrokeWidth?: 'normal' | 'thin';
  onEdgeStrokeWidthChange?: (width: 'normal' | 'thin') => void;
}

// --- Constants ---

const COLOR_DEFAULTS = {
  background: '#0C0C0C',
  grid: '#ffffff',
  cursor: '#FFFFFF',
  accent: '#00d9ff',
} as const;

const BG_PRESETS = ['#0C0C0C', '#0a0a0a', '#111111', '#1a1a1a', '#0d1117', '#1e1e2e'];
const ACCENT_PRESETS = ['#00d9ff', '#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

// --- Helpers ---

function rgbaToHex(rgba: string): string {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#ffffff';
  const [, r, g, b] = match;
  return `#${[r, g, b].map((c) => Number(c).toString(16).padStart(2, '0')).join('')}`;
}

// --- Local sub-components ---

function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 group/row rounded-lg transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.04] shrink-0 transition-colors group-hover/row:bg-white/[0.06]">
          <Icon
            size={15}
            className="text-neutral-500 transition-colors group-hover/row:text-neutral-400"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-neutral-200 leading-tight">{label}</p>
          {description && (
            <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ColorSettingRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.03] border border-white/[0.04] shrink-0">
          <Icon size={14} className="text-neutral-500" />
        </div>
        <span className="text-[13px] text-neutral-200">{label}</span>
      </div>
      {children}
    </div>
  );
}

// --- Main Component ---

export const CanvasSettingsModal: React.FC<CanvasSettingsModalProps> = ({
  isOpen,
  onClose,
  backgroundColor = COLOR_DEFAULTS.background,
  onBackgroundColorChange,
  gridColor = 'rgba(255, 255, 255, 0.1)',
  onGridColorChange,
  showGrid = true,
  onShowGridChange,
  showMinimap = true,
  onShowMinimapChange,
  showControls = true,
  onShowControlsChange,
  cursorColor = COLOR_DEFAULTS.cursor,
  onCursorColorChange,
  brandCyan = COLOR_DEFAULTS.accent,
  onBrandCyanChange,
  experimentalMode = false,
  onExperimentalModeChange,
  edgeStyle = 'solid',
  onEdgeStyleChange,
  edgeStrokeWidth = 'normal',
  onEdgeStrokeWidthChange,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleGridColorChange = useCallback(
    (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      onGridColorChange?.(`rgba(${r}, ${g}, ${b}, 0.2)`);
    },
    [onGridColorChange]
  );

  if (!isOpen) return null;

  const gridHexColor = gridColor.startsWith('rgba')
    ? rgbaToHex(gridColor)
    : gridColor.startsWith('#')
      ? gridColor
      : '#ffffff';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-neutral-950 border border-white/[0.06] rounded-2xl w-full max-w-[460px] max-h-[85vh] flex flex-col shadow-2xl',
          'animate-in fade-in-0 zoom-in-[0.97] duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Settings2 size={16} className="text-neutral-500" />
            <h2 className="text-[13px] font-medium text-neutral-200">
              {t('canvas.settings') || 'Canvas Settings'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.05] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <Separator className="bg-white/[0.04]" />

        {/* Tabs */}
        <Tabs defaultValue="canvas" className="flex-1 flex flex-col min-h-0 gap-0">
          <div className="px-4 pt-2.5 pb-0">
            <TabsList className="w-full bg-white/[0.03] border border-white/[0.05] h-8 p-0.5 rounded-lg">
              <TabsTrigger value="canvas" className="flex-1 gap-1.5 text-[11px] h-full rounded-md">
                <LayoutGrid size={12} />
                {t('canvas.settingsTabCanvas') || 'Canvas'}
              </TabsTrigger>
              <TabsTrigger value="edges" className="flex-1 gap-1.5 text-[11px] h-full rounded-md">
                <Link2 size={12} />
                {t('canvas.settingsTabEdges') || 'Edges'}
              </TabsTrigger>
              <TabsTrigger value="colors" className="flex-1 gap-1.5 text-[11px] h-full rounded-md">
                <Paintbrush size={12} />
                {t('canvas.settingsTabColors') || 'Colors'}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- Canvas Tab --- */}
          <TabsContent value="canvas" className="flex-1 overflow-y-auto px-4 pb-4 pt-1 mt-0">
            <SectionLabel>{t('canvas.settingsDisplay') || 'Display'}</SectionLabel>
            <div className="divide-y divide-white/[0.04]">
              <SettingRow
                icon={Grid3x3}
                label={t('canvas.showGrid') || 'Show Grid'}
                description={t('canvas.showGridDesc') || 'Dot grid on the canvas background'}
              >
                <Switch checked={showGrid} onCheckedChange={(v) => onShowGridChange?.(v)} />
              </SettingRow>
              <SettingRow
                icon={Maximize2}
                label={t('canvas.showMinimap') || 'Minimap'}
                description={t('canvas.showMinimapDesc') || 'Overview of the full canvas'}
              >
                <Switch checked={showMinimap} onCheckedChange={(v) => onShowMinimapChange?.(v)} />
              </SettingRow>
              <SettingRow
                icon={ZoomIn}
                label={t('canvas.showControls') || 'Zoom Controls'}
                description={t('canvas.showControlsDesc') || 'Zoom and fit controls overlay'}
              >
                <Switch checked={showControls} onCheckedChange={(v) => onShowControlsChange?.(v)} />
              </SettingRow>
            </div>
            <div className="mt-2">
              <SectionLabel>{t('canvas.settingsAdvanced') || 'Advanced'}</SectionLabel>
              <SettingRow
                icon={Beaker}
                label={t('canvas.experimentalMode') || 'Experimental Mode'}
                description={
                  t('canvas.experimentalModeDesc') ||
                  'Show preview nodes like Shader, Strategy, etc.'
                }
              >
                <Switch
                  checked={experimentalMode}
                  onCheckedChange={(v) => onExperimentalModeChange?.(v)}
                />
              </SettingRow>
            </div>
          </TabsContent>

          {/* --- Edges Tab --- */}
          <TabsContent value="edges" className="flex-1 overflow-y-auto px-4 pb-4 pt-1 mt-0">
            <SectionLabel>{t('canvas.settingsConnections') || 'Connections'}</SectionLabel>
            <div className="divide-y divide-white/[0.04]">
              <SettingRow
                icon={Link2}
                label={t('canvas.edgeStyle') || 'Line Style'}
                description={t('canvas.edgeStyleDesc') || 'Style for connections between nodes'}
              >
                <SegmentedControl
                  value={edgeStyle}
                  onChange={(v) => onEdgeStyleChange?.(v as 'solid' | 'dashed')}
                  options={[
                    { value: 'solid', label: t('canvas.edgeStyleSolid') || 'Solid' },
                    { value: 'dashed', label: t('canvas.edgeStyleDash') || 'Dash' },
                  ]}
                />
              </SettingRow>
              <SettingRow
                icon={Link2}
                label={t('canvas.edgeWidth') || 'Line Weight'}
                description={t('canvas.edgeWidthDesc') || 'Thickness of connection lines'}
              >
                <SegmentedControl
                  value={edgeStrokeWidth}
                  onChange={(v) => onEdgeStrokeWidthChange?.(v as 'normal' | 'thin')}
                  options={[
                    { value: 'normal', label: t('canvas.edgeWidthBold') || 'Bold' },
                    { value: 'thin', label: t('canvas.edgeWidthThin') || 'Thin' },
                  ]}
                />
              </SettingRow>
            </div>
            {/* Edge preview */}
            <div className="mt-3 p-3.5 bg-white/[0.02] rounded-xl border border-white/[0.04]">
              <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest mb-2.5">
                {t('canvas.preview') || 'Preview'}
              </p>
              <svg viewBox="0 0 300 40" className="w-full" preserveAspectRatio="xMidYMid meet">
                <line
                  x1="24"
                  y1="20"
                  x2="276"
                  y2="20"
                  stroke="currentColor"
                  className="text-neutral-600"
                  strokeWidth={edgeStrokeWidth === 'thin' ? 1 : 2.5}
                  strokeDasharray={edgeStyle === 'dashed' ? '8 5' : 'none'}
                  strokeLinecap="round"
                />
                <circle cx="24" cy="20" r="5" className="fill-brand-cyan" />
                <circle cx="276" cy="20" r="5" className="fill-neutral-600" />
              </svg>
            </div>
          </TabsContent>

          {/* --- Colors Tab --- */}
          <TabsContent value="colors" className="flex-1 overflow-y-auto px-4 pb-4 pt-1 mt-0">
            <SectionLabel>{t('canvas.settingsTheme') || 'Theme'}</SectionLabel>
            <div className="divide-y divide-white/[0.04]">
              <ColorSettingRow icon={Palette} label={t('canvas.backgroundColor') || 'Background'}>
                <ExpandableColorPicker
                  color={backgroundColor}
                  onChange={(c) => onBackgroundColorChange?.(c)}
                  label="Background"
                  presets={BG_PRESETS}
                  onReset={() => onBackgroundColorChange?.(COLOR_DEFAULTS.background)}
                />
              </ColorSettingRow>

              <ColorSettingRow icon={Diamond} label={t('canvas.brandCyanColor') || 'Accent Color'}>
                <ExpandableColorPicker
                  color={brandCyan.startsWith('#') ? brandCyan : '#00d9ff'}
                  onChange={(c) => onBrandCyanChange?.(c)}
                  label="Accent"
                  presets={ACCENT_PRESETS}
                  onReset={() => onBrandCyanChange?.(COLOR_DEFAULTS.accent)}
                />
              </ColorSettingRow>

              <ColorSettingRow icon={Grid3x3} label={t('canvas.gridColor') || 'Grid'}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-neutral-500">
                      {t('canvas.showGrid') || 'Visible'}
                    </span>
                    <Switch checked={showGrid} onCheckedChange={(v) => onShowGridChange?.(v)} />
                  </div>
                  <ExpandableColorPicker
                    color={gridHexColor}
                    onChange={handleGridColorChange}
                    label="Grid"
                    onReset={() => onGridColorChange?.(COLOR_DEFAULTS.grid)}
                  />
                </div>
              </ColorSettingRow>

              <ColorSettingRow icon={MousePointer2} label={t('canvas.cursorColor') || 'Cursor'}>
                <ExpandableColorPicker
                  color={cursorColor.startsWith('#') ? cursorColor : '#ffffff'}
                  onChange={(c) => onCursorColorChange?.(c)}
                  label="Cursor"
                  onReset={() => onCursorColorChange?.(COLOR_DEFAULTS.cursor)}
                />
              </ColorSettingRow>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

import React, { useEffect, useCallback } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { LucideIcon } from '@/lib/ui/icons';
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
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ExpandableColorPicker, SectionLabel } from '@/components/shared/ToolPanel';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
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
    <div className="flex items-center justify-between gap-4 py-2.5 group/row rounded-xl transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-muted border border-border shrink-0 transition-colors group-hover/row:bg-accent">
          <Icon
            size={15}
            className="text-neutral-500 transition-colors group-hover/row:text-neutral-400"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-neutral-200 leading-tight">{label}</p>
          {description && (
            <p className="text-2xs text-neutral-500 leading-snug mt-0.5">{description}</p>
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
        <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-muted border border-border shrink-0">
          <Icon size={14} className="text-neutral-500" />
        </div>
        <span className="text-sm text-neutral-200">{label}</span>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-neutral-950 border border-border rounded-xl w-full max-w-[460px] max-h-[85vh] flex flex-col shadow-2xl',
          'animate-in fade-in-0 zoom-in-[0.97] duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Settings2 size={16} className="text-neutral-500" />
            <h2 className="text-sm font-medium text-neutral-200">{t('canvas.settings')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-neutral-600 hover:text-neutral-300 hover:bg-accent transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <Separator className="bg-muted" />

        {/* Tabs */}
        <Tabs defaultValue="canvas" className="flex-1 flex flex-col min-h-0 gap-0">
          <div className="px-4 pt-2.5 pb-0">
            <TabsList className="w-full bg-muted border border-border h-8 p-0.5 rounded-xl">
              <TabsTrigger value="canvas" className="flex-1 gap-1.5 text-2xs h-full rounded-md">
                <LayoutGrid size={12} />
                {t('canvas.settingsTabCanvas')}
              </TabsTrigger>
              <TabsTrigger value="edges" className="flex-1 gap-1.5 text-2xs h-full rounded-md">
                <Link2 size={12} />
                {t('canvas.settingsTabEdges')}
              </TabsTrigger>
              <TabsTrigger value="colors" className="flex-1 gap-1.5 text-2xs h-full rounded-md">
                <Paintbrush size={12} />
                {t('canvas.settingsTabColors')}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- Canvas Tab --- */}
          <TabsContent value="canvas" className="flex-1 overflow-y-auto px-4 pb-4 pt-1 mt-0">
            <SectionLabel>{t('canvas.settingsDisplay')}</SectionLabel>
            <div className="divide-y divide-white/[0.04]">
              <SettingRow
                icon={Grid3x3}
                label={t('canvas.showGrid')}
                description={t('canvas.showGridDesc')}
              >
                <Switch checked={showGrid} onCheckedChange={(v) => onShowGridChange?.(v)} />
              </SettingRow>
              <SettingRow
                icon={Maximize2}
                label={t('canvas.showMinimap')}
                description={t('canvas.showMinimapDesc')}
              >
                <Switch checked={showMinimap} onCheckedChange={(v) => onShowMinimapChange?.(v)} />
              </SettingRow>
              <SettingRow
                icon={ZoomIn}
                label={t('canvas.showControls')}
                description={t('canvas.showControlsDesc')}
              >
                <Switch checked={showControls} onCheckedChange={(v) => onShowControlsChange?.(v)} />
              </SettingRow>
            </div>
            <div className="mt-2">
              <SectionLabel>{t('canvas.settingsAdvanced')}</SectionLabel>
              <SettingRow
                icon={Beaker}
                label={t('canvas.experimentalMode')}
                description={t('canvas.experimentalModeDesc')}
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
            <SectionLabel>{t('canvas.settingsConnections')}</SectionLabel>
            <div className="divide-y divide-white/[0.04]">
              <SettingRow
                icon={Link2}
                label={t('canvas.edgeStyle')}
                description={t('canvas.edgeStyleDesc')}
              >
                <SegmentedControl
                  size="sm"
                  aria-label={t('canvas.edgeStyle')}
                  value={edgeStyle}
                  onChange={(v) => onEdgeStyleChange?.(v)}
                  options={[
                    { value: 'solid', label: t('canvas.edgeStyleSolid') },
                    { value: 'dashed', label: t('canvas.edgeStyleDash') },
                  ]}
                />
              </SettingRow>
              <SettingRow
                icon={Link2}
                label={t('canvas.edgeWidth')}
                description={t('canvas.edgeWidthDesc')}
              >
                <SegmentedControl
                  size="sm"
                  aria-label={t('canvas.edgeWidth')}
                  value={edgeStrokeWidth}
                  onChange={(v) => onEdgeStrokeWidthChange?.(v)}
                  options={[
                    { value: 'normal', label: t('canvas.edgeWidthBold') },
                    { value: 'thin', label: t('canvas.edgeWidthThin') },
                  ]}
                />
              </SettingRow>
            </div>
            {/* Edge preview */}
            <div className="mt-3 p-3.5 bg-muted rounded-xl border border-border">
              <p className="text-xs font-medium text-neutral-500 mb-2.5">{t('canvas.preview')}</p>
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
                <circle cx="24" cy="20" r="5" className="fill-neutral-300" />
                <circle cx="276" cy="20" r="5" className="fill-neutral-600" />
              </svg>
            </div>
          </TabsContent>

          {/* --- Colors Tab --- */}
          <TabsContent value="colors" className="flex-1 overflow-y-auto px-4 pb-4 pt-1 mt-0">
            <SectionLabel>{t('canvas.settingsTheme')}</SectionLabel>
            <div className="divide-y divide-white/[0.04]">
              <ColorSettingRow icon={Palette} label={t('canvas.backgroundColor')}>
                <ExpandableColorPicker
                  color={backgroundColor}
                  onChange={(c) => onBackgroundColorChange?.(c)}
                  label="Background"
                  presets={BG_PRESETS}
                  onReset={() => onBackgroundColorChange?.(COLOR_DEFAULTS.background)}
                />
              </ColorSettingRow>

              <ColorSettingRow icon={Diamond} label={t('canvas.brandCyanColor')}>
                <ExpandableColorPicker
                  color={brandCyan.startsWith('#') ? brandCyan : '#00d9ff'}
                  onChange={(c) => onBrandCyanChange?.(c)}
                  label="Accent"
                  presets={ACCENT_PRESETS}
                  onReset={() => onBrandCyanChange?.(COLOR_DEFAULTS.accent)}
                />
              </ColorSettingRow>

              <ColorSettingRow icon={Grid3x3} label={t('canvas.gridColor')}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-neutral-500">{t('canvas.showGrid')}</span>
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

              <ColorSettingRow icon={MousePointer2} label={t('canvas.cursorColor')}>
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

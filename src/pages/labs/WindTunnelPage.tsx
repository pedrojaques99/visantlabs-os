import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Activity,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Info,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Save,
  Shapes,
  Share2,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Video,
  Wind,
  X,
} from '@/lib/ui/icons';
import { toast } from 'sonner';
import { loadImageFromFile } from '@/components/labs/wind-tunnel/ImageObstacles';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/Tooltip';
import { PanelSectionTabs, type PanelTab } from '@/components/shared/PanelSectionTabs';
import {
  StageDock,
  StageDockDivider,
  StageDockGroup,
  StageDockReveal,
  StageDockText,
  stageDockButton,
} from '@/components/shared/StageDock';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import {
  InlineColorPicker,
  ToolPanel,
  ToolPanelChip,
  ToolPanelDisclosure,
  ToolPanelExportActions,
  ToolPanelGrid,
  ToolPanelRow,
  ToolPanelSection,
} from '@/components/shared/ToolPanel';
import { useIsMobile } from '@/hooks/use-media-query';
import { usePasteImage } from '@/hooks/usePasteImage';
import { Input } from '@/components/ui/input';
import {
  WindTunnelCanvas,
  type WindTunnelConfig,
  type WindTunnelHandle,
  type FieldOverlay,
} from '@/components/labs/wind-tunnel/WindTunnelCanvas';
import { useTranslation } from '@/hooks/useTranslation';
import { copyToClipboard } from '@/utils/clipboard';
import { cn } from '@/lib/utils';

const DEFAULT_CONFIG: WindTunnelConfig = {
  obstacleType: 'text',
  text: 'VISANT',
  fontFamily: 'Manrope',
  bold: true,
  windSpeed: 50,
  viscosity: 20,
  particleCount: 5000,
  particleSize: 1.5,
  colorMode: 'rainbow',
  renderMode: 'streamlines',
  baseColor: 'rgba(100, 180, 255, 1)',
  showObstacles: true,
  perspective: 0,
  paused: false,
  obstacleScale: 100,
  obstacleOffsetX: 0,
  obstacleOffsetY: 0,
  bgColor: '#0a0a0a',
  showGrid: false,
  glowIntensity: 0,
  particleLifetime: 100,
  trailLength: 16,
  spread: 50,
  fieldOverlay: 'none' as FieldOverlay,
  fieldOpacity: 0.4,
  showArrows: false,
  exportMetadata: false,
};

type SerializableConfig = Omit<WindTunnelConfig, 'obstacleImage' | 'paused'>;

const FIELD_OVERLAYS: { key: FieldOverlay; labelKey: string }[] = [
  { key: 'none', labelKey: 'wind.tunnel.field_modes.none' },
  { key: 'velocity', labelKey: 'wind.tunnel.field_modes.velocity' },
  { key: 'pressure', labelKey: 'wind.tunnel.field_modes.pressure' },
  { key: 'vorticity', labelKey: 'wind.tunnel.field_modes.vorticity' },
];

interface SavedPreset {
  name: string;
  /** Built-in presets are translated. A saved one keeps the name the person gave it. */
  labelKey?: string;
  config: SerializableConfig;
  createdAt: number;
}

const BUILT_IN_PRESETS: SavedPreset[] = [
  {
    name: 'Classic Airfoil',
    labelKey: 'wind.tunnel.preset_names.classic_airfoil',
    createdAt: 0,
    config: {
      ...DEFAULT_CONFIG,
      obstacleType: 'airfoil',
      colorMode: 'velocity',
      renderMode: 'streamlines',
      windSpeed: 60,
      viscosity: 15,
      particleCount: 6000,
      particleSize: 1.2,
      glowIntensity: 8,
      obstacleScale: 120,
      obstacleOffsetX: 0,
      obstacleOffsetY: 0,
      bgColor: '#050510',
      showGrid: false,
      showObstacles: true,
      perspective: 0,
      text: 'VISANT',
      fontFamily: 'Manrope',
      bold: true,
      baseColor: 'rgba(100, 180, 255, 1)',
    },
  },
  {
    name: 'Neon Vortex',
    labelKey: 'wind.tunnel.preset_names.neon_vortex',
    createdAt: 0,
    config: {
      ...DEFAULT_CONFIG,
      obstacleType: 'circle',
      colorMode: 'rainbow',
      renderMode: 'streamlines',
      windSpeed: 80,
      viscosity: 8,
      particleCount: 8000,
      particleSize: 1,
      glowIntensity: 15,
      obstacleScale: 80,
      obstacleOffsetX: 0,
      obstacleOffsetY: 0,
      bgColor: '#000000',
      showGrid: false,
      showObstacles: false,
      perspective: 0,
      text: 'VISANT',
      fontFamily: 'Manrope',
      bold: true,
      baseColor: 'rgba(100, 180, 255, 1)',
    },
  },
  {
    name: 'Blueprint',
    labelKey: 'wind.tunnel.preset_names.blueprint',
    createdAt: 0,
    config: {
      ...DEFAULT_CONFIG,
      obstacleType: 'diamond',
      colorMode: 'uniform',
      renderMode: 'streamlines',
      windSpeed: 40,
      viscosity: 30,
      particleCount: 4000,
      particleSize: 0.5,
      glowIntensity: 0,
      obstacleScale: 100,
      obstacleOffsetX: 0,
      obstacleOffsetY: 0,
      bgColor: '#0a1628',
      showGrid: true,
      showObstacles: true,
      perspective: 0,
      text: 'VISANT',
      fontFamily: 'Manrope',
      bold: true,
      baseColor: 'rgba(80, 160, 255, 1)',
    },
  },
  {
    name: 'Fire Storm',
    labelKey: 'wind.tunnel.preset_names.fire_storm',
    createdAt: 0,
    config: {
      ...DEFAULT_CONFIG,
      obstacleType: 'text',
      text: 'FIRE',
      colorMode: 'uniform',
      renderMode: 'particles',
      windSpeed: 90,
      viscosity: 5,
      particleCount: 12000,
      particleSize: 2,
      glowIntensity: 12,
      obstacleScale: 130,
      obstacleOffsetX: 0,
      obstacleOffsetY: 0,
      bgColor: '#0a0000',
      showGrid: false,
      showObstacles: true,
      perspective: 20,
      fontFamily: 'Impact',
      bold: true,
      baseColor: 'rgba(255, 80, 20, 1)',
    },
  },
  {
    name: '3D Tunnel',
    labelKey: 'wind.tunnel.preset_names.tunnel_3d',
    createdAt: 0,
    config: {
      ...DEFAULT_CONFIG,
      obstacleType: 'square',
      colorMode: 'density',
      renderMode: 'streamlines',
      windSpeed: 55,
      viscosity: 25,
      particleCount: 7000,
      particleSize: 1,
      glowIntensity: 6,
      obstacleScale: 60,
      obstacleOffsetX: 0,
      obstacleOffsetY: 0,
      bgColor: '#080808',
      showGrid: false,
      showObstacles: true,
      perspective: 65,
      text: 'VISANT',
      fontFamily: 'Manrope',
      bold: true,
      baseColor: 'rgba(100, 180, 255, 1)',
    },
  },
];

const PRESETS_KEY = 'wind-tunnel-presets';

function loadUserPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUserPresets(presets: SavedPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function serializeConfig(cfg: WindTunnelConfig): SerializableConfig {
  const { obstacleImage: _, paused: __, ...rest } = cfg;
  return rest;
}

function encodeConfigToUrl(cfg: WindTunnelConfig): string {
  const serialized = serializeConfig(cfg);
  const json = JSON.stringify(serialized);
  const encoded = btoa(encodeURIComponent(json));
  const url = new URL(window.location.href);
  url.searchParams.set('preset', encoded);
  return url.toString();
}

function decodeConfigFromUrl(): SerializableConfig | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('preset');
    if (!encoded) return null;
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function configToJson(cfg: WindTunnelConfig): string {
  return JSON.stringify(serializeConfig(cfg), null, 2);
}

function parseConfigJson(json: string): SerializableConfig | null {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === 'object' && parsed !== null && 'windSpeed' in parsed) return parsed;
    return null;
  } catch {
    return null;
  }
}

function rgbaToHex(rgba: string): string {
  const m = rgba.match(/[\d.]+/g);
  if (!m || m.length < 3) return '#64b4ff';
  const r = Math.round(Number(m[0])).toString(16).padStart(2, '0');
  const g = Math.round(Number(m[1])).toString(16).padStart(2, '0');
  const b = Math.round(Number(m[2])).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function hexToRgba(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 1)`;
}

const OBSTACLE_SHAPES = [
  { key: 'text', labelKey: 'wind.tunnel.shapes.text' },
  { key: 'circle', labelKey: 'wind.tunnel.shapes.circle' },
  { key: 'triangle', labelKey: 'wind.tunnel.shapes.triangle' },
  { key: 'square', labelKey: 'wind.tunnel.shapes.square' },
  { key: 'diamond', labelKey: 'wind.tunnel.shapes.diamond' },
  { key: 'airfoil', labelKey: 'wind.tunnel.shapes.airfoil' },
  { key: 'image', labelKey: 'wind.tunnel.shapes.image' },
] as const;

const COLOR_MODES = [
  { key: 'rainbow', labelKey: 'wind.tunnel.color_modes.rainbow' },
  { key: 'velocity', labelKey: 'wind.tunnel.color_modes.velocity' },
  { key: 'density', labelKey: 'wind.tunnel.color_modes.density' },
  { key: 'uniform', labelKey: 'wind.tunnel.color_modes.uniform' },
] as const;

const RENDER_MODES = [
  { key: 'streamlines', labelKey: 'wind.tunnel.render_modes.streamlines' },
  { key: 'particles', labelKey: 'wind.tunnel.render_modes.particles' },
] as const;

const FONT_OPTIONS = ['Manrope', 'Red Hat Mono', 'Arial Black', 'Georgia', 'Impact', 'Courier New'];

const EXPORT_SCALES = [
  { multiplier: 1, labelKey: 'wind.tunnel.scales.screen' },
  { multiplier: 2, labelKey: 'wind.tunnel.scales.hd' },
  { multiplier: 4, labelKey: 'wind.tunnel.scales.print' },
] as const;

/** No status bar here, so the stage takes the strip the shell keeps for one. Desktop only. */
const FULL_BLEED_STAGE = 'absolute inset-0 !pb-0 transition-[padding] duration-[var(--dur-slow)]';

/** A config pasted or shared by link can hold a mode we do not know: show it as it came. */
function modeLabel(
  modes: readonly { key: string; labelKey: string }[],
  key: string,
  t: (key: string) => string
): string {
  const labelKey = modes.find((mode) => mode.key === key)?.labelKey;
  return labelKey ? t(labelKey) : key;
}

function ControlsContent({
  config,
  update,
  imageName,
  fileInputRef,
  handleImageUpload,
  handleClearImage,
  handleReset,
  userPresets,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onCopyJson,
  onPasteJson,
  t,
}: {
  config: WindTunnelConfig;
  update: <K extends keyof WindTunnelConfig>(key: K, value: WindTunnelConfig[K]) => void;
  imageName: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (file: File) => void;
  handleClearImage: () => void;
  handleReset: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  userPresets: SavedPreset[];
  onSavePreset: () => void;
  onLoadPreset: (preset: SavedPreset) => void;
  onDeletePreset: (idx: number) => void;
  onCopyJson: () => void;
  onPasteJson: () => void;
}) {
  const tabs: PanelTab[] = [
    {
      id: 'presets',
      icon: <Sparkles size={15} />,
      label: t('wind.tunnel.tabs.presets'),
      content: (
        <>
          <ToolPanelGrid cols={2}>
            {BUILT_IN_PRESETS.map((p) => (
              <ToolPanelChip
                key={p.name}
                onClick={() => onLoadPreset(p)}
                className="truncate text-2xs"
              >
                {p.labelKey ? t(p.labelKey) : p.name}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          {userPresets.length > 0 && (
            <ToolPanelSection title={t('wind.tunnel.saved_presets')}>
              <div className="space-y-1">
                {userPresets.map((p, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <ToolPanelChip
                      onClick={() => onLoadPreset(p)}
                      className="min-w-0 flex-1 truncate text-2xs"
                    >
                      {p.name}
                    </ToolPanelChip>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDeletePreset(i)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={t('wind.tunnel.delete_preset', { name: p.name })}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </ToolPanelSection>
          )}
          <ToolPanelChip
            onClick={onSavePreset}
            className="flex w-full items-center justify-center gap-2 py-1.5 text-2xs"
          >
            <Save size={12} /> {t('wind.tunnel.save_current')}
          </ToolPanelChip>
          <ToolPanelGrid cols={2}>
            <ToolPanelChip
              onClick={onCopyJson}
              className="flex items-center justify-center gap-1.5 py-1.5 text-2xs"
            >
              <ClipboardCopy size={12} /> {t('wind.tunnel.copy_json')}
            </ToolPanelChip>
            <ToolPanelChip
              onClick={onPasteJson}
              className="flex items-center justify-center gap-1.5 py-1.5 text-2xs"
            >
              <ClipboardPaste size={12} /> {t('wind.tunnel.import_json')}
            </ToolPanelChip>
          </ToolPanelGrid>
          <ToolPanelChip onClick={handleReset} className="w-full py-1.5 text-center text-2xs">
            {t('wind.tunnel.reset_all')}
          </ToolPanelChip>
          <p className="text-2xs leading-relaxed text-muted-foreground">
            {t('wind.tunnel.shortcuts_hint')}
          </p>
        </>
      ),
    },
    {
      id: 'obstacle',
      icon: <Shapes size={15} />,
      label: t('wind.tunnel.obstacle'),
      content: (
        <>
          <ToolPanelGrid cols={3}>
            {OBSTACLE_SHAPES.map((s) => (
              <ToolPanelChip
                key={s.key}
                active={config.obstacleType === s.key}
                onClick={() => update('obstacleType', s.key)}
                className="truncate px-1.5 text-center text-2xs"
              >
                {t(s.labelKey)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>

          {config.obstacleType === 'image' && (
            <ToolPanelSection title={t('wind.tunnel.image')}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="hidden"
                aria-label={t('wind.tunnel.upload_obstacle_image')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              {imageName && (
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 truncate text-2xs text-muted-foreground">
                    {imageName}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={handleClearImage}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('wind.tunnel.clear_image')}
                  >
                    <X size={12} />
                  </Button>
                </div>
              )}
              <ToolPanelChip
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 py-1.5 text-2xs"
              >
                <Upload size={12} />
                {imageName ? t('wind.tunnel.replace_image') : t('wind.tunnel.upload_image')}
              </ToolPanelChip>
              <p className="text-center text-2xs text-muted-foreground">
                {t('wind.tunnel.or_drag_drop_onto_canvas')}
              </p>
            </ToolPanelSection>
          )}

          {config.obstacleType === 'text' && (
            <ToolPanelSection title={t('wind.tunnel.text')}>
              <Input
                value={config.text}
                onChange={(e) => update('text', e.target.value)}
                placeholder="VISANT"
                maxLength={24}
                className="h-7 border-border bg-transparent text-xs"
                aria-label={t('wind.tunnel.obstacle_text')}
              />
              <ToolPanelGrid cols={3}>
                {FONT_OPTIONS.map((f) => (
                  <ToolPanelChip
                    key={f}
                    active={config.fontFamily === f}
                    onClick={() => update('fontFamily', f)}
                    className="truncate px-1.5 text-center text-2xs"
                  >
                    <span style={{ fontFamily: f }}>{f.split(' ')[0]}</span>
                  </ToolPanelChip>
                ))}
              </ToolPanelGrid>
              <ToolPanelRow label={t('wind.tunnel.bold')}>
                <Switch
                  aria-label={t('wind.tunnel.toggle_bold')}
                  checked={config.bold}
                  onCheckedChange={(v) => update('bold', v)}
                />
              </ToolPanelRow>
            </ToolPanelSection>
          )}

          <ToolPanelSection title={t('wind.tunnel.transform')}>
            <NodeSlider
              label={t('wind.tunnel.scale')}
              value={config.obstacleScale}
              resetValue={DEFAULT_CONFIG.obstacleScale}
              min={10}
              max={250}
              step={5}
              onChange={(v) => update('obstacleScale', v)}
              formatValue={(v) => `${Math.round(v)}%`}
            />
            <NodeSlider
              label="X"
              value={config.obstacleOffsetX}
              resetValue={DEFAULT_CONFIG.obstacleOffsetX}
              min={-50}
              max={50}
              step={1}
              onChange={(v) => update('obstacleOffsetX', v)}
              formatValue={(v) => String(Math.round(v))}
            />
            <NodeSlider
              label="Y"
              value={config.obstacleOffsetY}
              resetValue={DEFAULT_CONFIG.obstacleOffsetY}
              min={-50}
              max={50}
              step={1}
              onChange={(v) => update('obstacleOffsetY', v)}
              formatValue={(v) => String(Math.round(v))}
            />
          </ToolPanelSection>
        </>
      ),
    },
    {
      id: 'flow',
      icon: <Wind size={15} />,
      label: t('wind.tunnel.simulation'),
      content: (
        <>
          <NodeSlider
            label={t('wind.tunnel.wind')}
            value={config.windSpeed}
            resetValue={DEFAULT_CONFIG.windSpeed}
            min={1}
            max={100}
            step={1}
            onChange={(v) => update('windSpeed', v)}
            formatValue={(v) => String(Math.round(v))}
          />
          <NodeSlider
            label={t('wind.tunnel.viscosity')}
            value={config.viscosity}
            resetValue={DEFAULT_CONFIG.viscosity}
            min={1}
            max={100}
            step={1}
            onChange={(v) => update('viscosity', v)}
            formatValue={(v) => String(Math.round(v))}
          />
          <NodeSlider
            label={t('wind.tunnel.particles')}
            value={config.particleCount}
            resetValue={DEFAULT_CONFIG.particleCount}
            min={500}
            max={15000}
            step={500}
            onChange={(v) => update('particleCount', v)}
            formatValue={(v) => String(Math.round(v))}
          />
          <NodeSlider
            label={t('wind.tunnel.trail')}
            value={config.trailLength}
            resetValue={DEFAULT_CONFIG.trailLength}
            min={2}
            max={32}
            step={2}
            onChange={(v) => update('trailLength', v)}
            formatValue={(v) => String(Math.round(v))}
          />
          <ToolPanelDisclosure label={t('canvasNodes.shared.advancedSettings')}>
            <NodeSlider
              label={t('wind.tunnel.size')}
              value={config.particleSize}
              resetValue={DEFAULT_CONFIG.particleSize}
              min={0.5}
              max={4}
              step={0.5}
              onChange={(v) => update('particleSize', v)}
              formatValue={(v) => v.toFixed(1)}
            />
            <NodeSlider
              label={t('wind.tunnel.lifetime')}
              value={config.particleLifetime}
              resetValue={DEFAULT_CONFIG.particleLifetime}
              min={20}
              max={300}
              step={10}
              onChange={(v) => update('particleLifetime', v)}
              formatValue={(v) => String(Math.round(v))}
            />
            <NodeSlider
              label={t('wind.tunnel.spread')}
              value={config.spread}
              resetValue={DEFAULT_CONFIG.spread}
              min={0}
              max={100}
              step={5}
              onChange={(v) => update('spread', v)}
              formatValue={(v) => String(Math.round(v))}
            />
          </ToolPanelDisclosure>
        </>
      ),
    },
    {
      id: 'look',
      icon: <Palette size={15} />,
      label: t('wind.tunnel.appearance'),
      content: (
        <>
          <ToolPanelSection title={t('wind.tunnel.render')}>
            <SegmentedControl
              aria-label={t('wind.tunnel.render')}
              size="xs"
              fullWidth
              value={config.renderMode}
              onChange={(v) => update('renderMode', v)}
              options={RENDER_MODES.map((m) => ({ value: m.key, label: t(m.labelKey) }))}
            />
          </ToolPanelSection>

          <ToolPanelSection title={t('wind.tunnel.color')}>
            <ToolPanelGrid cols={2}>
              {COLOR_MODES.map((m) => (
                <ToolPanelChip
                  key={m.key}
                  active={config.colorMode === m.key}
                  onClick={() => update('colorMode', m.key)}
                  className="truncate text-2xs"
                >
                  {t(m.labelKey)}
                </ToolPanelChip>
              ))}
            </ToolPanelGrid>
            {config.colorMode === 'uniform' && (
              <InlineColorPicker
                value={rgbaToHex(config.baseColor)}
                onChange={(hex) => update('baseColor', hexToRgba(hex))}
                label={t('wind.tunnel.particle_color')}
              />
            )}
          </ToolPanelSection>

          <ToolPanelSection title={t('wind.tunnel.effects')}>
            <NodeSlider
              label={t('wind.tunnel.glow')}
              value={config.glowIntensity}
              resetValue={DEFAULT_CONFIG.glowIntensity}
              min={0}
              max={30}
              step={1}
              onChange={(v) => update('glowIntensity', v)}
              formatValue={(v) => String(Math.round(v))}
            />
            <NodeSlider
              label={t('wind.tunnel.perspective')}
              value={config.perspective}
              resetValue={DEFAULT_CONFIG.perspective}
              min={0}
              max={100}
              step={1}
              onChange={(v) => update('perspective', v)}
              formatValue={(v) => String(Math.round(v))}
            />
          </ToolPanelSection>

          <ToolPanelSection title={t('wind.tunnel.scene')}>
            <InlineColorPicker
              value={config.bgColor}
              onChange={(hex) => update('bgColor', hex)}
              label={t('wind.tunnel.background')}
            />
            <ToolPanelRow label={t('wind.tunnel.show_obstacles')}>
              <Switch
                aria-label={t('wind.tunnel.toggle_obstacle_visibility')}
                checked={config.showObstacles}
                onCheckedChange={(v) => update('showObstacles', v)}
              />
            </ToolPanelRow>
            <ToolPanelRow label={t('wind.tunnel.grid_overlay')}>
              <Switch
                aria-label={t('wind.tunnel.toggle_grid')}
                checked={config.showGrid}
                onCheckedChange={(v) => update('showGrid', v)}
              />
            </ToolPanelRow>
            <ToolPanelRow label={t('wind.tunnel.export_metadata')}>
              <Switch
                aria-label={t('wind.tunnel.export_metadata')}
                checked={config.exportMetadata}
                onCheckedChange={(v) => update('exportMetadata', v)}
              />
            </ToolPanelRow>
          </ToolPanelSection>
        </>
      ),
    },
    {
      id: 'field',
      icon: <Activity size={15} />,
      label: t('wind.tunnel.field_overlay'),
      content: (
        <>
          <ToolPanelGrid cols={2}>
            {FIELD_OVERLAYS.map((f) => (
              <ToolPanelChip
                key={f.key}
                active={config.fieldOverlay === f.key}
                onClick={() => update('fieldOverlay', f.key)}
                className="truncate text-2xs"
              >
                {t(f.labelKey)}
              </ToolPanelChip>
            ))}
          </ToolPanelGrid>
          {config.fieldOverlay !== 'none' && (
            <NodeSlider
              label={t('wind.tunnel.opacity')}
              value={config.fieldOpacity}
              resetValue={DEFAULT_CONFIG.fieldOpacity}
              min={0.1}
              max={1}
              step={0.05}
              onChange={(v) => update('fieldOpacity', v)}
              formatValue={(v) => `${Math.round(v * 100)}%`}
            />
          )}
          <ToolPanelRow label={t('wind.tunnel.vector_arrows')}>
            <Switch
              aria-label={t('wind.tunnel.vector_arrows')}
              checked={config.showArrows}
              onCheckedChange={(v) => update('showArrows', v)}
            />
          </ToolPanelRow>
        </>
      ),
    },
  ];

  return (
    <PanelSectionTabs tabs={tabs} defaultId="presets" ariaLabel={t('wind.tunnel.tabs.aria')} />
  );
}

export function WindTunnelPage() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [config, setConfig] = useState<WindTunnelConfig>(DEFAULT_CONFIG);
  const [showPanel, setShowPanel] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [dragging, setDragging] = useState(false);
  const tunnelRef = useRef<WindTunnelHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [userPresets, setUserPresets] = useState<SavedPreset[]>(() => loadUserPresets());

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(png|svg\+xml|jpeg|webp)$/)) {
        toast.error(t('wind.tunnel.unsupported_format_use_png_svg_jpeg_or'));
        return;
      }
      try {
        const img = await loadImageFromFile(file);
        setConfig((prev) => ({ ...prev, obstacleType: 'image' as const, obstacleImage: img }));
        setImageName(file.name);
      } catch {
        toast.error(t('wind.tunnel.failed_to_load_image'));
      }
    },
    [t]
  );

  usePasteImage(
    useCallback(
      ({ file }) => {
        if (file) handleImageUpload(file);
      },
      [handleImageUpload]
    )
  );

  const handleClearImage = useCallback(() => {
    setConfig((prev) => ({ ...prev, obstacleType: 'text' as const, obstacleImage: undefined }));
    setImageName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (tunnelRef.current) {
        setActiveCount(tunnelRef.current.getActiveCount());
        setFps(tunnelRef.current.getFps());
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  const update = useCallback(
    <K extends keyof WindTunnelConfig>(key: K, value: WindTunnelConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleReset = useCallback(() => {
    setConfig((prev) => ({ ...DEFAULT_CONFIG, obstacleImage: prev.obstacleImage }));
    setImageName(null);
  }, []);

  const handleResetSim = useCallback(() => {
    tunnelRef.current?.resetSimulation();
  }, []);

  const togglePause = useCallback(() => {
    setConfig((prev) => ({ ...prev, paused: !prev.paused }));
  }, []);

  const handleExport = useCallback(
    (multiplier: number = 1) => {
      try {
        const handle = tunnelRef.current;
        if (!handle) return;
        const dataUrl =
          multiplier === 1
            ? handle.getCanvasRef()?.toDataURL('image/png')
            : handle.exportAtResolution(multiplier);
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.download = `wind-tunnel-${multiplier}x-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success(t('wind.tunnel.png_exported_at_multiplierx', { multiplier }));
      } catch {
        toast.error(t('wind.tunnel.export_failed'));
      }
    },
    [t]
  );

  const handleCopyPng = useCallback(async () => {
    const canvas = tunnelRef.current?.getCanvasRef();
    if (!canvas) return;
    try {
      // Safari only accepts a write started inside the tap, so the image goes in as a promise.
      const png = new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty'))), 'image/png');
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast.success(t('miniTools.copied'));
    } catch {
      toast.error(t('miniTools.copyFailed'));
    }
  }, [t]);

  const handleSavePreset = useCallback(() => {
    const name = prompt(t('wind.tunnel.preset_name_prompt'));
    if (!name?.trim()) return;
    const preset: SavedPreset = {
      name: name.trim(),
      config: serializeConfig(config),
      createdAt: Date.now(),
    };
    const updated = [...userPresets, preset];
    setUserPresets(updated);
    saveUserPresets(updated);
    toast.success(t('wind.tunnel.preset_saved', { name: name.trim() }));
  }, [config, userPresets, t]);

  const handleLoadPreset = useCallback(
    (preset: SavedPreset) => {
      setConfig((prev) => ({
        ...preset.config,
        obstacleImage: prev.obstacleImage,
        paused: prev.paused,
      }));
      const name = preset.labelKey ? t(preset.labelKey) : preset.name;
      toast.success(t('wind.tunnel.preset_loaded', { name }));
    },
    [t]
  );

  const handleDeletePreset = useCallback(
    (idx: number) => {
      const updated = userPresets.filter((_, i) => i !== idx);
      setUserPresets(updated);
      saveUserPresets(updated);
      toast.success(t('wind.tunnel.preset_deleted'));
    },
    [userPresets, t]
  );

  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = useCallback((duration: number) => {
    tunnelRef.current?.startRecording(duration);
    setIsRecording(true);
    if (duration > 0) {
      setTimeout(() => setIsRecording(false), duration * 1000 + 500);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    tunnelRef.current?.stopRecording();
    setIsRecording(false);
  }, []);

  const handleShareUrl = useCallback(() => {
    const url = encodeConfigToUrl(config);
    copyToClipboard(url)
      .then(() => {
        toast.success(t('wind.tunnel.share_url_copied'));
      })
      .catch(() => {
        prompt(t('wind.tunnel.copy_this_url'), url);
      });
  }, [config, t]);

  const handleCopyJson = useCallback(() => {
    const json = configToJson(config);
    copyToClipboard(json)
      .then(() => {
        toast.success(t('wind.tunnel.config_copied'));
      })
      .catch(() => {
        prompt(t('wind.tunnel.copy_this_json'), json);
      });
  }, [config, t]);

  const handlePasteJson = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = parseConfigJson(text);
      if (parsed) {
        setConfig((prev) => ({
          ...parsed,
          obstacleImage: prev.obstacleImage,
          paused: prev.paused,
        }));
        toast.success(t('wind.tunnel.config_imported_clipboard'));
      } else {
        toast.error(t('wind.tunnel.invalid_config'));
      }
    } catch {
      const text = prompt(t('wind.tunnel.paste_config_prompt'));
      if (text) {
        const parsed = parseConfigJson(text);
        if (parsed) {
          setConfig((prev) => ({
            ...parsed,
            obstacleImage: prev.obstacleImage,
            paused: prev.paused,
          }));
          toast.success(t('wind.tunnel.config_imported'));
        } else {
          toast.error(t('wind.tunnel.invalid_json'));
        }
      }
    }
  }, [t]);

  // Load config from URL on mount
  useEffect(() => {
    const urlConfig = decodeConfigFromUrl();
    if (urlConfig) {
      setConfig((prev) => ({
        ...urlConfig,
        obstacleImage: prev.obstacleImage,
        paused: prev.paused,
      }));
      toast.success(t('wind.tunnel.preset_loaded_from_url'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePause();
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowPanel((p) => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyE') {
        e.preventDefault();
        handleExport(1);
      }
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        // Here R restarts the simulation. The shell listens further down, to ask about a reset.
        e.stopPropagation();
        handleResetSim();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [togglePause, handleExport, handleResetSim]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleImageUpload(file);
    },
    [handleImageUpload]
  );

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
  };

  const title = t('wind.tunnel.wind_tunnel');

  const controlsPanel = (
    <ToolPanel>
      <ControlsContent
        config={config}
        update={update}
        imageName={imageName}
        fileInputRef={fileInputRef}
        handleImageUpload={handleImageUpload}
        handleClearImage={handleClearImage}
        handleReset={handleReset}
        userPresets={userPresets}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onDeletePreset={handleDeletePreset}
        onCopyJson={handleCopyJson}
        onPasteJson={handlePasteJson}
        t={t}
      />
      {/* On a phone these go to the tools row: the sheet needs the room. */}
      {!isMobile && (
        <ToolPanelExportActions
          onExport={() => handleExport(1)}
          isExporting={false}
          disabled={false}
          onCopyAsPng={() => void handleCopyPng()}
          sendTo={
            <div className="space-y-1">
              {EXPORT_SCALES.map((s) => (
                <ToolPanelChip
                  key={s.multiplier}
                  onClick={() => handleExport(s.multiplier)}
                  className="w-full py-1.5 text-2xs"
                >
                  {s.multiplier}x · {t(s.labelKey)}
                </ToolPanelChip>
              ))}
            </div>
          }
        />
      )}
    </ToolPanel>
  );

  return (
    <ToolEditorShell
      title={title}
      documentTitle={title}
      panelVisible={showPanel}
      setPanelVisible={setShowPanel}
      onReset={handleReset}
      hideTopBar
      controlsPanel={controlsPanel}
      controlsPanelWidth={340}
      mobileSheetLabel={t('wind.tunnel.tabs.panel')}
      isDragOver={dragging}
      dragProps={dragProps}
      dropMessage={t('wind.tunnel.drop_image_to_use_as_obstacle')}
      canvasClassName={isMobile ? undefined : FULL_BLEED_STAGE}
    >
      {/* The shell reserves the panel with padding: everything here lives in that box. */}
      <div className="relative h-full w-full">
        <WindTunnelCanvas
          ref={tunnelRef}
          config={config}
          onConfigChange={(partial) => setConfig((prev) => ({ ...prev, ...partial }))}
        />
        <StageDock className="bottom-3">
          <Tooltip content={t(config.paused ? 'toolDock.play' : 'toolDock.pause')}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(config.paused ? 'toolDock.play' : 'toolDock.pause')}
              className={cn(stageDockButton, 'text-foreground')}
              onClick={togglePause}
            >
              {config.paused ? <Play size={14} /> : <Pause size={14} />}
            </Button>
          </Tooltip>
          {/* On a phone an open group needs the row, so the tools make way for it. */}
          <StageDockReveal open={!isMobile || (!detailsOpen && !exportOpen)}>
            <Tooltip content={t('wind.tunnel.restart_hint')}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('wind.tunnel.restart_simulation_2')}
                className={stageDockButton}
                onClick={handleResetSim}
              >
                <RotateCcw size={14} />
              </Button>
            </Tooltip>
            {isRecording ? (
              <Tooltip content={t('wind.tunnel.stop_recording')}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('wind.tunnel.stop_recording')}
                  className={cn(stageDockButton, 'text-destructive')}
                  onClick={handleStopRecording}
                >
                  <Square size={14} />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip content={t('wind.tunnel.record_hint')}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('wind.tunnel.record_hint')}
                  className={stageDockButton}
                  onClick={() => handleStartRecording(10)}
                >
                  <Video size={14} />
                </Button>
              </Tooltip>
            )}
            <Tooltip content={t('wind.tunnel.share_url')}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('wind.tunnel.share_url')}
                className={stageDockButton}
                onClick={handleShareUrl}
              >
                <Share2 size={14} />
              </Button>
            </Tooltip>
            <StageDockDivider />
          </StageDockReveal>
          <StageDockGroup
            icon={<Info size={14} />}
            label={t('toolDock.details')}
            onOpenChange={setDetailsOpen}
          >
            <StageDockText>
              <span aria-live="polite">
                {t('wind.tunnel.particles_count', { count: activeCount.toLocaleString() })}
              </span>
            </StageDockText>
            <StageDockText>{fps} fps</StageDockText>
            <StageDockText>{modeLabel(RENDER_MODES, config.renderMode, t)}</StageDockText>
            <StageDockText>{modeLabel(COLOR_MODES, config.colorMode, t)}</StageDockText>
            {config.fieldOverlay !== 'none' && (
              <StageDockText>
                <span className="text-foreground">
                  {modeLabel(FIELD_OVERLAYS, config.fieldOverlay, t)}
                </span>
              </StageDockText>
            )}
            {isRecording && (
              <StageDockText>
                <span className="animate-pulse text-destructive">{t('wind.tunnel.rec')}</span>
              </StageDockText>
            )}
            {config.paused && (
              <StageDockText>
                <span className="text-warning">{t('wind.tunnel.paused')}</span>
              </StageDockText>
            )}
          </StageDockGroup>
          {/* A phone opens the sheet with its own handle. */}
          {!isMobile && (
            <Tooltip
              content={showPanel ? t('toolEditor.hidePanelHint') : t('toolEditor.showPanelHint')}
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label={showPanel ? t('common.hidePanel') : t('common.showPanel')}
                className={stageDockButton}
                onClick={() => setShowPanel((p) => !p)}
              >
                {showPanel ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>
            </Tooltip>
          )}
          {(isMobile || !showPanel) && (
            <StageDockGroup
              icon={<Download size={14} />}
              label={t('toolDock.export')}
              onOpenChange={setExportOpen}
            >
              {EXPORT_SCALES.map((s) => (
                <Tooltip key={s.multiplier} content={t(s.labelKey)}>
                  <Button
                    variant="surface"
                    size="xs"
                    className="shrink-0"
                    aria-label={`${t('wind.tunnel.export_png')} ${s.multiplier}x`}
                    onClick={() => handleExport(s.multiplier)}
                  >
                    {s.multiplier}x
                  </Button>
                </Tooltip>
              ))}
            </StageDockGroup>
          )}
        </StageDock>
      </div>
    </ToolEditorShell>
  );
}

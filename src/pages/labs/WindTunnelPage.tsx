import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, PanelRightClose, PanelRight, Download, Upload, X, Play, Pause, RotateCcw, ChevronUp, ChevronDown, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { loadImageFromFile } from '@/components/labs/wind-tunnel/ImageObstacles';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { useIsMobile } from '@/hooks/use-media-query';
import { Input } from '@/components/ui/input';
import { WindTunnelCanvas, type WindTunnelConfig, type WindTunnelHandle } from '@/components/labs/wind-tunnel/WindTunnelCanvas';

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
};

type SerializableConfig = Omit<WindTunnelConfig, 'obstacleImage' | 'paused'>;

interface SavedPreset {
  name: string;
  config: SerializableConfig;
  createdAt: number;
}

const BUILT_IN_PRESETS: SavedPreset[] = [
  {
    name: 'Classic Airfoil',
    createdAt: 0,
    config: { ...DEFAULT_CONFIG, obstacleType: 'airfoil', colorMode: 'velocity', renderMode: 'streamlines', windSpeed: 60, viscosity: 15, particleCount: 6000, particleSize: 1.2, glowIntensity: 8, obstacleScale: 120, obstacleOffsetX: 0, obstacleOffsetY: 0, bgColor: '#050510', showGrid: false, showObstacles: true, perspective: 0, text: 'VISANT', fontFamily: 'Manrope', bold: true, baseColor: 'rgba(100, 180, 255, 1)' },
  },
  {
    name: 'Neon Vortex',
    createdAt: 0,
    config: { ...DEFAULT_CONFIG, obstacleType: 'circle', colorMode: 'rainbow', renderMode: 'streamlines', windSpeed: 80, viscosity: 8, particleCount: 8000, particleSize: 1, glowIntensity: 15, obstacleScale: 80, obstacleOffsetX: 0, obstacleOffsetY: 0, bgColor: '#000000', showGrid: false, showObstacles: false, perspective: 0, text: 'VISANT', fontFamily: 'Manrope', bold: true, baseColor: 'rgba(100, 180, 255, 1)' },
  },
  {
    name: 'Blueprint',
    createdAt: 0,
    config: { ...DEFAULT_CONFIG, obstacleType: 'diamond', colorMode: 'uniform', renderMode: 'streamlines', windSpeed: 40, viscosity: 30, particleCount: 4000, particleSize: 0.5, glowIntensity: 0, obstacleScale: 100, obstacleOffsetX: 0, obstacleOffsetY: 0, bgColor: '#0a1628', showGrid: true, showObstacles: true, perspective: 0, text: 'VISANT', fontFamily: 'Manrope', bold: true, baseColor: 'rgba(80, 160, 255, 1)' },
  },
  {
    name: 'Fire Storm',
    createdAt: 0,
    config: { ...DEFAULT_CONFIG, obstacleType: 'text', text: 'FIRE', colorMode: 'uniform', renderMode: 'particles', windSpeed: 90, viscosity: 5, particleCount: 12000, particleSize: 2, glowIntensity: 12, obstacleScale: 130, obstacleOffsetX: 0, obstacleOffsetY: 0, bgColor: '#0a0000', showGrid: false, showObstacles: true, perspective: 20, fontFamily: 'Impact', bold: true, baseColor: 'rgba(255, 80, 20, 1)' },
  },
  {
    name: '3D Tunnel',
    createdAt: 0,
    config: { ...DEFAULT_CONFIG, obstacleType: 'square', colorMode: 'density', renderMode: 'streamlines', windSpeed: 55, viscosity: 25, particleCount: 7000, particleSize: 1, glowIntensity: 6, obstacleScale: 60, obstacleOffsetX: 0, obstacleOffsetY: 0, bgColor: '#080808', showGrid: false, showObstacles: true, perspective: 65, text: 'VISANT', fontFamily: 'Manrope', bold: true, baseColor: 'rgba(100, 180, 255, 1)' },
  },
];

const PRESETS_KEY = 'wind-tunnel-presets';

function loadUserPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveUserPresets(presets: SavedPreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

function serializeConfig(cfg: WindTunnelConfig): SerializableConfig {
  const { obstacleImage: _, paused: __, ...rest } = cfg;
  return rest;
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
  { key: 'text', label: 'Text' },
  { key: 'circle', label: 'Circle' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'square', label: 'Square' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'airfoil', label: 'Airfoil' },
  { key: 'image', label: 'Image' },
] as const;

const COLOR_MODES = [
  { key: 'rainbow', label: 'Rainbow' },
  { key: 'velocity', label: 'Velocity' },
  { key: 'density', label: 'Density' },
  { key: 'uniform', label: 'Uniform' },
] as const;

const RENDER_MODES = [
  { key: 'streamlines', label: 'Stream' },
  { key: 'particles', label: 'Dots' },
] as const;

const FONT_OPTIONS = [
  'Manrope', 'Red Hat Mono', 'Arial Black', 'Georgia', 'Impact', 'Courier New',
];

function ControlsContent({
  config, update, imageName, fileInputRef, handleImageUpload, handleClearImage,
  handleResetSim, handleReset, userPresets, onSavePreset, onLoadPreset, onDeletePreset,
}: {
  config: WindTunnelConfig;
  update: <K extends keyof WindTunnelConfig>(key: K, value: WindTunnelConfig[K]) => void;
  imageName: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (file: File) => void;
  handleClearImage: () => void;
  handleResetSim: () => void;
  handleReset: () => void;
  userPresets: SavedPreset[];
  onSavePreset: () => void;
  onLoadPreset: (preset: SavedPreset) => void;
  onDeletePreset: (idx: number) => void;
}) {
  return (
    <>
      {/* Presets */}
      <div className="p-3 space-y-2 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Presets</MicroTitle>
        <div className="flex flex-wrap gap-1">
          {BUILT_IN_PRESETS.map(p => (
            <Button key={p.name} variant="ghost" size="xs" onClick={() => onLoadPreset(p)} className="text-[8px] text-neutral-500 hover:text-white">{p.name}</Button>
          ))}
        </div>
        {userPresets.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {userPresets.map((p, i) => (
              <div key={i} className="flex items-center gap-0.5">
                <Button variant="ghost" size="xs" onClick={() => onLoadPreset(p)} className="text-[8px] text-[var(--brand-cyan)] hover:text-white">{p.name}</Button>
                <button onClick={() => onDeletePreset(i)} className="text-neutral-700 hover:text-red-400 p-0.5"><Trash2 size={8} /></button>
              </div>
            ))}
          </div>
        )}
        <Button variant="ghost" size="xs" onClick={onSavePreset} className="text-[9px] text-neutral-500 hover:text-white w-full flex items-center justify-center gap-1">
          <Save size={10} /> Save Current
        </Button>
      </div>

      {/* Obstacle Shape */}
      <div className="p-3 space-y-2 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Obstacle</MicroTitle>
        <div className="grid grid-cols-3 gap-1">
          {OBSTACLE_SHAPES.map(s => (
            <Button key={s.key} variant="ghost" size="xs" onClick={() => update('obstacleType', s.key)} className={`text-[9px] font-medium ${config.obstacleType === s.key ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-white'}`}>{s.label}</Button>
          ))}
        </div>
      </div>

      {/* Image Upload */}
      {config.obstacleType === 'image' && (
        <div className="p-3 space-y-2 border-b border-white/[0.06]">
          <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Image</MicroTitle>
          <input ref={fileInputRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" className="hidden" aria-label="Upload obstacle image" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file); }} />
          {imageName && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-neutral-400 truncate flex-1">{imageName}</span>
              <Button variant="ghost" size="icon-sm" onClick={handleClearImage} className="text-neutral-500 hover:text-white shrink-0" aria-label="Clear image"><X size={10} /></Button>
            </div>
          )}
          <Button variant="ghost" size="xs" onClick={() => fileInputRef.current?.click()} className="text-[9px] text-neutral-500 hover:text-white w-full flex items-center justify-center gap-1">
            <Upload size={10} /> {imageName ? 'Replace' : 'Upload SVG / PNG'}
          </Button>
          <p className="text-[8px] text-neutral-700 text-center">or drag & drop onto canvas</p>
        </div>
      )}

      {/* Text Controls */}
      {config.obstacleType === 'text' && (
        <div className="p-3 space-y-2 border-b border-white/[0.06]">
          <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Text</MicroTitle>
          <Input value={config.text} onChange={(e) => update('text', e.target.value)} placeholder="VISANT" maxLength={24} className="h-7 text-xs bg-transparent border-white/10" aria-label="Obstacle text" />
          <div className="flex items-center gap-1 flex-wrap">
            {FONT_OPTIONS.map(f => (
              <Button key={f} variant="ghost" size="xs" onClick={() => update('fontFamily', f)} className={`text-[8px] px-1.5 ${config.fontFamily === f ? 'text-white bg-white/10' : 'text-neutral-600 hover:text-white'}`} style={{ fontFamily: f }}>{f.split(' ')[0]}</Button>
            ))}
          </div>
          <Button variant="ghost" size="xs" onClick={() => update('bold', !config.bold)} className={`text-[10px] font-bold ${config.bold ? 'text-white bg-white/10' : 'text-neutral-600'}`} aria-label="Toggle bold">B</Button>
        </div>
      )}

      {/* Transform (universal) */}
      <div className="p-3 space-y-2 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Transform</MicroTitle>
        <NodeSlider label="Scale" value={config.obstacleScale} min={10} max={250} step={5} onChange={v => update('obstacleScale', v)} formatValue={v => `${Math.round(v)}%`} />
        <NodeSlider label="X" value={config.obstacleOffsetX} min={-50} max={50} step={1} onChange={v => update('obstacleOffsetX', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Y" value={config.obstacleOffsetY} min={-50} max={50} step={1} onChange={v => update('obstacleOffsetY', v)} formatValue={v => String(Math.round(v))} />
      </div>

      {/* Render Mode */}
      <div className="p-3 space-y-2 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Render</MicroTitle>
        <div className="flex gap-1">
          {RENDER_MODES.map(m => (
            <Button key={m.key} variant="ghost" size="xs" onClick={() => update('renderMode', m.key)} className={`text-[9px] flex-1 ${config.renderMode === m.key ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-white'}`}>{m.label}</Button>
          ))}
        </div>
      </div>

      {/* Color Mode */}
      <div className="p-3 space-y-2 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Color</MicroTitle>
        <div className="grid grid-cols-2 gap-1">
          {COLOR_MODES.map(m => (
            <Button key={m.key} variant="ghost" size="xs" onClick={() => update('colorMode', m.key)} className={`text-[9px] ${config.colorMode === m.key ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-white'}`}>{m.label}</Button>
          ))}
        </div>
        {config.colorMode === 'uniform' && (
          <div className="flex items-center gap-2 pt-1">
            <input type="color" value={rgbaToHex(config.baseColor)} onChange={e => update('baseColor', hexToRgba(e.target.value))} className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded" />
            <span className="text-[9px] text-neutral-500">Particle Color</span>
          </div>
        )}
      </div>

      {/* Simulation Sliders */}
      <div className="p-3 space-y-3 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Simulation</MicroTitle>
        <NodeSlider label="Wind" value={config.windSpeed} min={1} max={100} step={1} onChange={v => update('windSpeed', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Viscosity" value={config.viscosity} min={1} max={100} step={1} onChange={v => update('viscosity', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Particles" value={config.particleCount} min={500} max={15000} step={500} onChange={v => update('particleCount', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Size" value={config.particleSize} min={0.5} max={4} step={0.5} onChange={v => update('particleSize', v)} formatValue={v => v.toFixed(1)} />
        <NodeSlider label="Lifetime" value={config.particleLifetime} min={20} max={300} step={10} onChange={v => update('particleLifetime', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Trail" value={config.trailLength} min={2} max={32} step={2} onChange={v => update('trailLength', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Spread" value={config.spread} min={0} max={100} step={5} onChange={v => update('spread', v)} formatValue={v => String(Math.round(v))} />
      </div>

      {/* Effects */}
      <div className="p-3 space-y-3 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Effects</MicroTitle>
        <NodeSlider label="Glow" value={config.glowIntensity} min={0} max={30} step={1} onChange={v => update('glowIntensity', v)} formatValue={v => String(Math.round(v))} />
        <NodeSlider label="Perspective" value={config.perspective} min={0} max={100} step={1} onChange={v => update('perspective', v)} formatValue={v => String(Math.round(v))} />
      </div>

      {/* Appearance */}
      <div className="p-3 space-y-2 border-b border-white/[0.06]">
        <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Appearance</MicroTitle>
        <div className="flex items-center gap-2">
          <input type="color" value={config.bgColor} onChange={e => update('bgColor', e.target.value)} className="w-6 h-6 rounded border border-white/10 bg-transparent cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded" />
          <span className="text-[9px] text-neutral-500">Background</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500">Show obstacles</span>
          <Button variant="ghost" size="xs" onClick={() => update('showObstacles', !config.showObstacles)} className={`text-[9px] ${config.showObstacles ? 'text-white' : 'text-neutral-600'}`} aria-label="Toggle obstacle visibility">{config.showObstacles ? 'ON' : 'OFF'}</Button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-neutral-500">Grid overlay</span>
          <Button variant="ghost" size="xs" onClick={() => update('showGrid', !config.showGrid)} className={`text-[9px] ${config.showGrid ? 'text-white' : 'text-neutral-600'}`} aria-label="Toggle grid">{config.showGrid ? 'ON' : 'OFF'}</Button>
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        <Button variant="ghost" size="xs" onClick={handleResetSim} className="text-[9px] text-neutral-500 hover:text-white w-full">Restart Simulation</Button>
        <Button variant="ghost" size="xs" onClick={handleReset} className="text-[9px] text-neutral-500 hover:text-white w-full">Reset All</Button>
      </div>

      {/* Shortcuts hint */}
      <div className="p-3 pt-0">
        <p className="text-[8px] text-neutral-700 leading-relaxed">
          Space: pause &middot; P: panel &middot; R: restart &middot; Ctrl+S: export
        </p>
      </div>
    </>
  );
}

export function WindTunnelPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  useEffect(() => { document.title = 'Wind Tunnel — Visant'; }, []);

  const [config, setConfig] = useState<WindTunnelConfig>(DEFAULT_CONFIG);
  const [showPanel, setShowPanel] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [dragging, setDragging] = useState(false);
  const tunnelRef = useRef<WindTunnelHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [userPresets, setUserPresets] = useState<SavedPreset[]>(() => loadUserPresets());

  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(png|svg\+xml|jpeg|webp)$/)) {
      toast.error('Unsupported format. Use PNG, SVG, JPEG, or WebP.');
      return;
    }
    try {
      const img = await loadImageFromFile(file);
      setConfig(prev => ({ ...prev, obstacleType: 'image' as const, obstacleImage: img }));
      setImageName(file.name);
    } catch {
      toast.error('Failed to load image.');
    }
  }, []);

  const handleClearImage = useCallback(() => {
    setConfig(prev => ({ ...prev, obstacleType: 'text' as const, obstacleImage: undefined }));
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

  const update = useCallback(<K extends keyof WindTunnelConfig>(key: K, value: WindTunnelConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => {
    setConfig(prev => ({ ...DEFAULT_CONFIG, obstacleImage: prev.obstacleImage }));
    setImageName(null);
  }, []);

  const handleResetSim = useCallback(() => {
    tunnelRef.current?.resetSimulation();
  }, []);

  const togglePause = useCallback(() => {
    setConfig(prev => ({ ...prev, paused: !prev.paused }));
  }, []);

  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = useCallback((multiplier = 1) => {
    try {
      const handle = tunnelRef.current;
      if (!handle) return;
      const dataUrl = multiplier === 1
        ? handle.getCanvasRef()?.toDataURL('image/png')
        : handle.exportAtResolution(multiplier);
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `wind-tunnel-${multiplier}x-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(`PNG exported at ${multiplier}x.`);
      setShowExportMenu(false);
    } catch {
      toast.error('Export failed.');
    }
  }, []);

  const handleSavePreset = useCallback(() => {
    const name = prompt('Preset name:');
    if (!name?.trim()) return;
    const preset: SavedPreset = { name: name.trim(), config: serializeConfig(config), createdAt: Date.now() };
    const updated = [...userPresets, preset];
    setUserPresets(updated);
    saveUserPresets(updated);
    toast.success(`Preset "${name.trim()}" saved.`);
  }, [config, userPresets]);

  const handleLoadPreset = useCallback((preset: SavedPreset) => {
    setConfig(prev => ({ ...preset.config, obstacleImage: prev.obstacleImage, paused: prev.paused }));
    toast.success(`Loaded "${preset.name}".`);
  }, []);

  const handleDeletePreset = useCallback((idx: number) => {
    const updated = userPresets.filter((_, i) => i !== idx);
    setUserPresets(updated);
    saveUserPresets(updated);
    toast.success('Preset deleted.');
  }, [userPresets]);

  useEffect(() => {
    if (!showExportMenu) return;
    const close = () => setShowExportMenu(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', close); };
  }, [showExportMenu]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      if (e.code === 'KeyP') setShowPanel(p => !p);
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); handleExport(1); }
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) handleResetSim();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePause, handleExport, handleResetSim]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const controlsProps = {
    config, update, imageName, fileInputRef, handleImageUpload, handleClearImage,
    handleResetSim, handleReset, userPresets,
    onSavePreset: handleSavePreset, onLoadPreset: handleLoadPreset, onDeletePreset: handleDeletePreset,
  };

  return (
    <AppShell>
      <div
        className="absolute inset-0"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <WindTunnelCanvas ref={tunnelRef} config={config} onConfigChange={(partial) => setConfig(prev => ({ ...prev, ...partial }))} />
        {dragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 border-2 border-dashed border-[var(--brand-cyan)]/40 pointer-events-none">
            <span className="text-sm text-neutral-400 font-mono">Drop image to use as obstacle</span>
          </div>
        )}
      </div>

      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to Labs" position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => navigate('/labs')} aria-label="Back to Labs">
                <ChevronLeft size={14} />
              </Button>
            </Tooltip>
            <div className="w-px h-4 bg-white/[0.06] mx-1" />
            <MicroTitle>Wind Tunnel</MicroTitle>
          </>
        }
        right={
          <>
            <Tooltip content={config.paused ? 'Resume (Space)' : 'Pause (Space)'} position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={togglePause} aria-label={config.paused ? 'Resume simulation' : 'Pause simulation'}>
                {config.paused ? <Play size={12} /> : <Pause size={12} />}
              </Button>
            </Tooltip>
            <Tooltip content="Restart simulation (R)" position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={handleResetSim} aria-label="Restart simulation">
                <RotateCcw size={12} />
              </Button>
            </Tooltip>
            <div className="relative">
              <Tooltip content="Export PNG (Ctrl+S)" position="bottom">
                <Button variant="surface" size="xs" onClick={() => setShowExportMenu(p => !p)} aria-label="Export PNG">
                  <Download size={12} className="mr-1" /> PNG
                </Button>
              </Tooltip>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-neutral-900/95 backdrop-blur-xl border border-white/[0.08] rounded-lg overflow-hidden z-50 min-w-[120px]">
                  {[1, 2, 4].map(m => (
                    <button key={m} onClick={() => handleExport(m)} className="w-full px-3 py-1.5 text-left text-[10px] text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors">
                      {m}x {m === 1 ? '(Screen)' : m === 2 ? '(2x HD)' : '(4x Print)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Tooltip content={showPanel ? 'Hide panel (P)' : 'Show panel (P)'} position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => setShowPanel(p => !p)} aria-label={showPanel ? 'Hide panel' : 'Show panel'}>
                {showPanel ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
              </Button>
            </Tooltip>
          </>
        }
      />

      {!isMobile && (
        <AppShellPanel visible={showPanel} width={300}>
          <GlassPanel className="h-full overflow-y-auto backdrop-blur-xl bg-neutral-950/80 scrollbar-none rounded-xl">
            <ControlsContent {...controlsProps} />
          </GlassPanel>
        </AppShellPanel>
      )}

      {isMobile && (
        <div className={cn(
          'absolute left-0 right-0 bottom-0 z-20 transition-all duration-300 ease-out',
          mobileSheetOpen ? 'h-[65%]' : 'h-[52px]',
        )}>
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="w-full flex items-center justify-center gap-1 py-2 bg-neutral-900/90 backdrop-blur-xl border-t border-white/[0.06] text-neutral-400"
          >
            {mobileSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span className="text-[10px] uppercase tracking-widest">Controls</span>
          </button>
          {mobileSheetOpen && (
            <div className="h-[calc(100%-36px)] bg-neutral-950/95 backdrop-blur-xl overflow-y-auto scrollbar-none">
              <GlassPanel className="backdrop-blur-xl bg-transparent scrollbar-none">
                <ControlsContent {...controlsProps} />
              </GlassPanel>
            </div>
          )}
        </div>
      )}

      <AppShellStatusBar>
        <span aria-live="polite">{activeCount.toLocaleString()} particles</span>
        <span className="text-neutral-800">|</span>
        <span>{fps} fps</span>
        <span className="text-neutral-800">|</span>
        <span>{config.renderMode}</span>
        <span className="text-neutral-800">|</span>
        <span>{config.colorMode}</span>
        {config.paused && (
          <>
            <span className="text-neutral-800">|</span>
            <span className="text-amber-500">PAUSED</span>
          </>
        )}
      </AppShellStatusBar>
    </AppShell>
  );
}

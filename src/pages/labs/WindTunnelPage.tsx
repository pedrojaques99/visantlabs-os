import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, PanelRightClose, PanelRight, Download, Upload, X, Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { loadImageFromFile } from '@/components/labs/wind-tunnel/ImageObstacles';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
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
};

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

export function WindTunnelPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<WindTunnelConfig>(DEFAULT_CONFIG);
  const [showPanel, setShowPanel] = useState(true);
  const [activeCount, setActiveCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [dragging, setDragging] = useState(false);
  const tunnelRef = useRef<WindTunnelHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageName, setImageName] = useState<string | null>(null);

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
    setConfig(DEFAULT_CONFIG);
    setImageName(null);
  }, []);

  const handleResetSim = useCallback(() => {
    tunnelRef.current?.resetSimulation();
  }, []);

  const togglePause = useCallback(() => {
    setConfig(prev => ({ ...prev, paused: !prev.paused }));
  }, []);

  const handleExport = useCallback(() => {
    try {
      const canvas = tunnelRef.current?.getCanvasRef();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `wind-tunnel-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('PNG exported.');
    } catch {
      toast.error('Export failed.');
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePause(); }
      if (e.code === 'KeyP') setShowPanel(p => !p);
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); handleExport(); }
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) handleResetSim();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePause, handleExport, handleResetSim]);

  // Drag-and-drop on canvas
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  return (
    <AppShell>
      <div
        className="absolute inset-0"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <WindTunnelCanvas ref={tunnelRef} config={config} />
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
            <Tooltip content="Export PNG (Ctrl+S)" position="bottom">
              <Button variant="surface" size="xs" onClick={handleExport} aria-label="Export PNG">
                <Download size={12} className="mr-1" /> PNG
              </Button>
            </Tooltip>
            <Tooltip content={showPanel ? 'Hide panel (P)' : 'Show panel (P)'} position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => setShowPanel(p => !p)} aria-label={showPanel ? 'Hide panel' : 'Show panel'}>
                {showPanel ? <PanelRightClose size={14} /> : <PanelRight size={14} />}
              </Button>
            </Tooltip>
          </>
        }
      />

      <AppShellPanel visible={showPanel} width={232}>
        <GlassPanel className="h-full overflow-y-auto backdrop-blur-xl bg-neutral-950/80 scrollbar-none rounded-xl">

          {/* Obstacle Shape */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Obstacle</MicroTitle>
            <div className="grid grid-cols-3 gap-1">
              {OBSTACLE_SHAPES.map(s => (
                <Button
                  key={s.key}
                  variant="ghost"
                  size="xs"
                  onClick={() => update('obstacleType', s.key)}
                  className={`text-[9px] font-medium ${config.obstacleType === s.key ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-white'}`}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Image Upload (only when obstacle=image) */}
          {config.obstacleType === 'image' && (
            <div className="p-3 space-y-2 border-b border-white/[0.06]">
              <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Image</MicroTitle>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="hidden"
                aria-label="Upload obstacle image"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              {imageName ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-neutral-400 truncate flex-1">{imageName}</span>
                  <Button variant="ghost" size="icon-sm" onClick={handleClearImage} className="text-neutral-500 hover:text-white shrink-0" aria-label="Clear image">
                    <X size={10} />
                  </Button>
                </div>
              ) : null}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
                className="text-[9px] text-neutral-500 hover:text-white w-full flex items-center justify-center gap-1"
              >
                <Upload size={10} /> {imageName ? 'Replace' : 'Upload SVG / PNG'}
              </Button>
              <p className="text-[8px] text-neutral-700 text-center">or drag & drop onto canvas</p>
            </div>
          )}

          {/* Text Controls (only when obstacle=text) */}
          {config.obstacleType === 'text' && (
            <div className="p-3 space-y-2 border-b border-white/[0.06]">
              <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Text</MicroTitle>
              <Input
                value={config.text}
                onChange={(e) => update('text', e.target.value)}
                placeholder="VISANT"
                maxLength={24}
                className="h-7 text-xs bg-transparent border-white/10"
                aria-label="Obstacle text"
              />
              <div className="flex items-center gap-1 flex-wrap">
                {FONT_OPTIONS.map(f => (
                  <Button
                    key={f}
                    variant="ghost"
                    size="xs"
                    onClick={() => update('fontFamily', f)}
                    className={`text-[8px] px-1.5 ${config.fontFamily === f ? 'text-white bg-white/10' : 'text-neutral-600 hover:text-white'}`}
                    style={{ fontFamily: f }}
                  >
                    {f.split(' ')[0]}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => update('bold', !config.bold)}
                className={`text-[10px] font-bold ${config.bold ? 'text-white bg-white/10' : 'text-neutral-600'}`}
                aria-label="Toggle bold"
              >
                B
              </Button>
            </div>
          )}

          {/* Render Mode */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Render</MicroTitle>
            <div className="flex gap-1">
              {RENDER_MODES.map(m => (
                <Button
                  key={m.key}
                  variant="ghost"
                  size="xs"
                  onClick={() => update('renderMode', m.key)}
                  className={`text-[9px] flex-1 ${config.renderMode === m.key ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-white'}`}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Color Mode */}
          <div className="p-3 space-y-2 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Color</MicroTitle>
            <div className="grid grid-cols-2 gap-1">
              {COLOR_MODES.map(m => (
                <Button
                  key={m.key}
                  variant="ghost"
                  size="xs"
                  onClick={() => update('colorMode', m.key)}
                  className={`text-[9px] ${config.colorMode === m.key ? 'text-white bg-white/10' : 'text-neutral-500 hover:text-white'}`}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Simulation Sliders */}
          <div className="p-3 space-y-3 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Simulation</MicroTitle>
            <NodeSlider label="Wind" value={config.windSpeed} min={1} max={100} step={1} onChange={v => update('windSpeed', v)} formatValue={v => String(Math.round(v))} />
            <NodeSlider label="Viscosity" value={config.viscosity} min={1} max={100} step={1} onChange={v => update('viscosity', v)} formatValue={v => String(Math.round(v))} />
            <NodeSlider label="Particles" value={config.particleCount} min={500} max={15000} step={500} onChange={v => update('particleCount', v)} formatValue={v => String(Math.round(v))} />
            <NodeSlider label="Size" value={config.particleSize} min={0.5} max={4} step={0.5} onChange={v => update('particleSize', v)} formatValue={v => v.toFixed(1)} />
          </div>

          {/* 3D Perspective */}
          <div className="p-3 space-y-3 border-b border-white/[0.06]">
            <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">3D</MicroTitle>
            <NodeSlider label="Perspective" value={config.perspective} min={0} max={100} step={1} onChange={v => update('perspective', v)} formatValue={v => String(Math.round(v))} />
          </div>

          {/* Visibility & Actions */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <MicroTitle className="text-neutral-500 text-[10px]">Show obstacles</MicroTitle>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => update('showObstacles', !config.showObstacles)}
                className={`text-[9px] ${config.showObstacles ? 'text-white' : 'text-neutral-600'}`}
                aria-label="Toggle obstacle visibility"
              >
                {config.showObstacles ? 'ON' : 'OFF'}
              </Button>
            </div>
            <Button variant="ghost" size="xs" onClick={handleResetSim} className="text-[9px] text-neutral-500 hover:text-white w-full">
              Restart Simulation
            </Button>
            <Button variant="ghost" size="xs" onClick={handleReset} className="text-[9px] text-neutral-500 hover:text-white w-full">
              Reset All
            </Button>
          </div>

          {/* Shortcuts hint */}
          <div className="p-3 pt-0">
            <p className="text-[8px] text-neutral-700 leading-relaxed">
              Space: pause &middot; P: panel &middot; R: restart &middot; Ctrl+S: export
            </p>
          </div>

        </GlassPanel>
      </AppShellPanel>

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

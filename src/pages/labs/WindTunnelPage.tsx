import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, PanelRightClose, PanelRight, Download } from 'lucide-react';
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
};

const OBSTACLE_SHAPES = [
  { key: 'text', label: 'Text' },
  { key: 'circle', label: 'Circle' },
  { key: 'triangle', label: 'Triangle' },
  { key: 'square', label: 'Square' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'airfoil', label: 'Airfoil' },
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
  const tunnelRef = useRef<WindTunnelHandle>(null);

  useEffect(() => {
    const id = setInterval(() => {
      if (tunnelRef.current) setActiveCount(tunnelRef.current.getActiveCount());
    }, 500);
    return () => clearInterval(id);
  }, []);

  const update = useCallback(<K extends keyof WindTunnelConfig>(key: K, value: WindTunnelConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const handleExport = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `wind-tunnel-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, []);

  return (
    <AppShell>
      <WindTunnelCanvas ref={tunnelRef} config={config} />

      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to Labs" position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => navigate('/labs')}>
                <ChevronLeft size={14} />
              </Button>
            </Tooltip>
            <div className="w-px h-4 bg-white/[0.06] mx-1" />
            <MicroTitle>Wind Tunnel</MicroTitle>
          </>
        }
        right={
          <>
            <Tooltip content="Export PNG" position="bottom">
              <Button variant="surface" size="xs" onClick={handleExport}>
                <Download size={12} className="mr-1" /> PNG
              </Button>
            </Tooltip>
            <Tooltip content={showPanel ? 'Hide panel' : 'Show panel'} position="bottom">
              <Button variant="ghost" size="icon-sm" onClick={() => setShowPanel(p => !p)}>
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

          {/* Text Controls (only when obstacle=text) */}
          {config.obstacleType === 'text' && (
            <div className="p-3 space-y-2 border-b border-white/[0.06]">
              <MicroTitle className="text-neutral-600 uppercase tracking-[0.2em] text-[9px]">Text</MicroTitle>
              <Input
                value={config.text}
                onChange={(e) => update('text', e.target.value)}
                placeholder="VISANT"
                className="h-7 text-xs bg-transparent border-white/10"
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

          {/* Visibility */}
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <MicroTitle className="text-neutral-500 text-[10px]">Show obstacles</MicroTitle>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => update('showObstacles', !config.showObstacles)}
                className={`text-[9px] ${config.showObstacles ? 'text-white' : 'text-neutral-600'}`}
              >
                {config.showObstacles ? 'ON' : 'OFF'}
              </Button>
            </div>
            <Button variant="ghost" size="xs" onClick={handleReset} className="text-[9px] text-neutral-500 hover:text-white w-full">
              Reset All
            </Button>
          </div>

        </GlassPanel>
      </AppShellPanel>

      <AppShellStatusBar>
        <span>{activeCount.toLocaleString()} particles</span>
        <span className="text-neutral-800">|</span>
        <span>{config.renderMode}</span>
        <span className="text-neutral-800">|</span>
        <span>{config.colorMode}</span>
      </AppShellStatusBar>
    </AppShell>
  );
}

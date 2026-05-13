import React, { useCallback, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  useStudio3DStore,
  MATERIAL_PRESETS,
  ANIMATION_PRESETS,
  ENVIRONMENT_PRESETS,
  SCENE_PRESETS,
  ASPECT_RATIOS,
  EXPORT_RESOLUTIONS,
} from '@/stores/studio3dStore';
import {
  Box, Palette, Sun, Play, Download,
  Upload, FileText, Type,
} from 'lucide-react';

const TABS = [
  { id: 'geometry' as const, label: 'Shape', icon: Box },
  { id: 'material' as const, label: 'Material', icon: Palette },
  { id: 'scene' as const, label: 'Scene', icon: Sun },
  { id: 'animation' as const, label: 'Animate', icon: Play },
  { id: 'export' as const, label: 'Export', icon: Download },
] as const;

const COLOR_SWATCHES = [
  '#00e5ff', '#ff00ff', '#ffd700', '#ff6b35', '#8b5cf6',
  '#00ff88', '#ffffff', '#ff3366', '#4a9eff', '#e8ddd3',
];

interface ControlsPanelProps {
  onExport: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({ onExport }) => {
  const store = useStudio3DStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const text = await file.text();
      store.setSvgData(text, file.name);
    } else if (file.type.startsWith('image/')) {
      store.setIsLoading(true);
      try {
        const { pngToSvg } = await import('./PngToSvgConverter');
        const svg = await pngToSvg(file);
        store.setSvgData(svg, file.name);
      } catch {
        console.error('Failed to trace PNG to SVG');
      } finally {
        store.setIsLoading(false);
      }
    }
  }, [store]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  return (
    <GlassPanel className="h-full overflow-hidden flex flex-col">
      {/* Tab Bar */}
      <div className="flex border-b border-white/[0.06] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => store.setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[9px] uppercase tracking-wider transition-colors',
              store.activeTab === tab.id
                ? 'text-cyan-400 border-b border-cyan-400'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
        {store.activeTab === 'geometry' && (
          <>
            {/* Input Mode */}
            <Section title="INPUT">
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => store.setInputMode('svg')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors',
                    store.inputMode === 'svg' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-neutral-500'
                  )}
                >
                  <FileText size={12} /> SVG / PNG
                </button>
                <button
                  onClick={() => store.setInputMode('text')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors',
                    store.inputMode === 'text' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-neutral-500'
                  )}
                >
                  <Type size={12} /> Text
                </button>
              </div>

              {store.inputMode === 'svg' ? (
                <div
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 border border-dashed rounded-lg cursor-pointer transition-all',
                    isDragging
                      ? 'border-cyan-400 bg-cyan-500/10 scale-[1.02]'
                      : 'border-white/10 hover:border-cyan-500/30'
                  )}
                >
                  <Upload size={20} className={cn('transition-colors', isDragging ? 'text-cyan-400' : 'text-neutral-500')} />
                  <span className={cn('text-[10px] uppercase tracking-wider transition-colors text-center', isDragging ? 'text-cyan-400' : 'text-neutral-500')}>
                    {store.isLoading ? 'Processing...' : store.fileName || 'Click or drop SVG / PNG'}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg,.webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={store.text}
                  onChange={(e) => store.setText(e.target.value)}
                  placeholder="Type your text..."
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/30"
                />
              )}
            </Section>

            {/* Geometry */}
            <Section title="GEOMETRY">
              <NodeSlider label="Depth" value={store.depth} min={0.5} max={10} step={0.1} onChange={store.setDepth} />
              <NodeSlider label="Smoothness" value={store.smoothness} min={0} max={5} step={0.1} onChange={store.setSmoothness} />
            </Section>

            {/* Scene Presets */}
            <Section title="SCENE PRESETS">
              <div className="grid grid-cols-2 gap-1">
                {Object.keys(SCENE_PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => store.applyScenePreset(name)}
                    className="px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors text-left"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {store.activeTab === 'material' && (
          <>
            <Section title="PRESET">
              <div className="grid grid-cols-2 gap-1">
                {MATERIAL_PRESETS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => store.setMaterial(m.id)}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                      store.material === m.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="COLOR">
              <div className="flex gap-1 flex-wrap mb-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => store.setColor(c)}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                      store.color === c ? 'border-white scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={store.color}
                onChange={(e) => store.setColor(e.target.value)}
                className="w-full h-6 rounded cursor-pointer bg-transparent"
              />
            </Section>

            <Section title="PROPERTIES">
              <NodeSlider label="Metalness" value={store.metalness} min={0} max={1} step={0.01} onChange={store.setMetalness} />
              <NodeSlider label="Roughness" value={store.roughness} min={0} max={1} step={0.01} onChange={store.setRoughness} />
              <NodeSlider label="Opacity" value={store.opacity} min={0} max={1} step={0.01} onChange={store.setOpacity} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Wireframe</span>
                <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} />
              </div>
            </Section>
          </>
        )}

        {store.activeTab === 'scene' && (
          <>
            <Section title="ENVIRONMENT">
              <div className="grid grid-cols-2 gap-1">
                {ENVIRONMENT_PRESETS.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => store.setEnvironment(env.id)}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                      store.environment === env.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="LIGHTING">
              <NodeSlider label="Key Light" value={store.lightIntensity} min={0} max={3} step={0.05} onChange={store.setLightIntensity} />
              <NodeSlider label="Ambient" value={store.ambientIntensity} min={0} max={2} step={0.05} onChange={store.setAmbientIntensity} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Shadows</span>
                <Switch checked={store.shadow} onCheckedChange={store.setShadow} />
              </div>
            </Section>

            <Section title="BACKGROUND">
              <input
                type="color"
                value={store.background}
                onChange={(e) => store.setBackground(e.target.value)}
                className="w-full h-6 rounded cursor-pointer bg-transparent"
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Transparent</span>
                <Switch checked={store.transparentBg} onCheckedChange={store.setTransparentBg} />
              </div>
            </Section>
          </>
        )}

        {store.activeTab === 'animation' && (
          <>
            <Section title="TYPE">
              <div className="grid grid-cols-2 gap-1">
                {ANIMATION_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => store.setAnimate(a.id)}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                      store.animate === a.id
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="CONTROLS">
              <NodeSlider label="Speed" value={store.animateSpeed} min={0.1} max={5} step={0.1} onChange={store.setAnimateSpeed} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Reverse</span>
                <Switch checked={store.animateReverse} onCheckedChange={store.setAnimateReverse} />
              </div>
            </Section>
          </>
        )}

        {store.activeTab === 'export' && (
          <>
            <Section title="FORMAT">
              <div className="grid grid-cols-3 gap-1">
                {(['png', 'mp4', 'gif'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => store.setExportFormat(f)}
                    className={cn(
                      'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                      store.exportFormat === f
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="ASPECT RATIO">
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(ASPECT_RATIOS) as Array<keyof typeof ASPECT_RATIOS>).map((r) => (
                  <button
                    key={r}
                    onClick={() => store.setAspectRatio(r)}
                    className={cn(
                      'px-1 py-1.5 rounded text-[10px] tracking-wider transition-colors text-center',
                      store.aspectRatio === r
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </Section>

            {store.exportFormat === 'png' && (
              <Section title="RESOLUTION">
                <div className="grid grid-cols-3 gap-1">
                  {EXPORT_RESOLUTIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => store.setExportResolution(r.id)}
                      className={cn(
                        'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                        store.exportResolution === r.id
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {(store.exportFormat === 'mp4' || store.exportFormat === 'gif') && (
              <Section title="VIDEO">
                <NodeSlider label="Duration (s)" value={store.videoDuration} min={1} max={10} step={0.5} onChange={store.setVideoDuration} />
              </Section>
            )}

            <Button
              onClick={onExport}
              disabled={store.isExporting || (!store.svgData && !store.text)}
              className="w-full mt-2 bg-cyan-500 hover:bg-cyan-600 text-black font-medium"
            >
              {store.isExporting ? 'Exporting...' : `Export ${store.exportFormat.toUpperCase()}`}
            </Button>
          </>
        )}
      </div>
    </GlassPanel>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    <MicroTitle>{title}</MicroTitle>
    {children}
  </div>
);

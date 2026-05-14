import React, { useCallback, useState, useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeSlider } from '@/components/reactflow/shared/node-slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
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
  Upload, FileText, Type, ChevronRight, Diamond,
} from 'lucide-react';
import { ShaderControls } from '@/components/shared/ShaderControls';
import { setCameraView, resetCamera } from './CameraBridge';

const TABS = [
  { id: 'geometry' as const, label: 'Shape', icon: Box },
  { id: 'material' as const, label: 'Material', icon: Palette },
  { id: 'scene' as const, label: 'Scene', icon: Sun },
  { id: 'animation' as const, label: 'Animate', icon: Play },
  { id: 'shader' as const, label: 'Shader', icon: Diamond },
  { id: 'export' as const, label: 'Export', icon: Download },
] as const;

const FONT_OPTIONS = [
  'DM Sans', 'Bebas Neue', 'Playfair Display', 'Righteous', 'Black Ops One',
  'Permanent Marker', 'Rubik Mono One', 'Pacifico', 'Oswald', 'Archivo Black',
];

const COLOR_SWATCHES = [
  '#00e5ff', '#ff00ff', '#ffd700', '#ff6b35', '#8b5cf6',
  '#00ff88', '#ffffff', '#ff3366', '#4a9eff', '#e8ddd3',
];

interface ControlsPanelProps {
  onExport: () => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = React.memo(({ onExport }) => {
  const store = useStudio3DStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [depth, setDepth] = useDebouncedSlider(store.depth, store.setDepth);
  const [smoothness, setSmoothness] = useDebouncedSlider(store.smoothness, store.setSmoothness);
  const [metalness, setMetalness] = useDebouncedSlider(store.metalness, store.setMetalness);
  const [roughness, setRoughness] = useDebouncedSlider(store.roughness, store.setRoughness);
  const [opacity, setOpacity] = useDebouncedSlider(store.opacity, store.setOpacity);
  const [lightIntensity, setLightIntensity] = useDebouncedSlider(store.lightIntensity, store.setLightIntensity);
  const [ambientIntensity, setAmbientIntensity] = useDebouncedSlider(store.ambientIntensity, store.setAmbientIntensity);
  const [animateSpeed, setAnimateSpeed] = useDebouncedSlider(store.animateSpeed, store.setAnimateSpeed);
  const [videoDuration, setVideoDuration] = useDebouncedSlider(store.videoDuration, store.setVideoDuration);

  const processFile = useCallback(async (file: File) => {
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const text = await file.text();
      store.setSvgData(text, file.name);
      toast.success(`Loaded ${file.name}`);
    } else if (file.type.startsWith('image/')) {
      store.setIsLoading(true);
      try {
        const { pngToSvg } = await import('./PngToSvgConverter');
        const svg = await pngToSvg(file);
        store.setSvgData(svg, file.name);
        toast.success(`Converted ${file.name} to SVG`);
      } catch {
        toast.error('Failed to process image');
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
                ? 'text-white border-b border-white/40'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
        {store.activeTab === 'geometry' && (
          <>
            {/* Input Mode */}
            <Section title="INPUT">
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => store.setInputMode('svg')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors',
                    store.inputMode === 'svg' ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-500'
                  )}
                >
                  <FileText size={12} /> SVG / PNG
                </button>
                <button
                  onClick={() => store.setInputMode('text')}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors',
                    store.inputMode === 'text' ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-500'
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
                      ? 'border-white/30 bg-white/5 scale-[1.02]'
                      : 'border-white/10 hover:border-white/20'
                  )}
                >
                  <Upload size={20} className={cn('transition-colors', isDragging ? 'text-white' : 'text-neutral-500')} />
                  <span className={cn('text-[10px] uppercase tracking-wider transition-colors text-center', isDragging ? 'text-white' : 'text-neutral-500')}>
                    {store.isLoading ? <GlitchLoader size={12} /> : store.fileName || 'Click or drop SVG / PNG'}
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
                <div className="space-y-2">
                  <input
                    type="text"
                    value={store.text}
                    onChange={(e) => store.setText(e.target.value)}
                    placeholder="Type your text..."
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
                  />
                  <select
                    value={store.font}
                    onChange={(e) => store.setFont(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f} className="bg-neutral-900">{f}</option>
                    ))}
                  </select>
                </div>
              )}
            </Section>

            {/* Geometry */}
            <Section title="GEOMETRY">
              <NodeSlider label="Depth" value={depth} min={0.5} max={10} step={0.1} onChange={setDepth} />
              <Disclosure label="Advanced">
                <NodeSlider label="Smoothness" value={smoothness} min={0} max={5} step={0.1} onChange={setSmoothness} />
              </Disclosure>
            </Section>

            {/* Scene Presets */}
            <Section title="SCENE PRESETS">
              <div className="grid grid-cols-2 gap-1.5">
                {Object.keys(SCENE_PRESETS).map((name) => (
                  <button
                    key={name}
                    onClick={() => store.applyScenePreset(name)}
                    className="px-2.5 py-2 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors text-left"
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
              {(['basic', 'metals', 'surfaces', 'glass', 'special'] as const).map((cat) => {
                const items = MATERIAL_PRESETS.filter((m) => m.category === cat);
                if (items.length === 0) return null;
                const catLabels = { basic: 'Basic', metals: 'Metals', surfaces: 'Surfaces', glass: 'Glass & Gem', special: 'Special' };
                return (
                  <div key={cat} className="mb-2">
                    <p className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">{catLabels[cat]}</p>
                    <div className="grid grid-cols-2 gap-1">
                      {items.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            store.setMaterial(m.id);
                          }}
                          className={cn(
                            'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-left flex items-center gap-1.5',
                            store.material === m.id
                              ? 'bg-white/10 text-white'
                              : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                          )}
                        >
                          {m.color && (
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10"
                              style={{ backgroundColor: m.color }}
                            />
                          )}
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
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
              <NodeSlider label="Metalness" value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} />
              <NodeSlider label="Roughness" value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} />
              <Disclosure label="Advanced">
                <NodeSlider label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Wireframe</span>
                  <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} />
                </div>
              </Disclosure>
            </Section>
          </>
        )}

        {store.activeTab === 'scene' && (
          <>
            <Section title="ENVIRONMENT">
              <div className="grid grid-cols-2 gap-1.5">
                {ENVIRONMENT_PRESETS.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => store.setEnvironment(env.id)}
                    className={cn(
                      'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                      store.environment === env.id
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="LIGHTING">
              <NodeSlider label="Key Light" value={lightIntensity} min={0} max={3} step={0.05} onChange={setLightIntensity} />
              <NodeSlider label="Ambient" value={ambientIntensity} min={0} max={2} step={0.05} onChange={setAmbientIntensity} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Shadows</span>
                <Switch checked={store.shadow} onCheckedChange={store.setShadow} />
              </div>
            </Section>

            <Section title="CAMERA">
              <div className="grid grid-cols-3 gap-1.5">
                {(['front', 'top', 'right', 'back', 'iso'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setCameraView(view)}
                    className={cn(
                      'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                      store._cameraInfo?.view === view
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200'
                    )}
                  >
                    {view}
                  </button>
                ))}
                <button
                  onClick={() => resetCamera()}
                  className="px-2.5 py-2 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors text-center"
                >
                  Reset
                </button>
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
              <div className="grid grid-cols-2 gap-1.5">
                {ANIMATION_PRESETS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => store.setAnimate(a.id)}
                    className={cn(
                      'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-left',
                      store.animate === a.id
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="CONTROLS">
              <NodeSlider label="Speed" value={animateSpeed} min={0.1} max={5} step={0.1} onChange={setAnimateSpeed} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Reverse</span>
                <Switch checked={store.animateReverse} onCheckedChange={store.setAnimateReverse} />
              </div>
            </Section>
          </>
        )}

        {store.activeTab === 'shader' && (
          <ShaderControls
            enabled={store.shaderEnabled}
            shaderType={store.shaderType}
            values={store.shaderValues}
            onEnabledChange={store.setShaderEnabled}
            onTypeChange={store.setShaderType}
            onValueChange={store.setShaderValue}
          />
        )}

        {store.activeTab === 'export' && (
          <>
            {store.shaderEnabled && (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-400 uppercase tracking-wider">
                <Diamond size={12} />
                {store.shaderType} shader will be applied
              </div>
            )}
            <Section title="FORMAT">
              <div className="grid grid-cols-3 gap-1.5">
                {(['png', 'mp4', 'gif'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => store.setExportFormat(f)}
                    className={cn(
                      'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                      store.exportFormat === f
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="ASPECT RATIO">
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(ASPECT_RATIOS) as Array<keyof typeof ASPECT_RATIOS>).map((r) => (
                  <button
                    key={r}
                    onClick={() => store.setAspectRatio(r)}
                    className={cn(
                      'px-1 py-1.5 rounded text-[10px] tracking-wider transition-colors text-center',
                      store.aspectRatio === r
                        ? 'bg-white/10 text-white'
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
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPORT_RESOLUTIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => store.setExportResolution(r.id)}
                      className={cn(
                        'px-2.5 py-2 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                        store.exportResolution === r.id
                          ? 'bg-white/10 text-white'
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
                <NodeSlider label="Duration (s)" value={videoDuration} min={1} max={10} step={0.5} onChange={setVideoDuration} />
              </Section>
            )}

            <Button
              onClick={onExport}
              disabled={store.isExporting || (!store.svgData && !store.text)}
              className="w-full mt-2 bg-white hover:bg-neutral-200 text-black font-medium"
            >
              {store.isExporting ? 'Exporting...' : `Export ${store.exportFormat.toUpperCase()}`}
            </Button>
          </>
        )}
      </div>
    </GlassPanel>
  );
});

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <MicroTitle>{title}</MicroTitle>
    {children}
  </div>
);

const Disclosure: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[9px] text-neutral-600 uppercase tracking-widest hover:text-neutral-400 transition-colors py-1"
      >
        <ChevronRight size={10} className={cn('transition-transform', open && 'rotate-90')} />
        {label}
      </button>
      {open && <div className="space-y-3 pt-1">{children}</div>}
    </div>
  );
};

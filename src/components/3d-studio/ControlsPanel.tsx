import React, { useCallback, useState, useRef, useMemo } from 'react';
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

const MATERIAL_CATEGORIES = ['basic', 'metals', 'surfaces', 'glass', 'special'] as const;
const MATERIAL_CAT_LABELS: Record<string, string> = {
  basic: 'Basic', metals: 'Metals', surfaces: 'Surfaces', glass: 'Glass & Gem', special: 'Special',
};

const TABS = [
  { id: 'geometry' as const, label: 'Shape', icon: Box },
  { id: 'material' as const, label: 'Material', icon: Palette },
  { id: 'scene' as const, label: 'Scene', icon: Sun },
  { id: 'animation' as const, label: 'Animate', icon: Play },
  { id: 'shader' as const, label: 'Shader', icon: Diamond },
] as const;

const FONT_OPTIONS = [
  'DM Sans', 'Bebas Neue', 'Playfair Display', 'Righteous', 'Black Ops One',
  'Permanent Marker', 'Rubik Mono One', 'Pacifico', 'Oswald', 'Archivo Black',
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
              <NodeSlider label="Bevel" value={smoothness} min={0} max={8} step={0.1} onChange={setSmoothness} />
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
          <MaterialTab
            store={store}
            metalness={metalness} setMetalness={setMetalness}
            roughness={roughness} setRoughness={setRoughness}
            opacity={opacity} setOpacity={setOpacity}
          />
        )}

        {store.activeTab === 'scene' && (
          <>
            <Section title="LIGHTING">
              <NodeSlider label="Key Light" value={lightIntensity} min={0} max={3} step={0.05} onChange={setLightIntensity} />
              <NodeSlider label="Ambient" value={ambientIntensity} min={0} max={2} step={0.05} onChange={setAmbientIntensity} />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Shadows</span>
                <Switch checked={store.shadow} onCheckedChange={store.setShadow} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Grid</span>
                <Switch checked={store.showGrid} onCheckedChange={store.setShowGrid} />
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

      </div>

      {/* ── Export Panel (collapsible, pinned bottom) ─────────── */}
      <ExportPanel store={store} videoDuration={videoDuration} setVideoDuration={setVideoDuration} onExport={onExport} />
    </GlassPanel>
  );
});

/* ── Export Panel (collapsible, Adobe-style) ───────────────── */

const ExportPanel: React.FC<{
  store: StoreState;
  videoDuration: number;
  setVideoDuration: (v: number) => void;
  onExport: () => void;
}> = React.memo(({ store, videoDuration, setVideoDuration, onExport }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="shrink-0 border-t border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Download size={12} className="text-neutral-500" />
          <span className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">Export</span>
        </div>
        <ChevronRight size={10} className={cn('text-neutral-600 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {store.shaderEnabled && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-[9px] text-cyan-400 uppercase tracking-wider">
              <Diamond size={10} />
              {store.shaderType} shader active
            </div>
          )}

          <div className="grid grid-cols-5 gap-1">
            {(['png', 'mp4', 'gif', 'glb', 'obj'] as const).map((f) => (
              <button
                key={f}
                onClick={() => store.setExportFormat(f)}
                className={cn(
                  'py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                  store.exportFormat === f ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {store.exportFormat !== 'glb' && store.exportFormat !== 'obj' && (
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(ASPECT_RATIOS) as Array<keyof typeof ASPECT_RATIOS>).map((r) => (
                <button
                  key={r}
                  onClick={() => store.setAspectRatio(r)}
                  className={cn(
                    'py-1 rounded text-[10px] tracking-wider transition-colors text-center',
                    store.aspectRatio === r ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {(store.exportFormat === 'glb' || store.exportFormat === 'obj') && (
            <div className="px-2 py-1.5 rounded bg-white/5 text-[9px] text-neutral-400 uppercase tracking-wider">
              {store.exportFormat === 'glb' ? '3D model with materials' : 'Geometry only (no materials)'}
            </div>
          )}

          {store.exportFormat === 'png' && (
            <div className="grid grid-cols-3 gap-1">
              {EXPORT_RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => store.setExportResolution(r.id)}
                  className={cn(
                    'py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors text-center',
                    store.exportResolution === r.id ? 'bg-white/10 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {(store.exportFormat === 'mp4' || store.exportFormat === 'gif') && (
            <div className="space-y-2">
              <NodeSlider label="Duration (s)" value={videoDuration} min={1} max={10} step={0.5} onChange={setVideoDuration} />
              {store.animate !== 'none' && (() => {
                const loopPeriod = Math.round((2 * Math.PI / store.animateSpeed) * 2) / 2;
                const clamped = Math.min(Math.max(loopPeriod, 1), 10);
                return (
                  <button
                    onClick={() => setVideoDuration(clamped)}
                    className={cn(
                      'w-full py-1 rounded text-[9px] uppercase tracking-wider transition-colors',
                      videoDuration === clamped
                        ? 'bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    Perfect Loop — {clamped}s
                  </button>
                );
              })()}
            </div>
          )}

          <Button
            onClick={onExport}
            disabled={store.isExporting}
            className="w-full bg-white hover:bg-neutral-200 text-black font-medium text-xs"
          >
            {store.isExporting ? 'Exporting...' : `Export ${store.exportFormat.toUpperCase()}`}
          </Button>
        </div>
      )}
    </div>
  );
});

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <MicroTitle>{title}</MicroTitle>
    {children}
  </div>
);

const Disclosure: React.FC<{ label: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ label, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
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

/* ── Material Tab ─────────────────────────────────────────── */

type StoreState = ReturnType<typeof useStudio3DStore.getState>;

interface MaterialTabProps {
  store: StoreState;
  metalness: number; setMetalness: (v: number) => void;
  roughness: number; setRoughness: (v: number) => void;
  opacity: number; setOpacity: (v: number) => void;
}

const MaterialTab: React.FC<MaterialTabProps> = React.memo(({
  store, metalness, setMetalness, roughness, setRoughness, opacity, setOpacity,
}) => {
  const activeCat = useMemo(
    () => MATERIAL_PRESETS.find((m) => m.id === store.material)?.category ?? 'basic',
    [store.material],
  );

  return (
    <>
      {/* Category chips + preset grid */}
      <Section title="MATERIAL">
        <MaterialCategoryTabs activeCat={activeCat} store={store} />
      </Section>

      {/* Color — hex input + picker */}
      <Section title="COLOR">
        <div className="flex items-center gap-2">
          <label className="relative w-8 h-8 rounded cursor-pointer flex-shrink-0 border border-white/10 overflow-hidden">
            <span className="absolute inset-0" style={{ backgroundColor: store.color }} />
            <input
              type="color"
              value={store.color}
              onChange={(e) => store.setColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5">
            <span className="text-[10px] text-neutral-500 mr-1">#</span>
            <input
              type="text"
              value={store.color.replace('#', '').toUpperCase()}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                if (v.length === 6) store.setColor(`#${v}`);
              }}
              onBlur={(e) => {
                const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                if (v.length === 6) store.setColor(`#${v}`);
              }}
              maxLength={6}
              className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
              placeholder="00E5FF"
            />
          </div>
        </div>
      </Section>

      {/* Texture */}
      <Section title="TEXTURE">
        <TextureControls store={store} />
      </Section>

      {/* Properties — flat, no disclosure */}
      <Section title="PROPERTIES">
        <NodeSlider label="Metalness" value={metalness} min={0} max={1} step={0.01} onChange={setMetalness} />
        <NodeSlider label="Roughness" value={roughness} min={0} max={1} step={0.01} onChange={setRoughness} />
        <NodeSlider label="Opacity" value={opacity} min={0} max={1} step={0.01} onChange={setOpacity} />
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Wireframe</span>
          <Switch checked={store.wireframe} onCheckedChange={store.setWireframe} />
        </div>
      </Section>
    </>
  );
});

const MaterialCategoryTabs: React.FC<{
  activeCat: string;
  store: StoreState;
}> = React.memo(({ activeCat, store }) => {
  const [openCat, setOpenCat] = useState(activeCat);

  const handleCat = useCallback((cat: string) => {
    setOpenCat((prev) => (prev === cat ? '' : cat));
  }, []);

  return (
    <div className="space-y-1.5">
      {/* Category pills */}
      <div className="flex gap-1 flex-wrap">
        {MATERIAL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCat(cat)}
            className={cn(
              'px-2 py-0.5 rounded-full text-[9px] uppercase tracking-widest transition-colors',
              openCat === cat
                ? 'bg-white/12 text-white'
                : 'bg-white/5 text-neutral-500 hover:text-neutral-300'
            )}
          >
            {MATERIAL_CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Active category grid */}
      {openCat && (
        <div className="grid grid-cols-3 gap-1">
          {MATERIAL_PRESETS.filter((m) => m.category === openCat).map((m) => (
            <button
              key={m.id}
              onClick={() => store.setMaterial(m.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-1.5 px-1 rounded transition-colors',
                store.material === m.id
                  ? 'bg-white/10 text-white'
                  : 'bg-white/[0.03] text-neutral-500 hover:bg-white/[0.07] hover:text-neutral-300'
              )}
            >
              <span
                className={cn(
                  'w-5 h-5 rounded-full border flex-shrink-0',
                  store.material === m.id ? 'border-white/40' : 'border-white/10'
                )}
                style={{ backgroundColor: m.color || '#666' }}
              />
              <span className="text-[8px] uppercase tracking-wider leading-tight text-center truncate w-full">
                {m.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

/* ── Procedural textures ──────────────────────────────────── */

function makeCanvas(size: number) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  return { canvas: c, ctx: c.getContext('2d')! };
}

function perlinNoise(ctx: CanvasRenderingContext2D, size: number, scale: number, intensity: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / scale, ny = y / scale;
      const v1 = Math.sin(nx * 1.2 + ny * 0.8) * 0.5;
      const v2 = Math.sin(nx * 2.5 - ny * 1.7) * 0.25;
      const v3 = Math.sin(nx * 5.1 + ny * 4.3) * 0.125;
      const fine = (Math.random() - 0.5) * 0.3;
      const n = (v1 + v2 + v3 + fine) * intensity;
      const base = d[i];
      const v = Math.max(0, Math.min(255, base + n * 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function generateGrainTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 80, 0.6);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const fine = (Math.random() - 0.5) * 40;
    d[i] = Math.max(0, Math.min(255, d[i] + fine));
    d[i + 1] = d[i + 2] = d[i];
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

function generateScratchTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  for (let layer = 0; layer < 3; layer++) {
    const count = [400, 200, 80][layer];
    const alpha = [0.12, 0.2, 0.35][layer];
    const width = [0.3, 0.6, 1.0][layer];
    const maxLen = [40, 80, 120][layer];
    ctx.lineWidth = width;
    for (let i = 0; i < count; i++) {
      const bright = 128 + (Math.random() - 0.5) * 80;
      ctx.strokeStyle = `rgba(${bright},${bright},${bright},${alpha})`;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 5 + Math.random() * maxLen;
      const angle = (Math.random() - 0.5) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segments = 3 + Math.floor(Math.random() * 4);
      let cx = x, cy = y;
      for (let s = 0; s < segments; s++) {
        const drift = (Math.random() - 0.5) * 4;
        cx += Math.cos(angle) * (len / segments);
        cy += Math.sin(angle) * (len / segments) + drift;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  return canvas.toDataURL('image/png');
}

function generateNoiseTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 40, 1.0);
  return canvas.toDataURL('image/png');
}

function generateStuccoTexture(size = 1024): string {
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  perlinNoise(ctx, size, 60, 0.8);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    const bright = 100 + Math.random() * 60;
    ctx.fillStyle = `rgba(${bright},${bright},${bright},0.15)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}

const PROCEDURAL_TEXTURES = [
  { id: 'grain', label: 'Grain', generate: generateGrainTexture },
  { id: 'scratch', label: 'Scratch', generate: generateScratchTexture },
  { id: 'noise', label: 'Noise', generate: generateNoiseTexture },
  { id: 'stucco', label: 'Stucco', generate: generateStuccoTexture },
] as const;

/* ── Texture Controls ─────────────────────────────────────── */

const TextureControls: React.FC<{ store: StoreState }> = React.memo(({ store }) => {
  const textureInputRef = useRef<HTMLInputElement>(null);
  const [activeProc, setActiveProc] = useState<string | null>(null);

  const handleTextureUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    store.setTexture(url);
    setActiveProc(null);
    e.target.value = '';
  }, [store]);

  const applyProcedural = useCallback((pt: typeof PROCEDURAL_TEXTURES[number]) => {
    store.setTexture(pt.generate());
    setActiveProc(pt.id);
  }, [store]);

  const hasTexture = !!store.texture;

  return (
    <div className="space-y-2">
      {/* Procedural presets */}
      <div className="grid grid-cols-2 gap-1">
        {PROCEDURAL_TEXTURES.map((pt) => (
          <button
            key={pt.id}
            onClick={() => applyProcedural(pt)}
            className={cn(
              'px-2 py-1.5 rounded text-[10px] uppercase tracking-wider transition-colors',
              activeProc === pt.id
                ? 'bg-white/10 text-white'
                : 'bg-white/[0.03] text-neutral-500 hover:bg-white/[0.07] hover:text-neutral-300'
            )}
          >
            {pt.label}
          </button>
        ))}
      </div>

      {/* Upload */}
      <button
        onClick={() => textureInputRef.current?.click()}
        className="w-full px-2 py-1.5 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
      >
        Upload Image
      </button>
      <input
        ref={textureInputRef}
        type="file"
        accept="image/*"
        onChange={handleTextureUpload}
        className="hidden"
      />

      {/* Controls when texture active */}
      {hasTexture && (
        <>
          <NodeSlider label="Repeat" value={store.textureRepeat} min={0.5} max={10} step={0.5} onChange={store.setTextureRepeat} />
          {activeProc && (
            <button
              onClick={() => applyProcedural(PROCEDURAL_TEXTURES.find(p => p.id === activeProc)!)}
              className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Regenerate
            </button>
          )}
          <button
            onClick={() => { store.setTexture(''); setActiveProc(null); }}
            className="w-full py-1 rounded text-[10px] uppercase tracking-wider text-neutral-600 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
});

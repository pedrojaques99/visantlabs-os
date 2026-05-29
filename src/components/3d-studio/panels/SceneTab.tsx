import React, { useCallback, useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useDebouncedSlider } from '@/hooks/useDebouncedSlider';
import { useTranslation } from '@/hooks/useTranslation';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  useStudio3DStore,
  SCENE_PRESETS,
  getSavedScenes,
  saveScene,
  loadScene,
  deleteScene,
  getPublicScenes,
  forkScene,
  type SavedScene,
  type PublicScene,
} from '@/stores/studio3dStore';
import {
  Upload, FileText, Type, Box, Film, Save, FolderOpen, Trash2, Shuffle, Link, Palette, Globe, GitFork,
} from 'lucide-react';
import {
  ToolPanelSection, ToolPanelDisclosure, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { HexColorPicker } from 'react-colorful';
import { FONT_OPTIONS } from './_shared';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandLogoPickerModal } from '../BrandLogoPickerModal';
import { usePresetPreviews } from '../usePresetPreviews';

export const SceneTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const store = useStudio3DStore();
  const [isDragging, setIsDragging] = useState(false);
  const [hasRandomizedOnce, setHasRandomizedOnce] = useState(false);
  const [showRandomizeConfirm, setShowRandomizeConfirm] = useState(false);
  const [chainColorPickerOpen, setChainColorPickerOpen] = useState(false);
  const [shapeColorPickerOpen, setShapeColorPickerOpen] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const lastPngFile = useRef<File | null>(null);
  const [isRetracing, setIsRetracing] = useState(false);

  const [depth, setDepth] = useDebouncedSlider(store.depth, store.setDepth);
  const [objectScale, setObjectScale] = useDebouncedSlider(store.objectScale, store.setObjectScale);
  const [smoothness, setSmoothness] = useDebouncedSlider(store.smoothness, store.setSmoothness);
  const [bevelThickness, setBevelThickness] = useDebouncedSlider(store.bevelThickness, store.setBevelThickness);
  const [bevelSize, setBevelSize] = useDebouncedSlider(store.bevelSize, store.setBevelSize);
  const [coinRadius, setCoinRadius] = useDebouncedSlider(store.coinRadius, store.setCoinRadius);
  const [badgeW, setBadgeW] = useDebouncedSlider(store.badgeWidth, store.setBadgeWidth);
  const [badgeH, setBadgeH] = useDebouncedSlider(store.badgeHeight, store.setBadgeHeight);
  const [badgeR, setBadgeR] = useDebouncedSlider(store.badgeRadius, store.setBadgeRadius);
  const [sRadius, setSRadius] = useDebouncedSlider(store.stampRadius, store.setStampRadius);
  const [sTeeth, setSTeeth] = useDebouncedSlider(store.stampTeeth, store.setStampTeeth);
  const [sTooth, setSTooth] = useDebouncedSlider(store.stampToothDepth, store.setStampToothDepth);
  const [shieldW, setShieldW] = useDebouncedSlider(store.shieldWidth, store.setShieldWidth);
  const [shieldH, setShieldH] = useDebouncedSlider(store.shieldHeight, store.setShieldHeight);
  const [hexR, setHexR] = useDebouncedSlider(store.hexRadius, store.setHexRadius);
  const [chainLinks, setChainLinks] = useDebouncedSlider(store.chainLinks, store.setChainLinks);
  const [chainScale, setChainScale] = useDebouncedSlider(store.chainScale, store.setChainScale);
  const [bailSz, setBailSz] = useDebouncedSlider(store.bailSize, store.setBailSize);
  const [bailOff, setBailOff] = useDebouncedSlider(store.bailOffset, store.setBailOffset);
  const [chainOff, setChainOff] = useDebouncedSlider(store.chainOffset, store.setChainOffset);
  const [reliefDepth, setReliefDepth] = useDebouncedSlider(store.reliefDepth, store.setReliefDepth);

  const presetThumbs = usePresetPreviews();
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const { data: brandGuidelines = [], isLoading: brandLoading } = useBrandGuidelines(true);
  const hasBrandLogos = brandGuidelines.some(g => g.logos && g.logos.length > 0);

  const [savedScenes, setSavedScenes] = useState<SavedScene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [sceneName, setSceneName] = useState(store._sceneName || '');

  useEffect(() => {
    setScenesLoading(true);
    getSavedScenes().then(scenes => {
      setSavedScenes(scenes);
      setScenesLoading(false);
    });
  }, []);

  const handleModelUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    store.setModelUrl(url, file.name);
    toast.success(t('studio3d.input.loaded', { fileName: file.name }));
    e.target.value = '';
  }, [store, t]);

  const processFile = useCallback(async (file: File) => {
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      lastPngFile.current = null;
      const text = await file.text();
      store.setSvgData(text, file.name);
      toast.success(t('studio3d.input.loaded', { fileName: file.name }));
    } else if (file.type.startsWith('image/')) {
      lastPngFile.current = file;
      store.setIsLoading(true);
      try {
        const { pngToSvg } = await import('../PngToSvgConverter');
        const s = useStudio3DStore.getState();
        const svg = await pngToSvg(file, {
          turdSize: s.traceTurdSize,
          optTolerance: s.traceOptTolerance,
          threshold: s.traceThreshold,
        });
        store.setSvgData(svg, file.name);
        toast.success(t('studio3d.input.converted', { fileName: file.name }));
      } catch (err) {
        console.error('PNG→SVG conversion failed:', err);
        toast.error(t('studio3d.input.processFailed'));
      } finally {
        store.setIsLoading(false);
      }
    }
  }, [store, t]);

  const handleRetrace = useCallback(async () => {
    const file = lastPngFile.current;
    if (!file) return;
    setIsRetracing(true);
    try {
      const { pngToSvg } = await import('../PngToSvgConverter');
      const s = useStudio3DStore.getState();
      const svg = await pngToSvg(file, {
        turdSize: s.traceTurdSize,
        optTolerance: s.traceOptTolerance,
        threshold: s.traceThreshold,
      });
      store.setSvgData(svg, file.name);
      toast.success(t('studio3d.input.converted', { fileName: file.name }));
    } catch {
      toast.error(t('studio3d.input.processFailed'));
    } finally {
      setIsRetracing(false);
    }
  }, [store, t]);

  const handleBrandLogoSelect = useCallback(async (logoUrl: string, fileName: string) => {
    store.setIsLoading(true);
    try {
      const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(logoUrl)}`;
      const res = await fetch(proxyUrl);
      const { base64, mimeType } = await res.json() as { base64: string; mimeType: string };

      if (mimeType === 'image/svg+xml' || fileName.endsWith('.svg')) {
        const svgText = atob(base64);
        store.setSvgData(svgText, fileName);
        store.setInputMode('svg');
      } else {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const file = new File([bytes], fileName, { type: mimeType });
        lastPngFile.current = file;
        const { pngToSvg } = await import('../PngToSvgConverter');
        const s = useStudio3DStore.getState();
        const svg = await pngToSvg(file, {
          turdSize: s.traceTurdSize,
          optTolerance: s.traceOptTolerance,
          threshold: s.traceThreshold,
        });
        store.setSvgData(svg, fileName);
        store.setInputMode('svg');
      }
      toast.success(t('studio3d.input.loaded', { fileName }));
    } catch (err) {
      console.error('Failed to load brand logo:', err);
      toast.error(t('studio3d.input.processFailed'));
    } finally {
      store.setIsLoading(false);
    }
  }, [store, t]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  }, [processFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  return (
    <>
      {/* Scene Presets — collapsible horizontal strip with 3D previews */}
      <ToolPanelDisclosure label={t('studio3d.scenePresets.title')} icon={<Shuffle size={13} />} defaultOpen>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent -mx-0.5 px-0.5 pb-0.5">
          {Object.entries(SCENE_PRESETS).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => store.applyScenePreset(name)}
              className="shrink-0 flex flex-col items-center gap-1 group transition-all duration-150"
            >
              <div
                className="w-14 h-14 rounded-md overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors"
                style={{ background: preset.background }}
              >
                {presetThumbs[name] ? (
                  <img src={presetThumbs[name]} alt={preset.label} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full animate-pulse bg-white/5" />
                )}
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-500 group-hover:text-neutral-300 transition-colors max-w-14 truncate">
                {preset.label}
              </span>
            </button>
          ))}
          <button
            onClick={() => {
              if (!hasRandomizedOnce) {
                setShowRandomizeConfirm(true);
              } else {
                store.randomize();
                toast.success('Surprise!');
              }
            }}
            className="shrink-0 flex flex-col items-center gap-1 group transition-all duration-150"
          >
            <div className="w-14 h-14 rounded-md overflow-hidden border border-dashed border-cyan-500/30 group-hover:border-cyan-500/50 flex items-center justify-center transition-colors">
              <Shuffle size={16} className="text-cyan-400" />
            </div>
            <span className="text-[8px] font-mono uppercase tracking-wider text-cyan-500 group-hover:text-cyan-300 transition-colors max-w-14 truncate">
              Random
            </span>
          </button>
        </div>
      </ToolPanelDisclosure>

      {/* Input */}
      <ToolPanelDisclosure label={t('studio3d.input.title')} icon={<Upload size={13} />} defaultOpen>
        <ToolPanelGrid>
          <ToolPanelChip active={store.inputMode === 'svg'} onClick={() => store.setInputMode('svg')}>
            <span className="flex items-center justify-center gap-1"><FileText size={12} /> {t('studio3d.input.svgPng')}</span>
          </ToolPanelChip>
          <ToolPanelChip active={store.inputMode === 'text'} onClick={() => store.setInputMode('text')}>
            <span className="flex items-center justify-center gap-1"><Type size={12} /> {t('studio3d.input.text')}</span>
          </ToolPanelChip>
          <ToolPanelChip active={store.inputMode === 'model'} onClick={() => store.setInputMode('model')}>
            <span className="flex items-center justify-center gap-1"><Box size={12} /> 3D Model</span>
          </ToolPanelChip>
          {hasBrandLogos && (
            <ToolPanelChip onClick={() => setBrandPickerOpen(true)}>
              <span className="flex items-center justify-center gap-1"><Palette size={12} /> Brand</span>
            </ToolPanelChip>
          )}
        </ToolPanelGrid>

        {store.inputMode === 'model' ? (
          <div
            onClick={() => modelInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border border-dashed rounded-lg cursor-pointer transition-all',
              'border-white/10 hover:border-white/20'
            )}
          >
            <Upload size={20} className="text-neutral-500" />
            <span className="text-[10px] uppercase tracking-wider text-neutral-500 text-center">
              {store.fileName || (isMobile ? t('mobile.tapToUpload') : 'Drop GLB / GLTF')}
            </span>
            <input ref={modelInputRef} type="file" accept=".glb,.gltf" onChange={handleModelUpload} className="hidden" aria-label="Upload GLB or GLTF model" />
          </div>
        ) : store.inputMode === 'svg' ? (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center gap-2 p-4 border border-dashed rounded-lg cursor-pointer transition-all',
              isDragging ? 'border-white/30 bg-white/5 scale-[1.02]' : 'border-white/10 hover:border-white/20'
            )}
          >
            <Upload size={20} className={cn('transition-colors', isDragging ? 'text-white' : 'text-neutral-500')} />
            <span className={cn('text-[10px] uppercase tracking-wider transition-colors text-center', isDragging ? 'text-white' : 'text-neutral-500')}>
              {store.isLoading ? <GlitchLoader size={12} /> : store.fileName || (isMobile ? t('mobile.tapToUpload') : t('studio3d.input.dropZone'))}
            </span>
            <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" onChange={handleFileUpload} className="hidden" aria-label="Upload SVG or image" />
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={store.text}
              onChange={(e) => store.setText(e.target.value)}
              placeholder={t('studio3d.input.textPlaceholder')}
              aria-label="Text input"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
            />
            <select
              value={store.font}
              onChange={(e) => store.setFont(e.target.value)}
              aria-label="Font selection"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-white/20 appearance-none cursor-pointer"
            >
              {FONT_OPTIONS.map((f) => <option key={f} value={f} className="bg-neutral-900">{f}</option>)}
            </select>
          </div>
        )}
      </ToolPanelDisclosure>

      {/* Scenes */}
      <ToolPanelDisclosure label="Scenes" icon={<Film size={13} />} id="sec-scenes" defaultOpen>
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder="Scene name..."
              aria-label="Scene name"
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px] relative"
              disabled={!sceneName.trim()}
              aria-label="Save scene"
              onClick={async () => {
                let thumb: string | undefined;
                const c = document.querySelector('canvas') as HTMLCanvasElement | null;
                if (c) {
                  const t = document.createElement('canvas');
                  const r = Math.min(80 / c.width, 80 / c.height, 1);
                  t.width = Math.round(c.width * r);
                  t.height = Math.round(c.height * r);
                  t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
                  thumb = t.toDataURL('image/jpeg', 0.6);
                }
                const scene = await saveScene(sceneName.trim(), thumb);
                if (scene) {
                  setSavedScenes(await getSavedScenes());
                  toast.success('Scene saved');
                } else {
                  toast.error('Failed to save scene');
                }
              }}
            >
              <Save size={12} />
            </Button>
          </div>
          {scenesLoading && (
            <div className="text-[10px] text-neutral-600 text-center py-2">Loading scenes...</div>
          )}
          {savedScenes.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700">
              {savedScenes.map((scene) => (
                <div key={scene.id} className="flex items-center gap-1.5 group">
                  <button
                    onClick={async () => {
                      const ok = await loadScene(scene.id);
                      if (ok) toast.success(`Loaded "${scene.name}"`);
                      else toast.error('Failed to load scene');
                    }}
                    aria-label="Load scene"
                    className="flex-1 flex items-center gap-2 text-left px-2 py-1 rounded text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {scene.thumbnail ? (
                      <img src={scene.thumbnail} alt="" className="w-6 h-6 rounded border border-white/10 object-cover shrink-0" draggable={false} />
                    ) : (
                      <FolderOpen size={10} className="shrink-0 opacity-50" />
                    )}
                    <span className="truncate">{scene.name}</span>
                  </button>
                  <button
                    onClick={async () => {
                      await deleteScene(scene.id);
                      setSavedScenes(await getSavedScenes());
                      toast.success('Scene deleted');
                    }}
                    aria-label="Delete scene"
                    className="opacity-0 group-hover:opacity-100 p-1 text-neutral-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ToolPanelDisclosure>

      {/* Community Gallery */}
      <CommunityGallery />

      {/* SVG Trace Refine — only for PNG uploads */}
      {lastPngFile.current && store.inputMode === 'svg' && store.svgData && (
        <ToolPanelDisclosure
          label="SVG Refine"
          defaultOpen
          badge={<span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">trace</span>}
        >
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label="Noise" value={store.traceTurdSize} min={0} max={20} step={1} onChange={store.setTraceTurdSize} />
            <ScrubInput label="Simplify" value={store.traceOptTolerance} min={0} max={2} step={0.05} onChange={store.setTraceOptTolerance} />
          </div>
          <ScrubInput label="Threshold" value={store.traceThreshold} min={0} max={255} step={1} onChange={store.setTraceThreshold} />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-[10px] uppercase tracking-wider h-8"
            disabled={isRetracing}
            onClick={handleRetrace}
          >
            {isRetracing ? <GlitchLoader size={12} /> : 'Re-trace'}
          </Button>
        </ToolPanelDisclosure>
      )}

      {/* Geometry */}
      <ToolPanelDisclosure label={t('studio3d.geometry.title')} icon={<Box size={13} />} defaultOpen>
        <div className="grid grid-cols-2 gap-1.5">
          <ScrubInput label={t('studio3d.geometry.depth')} value={depth} min={0.1} max={10} step={0.1} onChange={setDepth} />
          <ScrubInput label={t('studio3d.geometry.objectScale')} value={objectScale} min={0.1} max={5} step={0.05} onChange={setObjectScale} />
        </div>
        <ToolPanelRow label={t('studio3d.geometry.bevel')}>
          <Switch checked={store.bevelEnabled} onCheckedChange={store.setBevelEnabled} aria-label="Bevel" />
        </ToolPanelRow>
        {store.bevelEnabled && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.thickness')} value={bevelThickness} min={0} max={20} step={0.1} onChange={setBevelThickness} />
            <ScrubInput label={t('studio3d.geometry.size')} value={bevelSize} min={0} max={20} step={0.1} onChange={setBevelSize} />
            <ScrubInput label={t('studio3d.geometry.smoothness')} value={smoothness} min={0} max={8} step={1} onChange={setSmoothness} />
          </div>
        )}
      </ToolPanelDisclosure>

      {/* Shape */}
      <ToolPanelDisclosure label={t('studio3d.geometry.shapeType')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {(['standard', 'coin', 'badge', 'stamp', 'shield', 'hexagon'] as const).map((type) => (
            <ToolPanelChip key={type} active={store.shapeType === type} onClick={() => store.setShapeType(type)}>
              {t(`studio3d.geometry.shape_${type}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        {store.shapeType === 'coin' && (
          <ScrubInput label={t('studio3d.geometry.coinRadius')} value={coinRadius} min={0.5} max={5} step={0.1} onChange={setCoinRadius} />
        )}
        {store.shapeType === 'badge' && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.badgeWidth')} value={badgeW} min={1} max={8} step={0.1} onChange={setBadgeW} />
            <ScrubInput label={t('studio3d.geometry.badgeHeight')} value={badgeH} min={1} max={8} step={0.1} onChange={setBadgeH} />
            <ScrubInput label={t('studio3d.geometry.badgeRadius')} value={badgeR} min={0} max={2} step={0.05} onChange={setBadgeR} />
          </div>
        )}
        {store.shapeType === 'stamp' && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.stampRadius')} value={sRadius} min={0.5} max={5} step={0.1} onChange={setSRadius} />
            <ScrubInput label={t('studio3d.geometry.stampTeeth')} value={sTeeth} min={8} max={48} step={1} onChange={setSTeeth} />
            <ScrubInput label={t('studio3d.geometry.stampToothDepth')} value={sTooth} min={0.05} max={1} step={0.05} onChange={setSTooth} />
          </div>
        )}
        {store.shapeType === 'shield' && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.shieldWidth')} value={shieldW} min={0.5} max={5} step={0.1} onChange={setShieldW} />
            <ScrubInput label={t('studio3d.geometry.shieldHeight')} value={shieldH} min={0.5} max={5} step={0.1} onChange={setShieldH} />
          </div>
        )}
        {store.shapeType === 'hexagon' && (
          <ScrubInput label={t('studio3d.geometry.hexRadius')} value={hexR} min={0.5} max={5} step={0.1} onChange={setHexR} />
        )}
        {store.shapeType !== 'standard' && (
          <>
            <ScrubInput label={t('studio3d.geometry.reliefDepth')} value={reliefDepth} min={0.05} max={1.5} step={0.05} onChange={setReliefDepth} />
            <ToolPanelRow label={t('studio3d.geometry.shapeColor')}>
              <div className="flex items-center gap-2">
                {!!store.shapeColor && (
                  <button
                    type="button"
                    className="w-6 h-6 rounded border border-white/10 shrink-0 cursor-pointer hover:border-white/30 transition-colors"
                    style={{ backgroundColor: store.shapeColor }}
                    onClick={() => setShapeColorPickerOpen((v) => !v)}
                    aria-label="Toggle shape color picker"
                  />
                )}
                <Switch checked={!!store.shapeColor} onCheckedChange={(on) => store.setShapeColor(on ? '#888888' : '')} aria-label="Custom shape color" />
              </div>
            </ToolPanelRow>
            {!!store.shapeColor && (
              <div className="flex items-center gap-2">
                <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                  <span className="text-[10px] text-neutral-500 mr-1">#</span>
                  <input
                    type="text"
                    value={store.shapeColor.replace('#', '').toUpperCase()}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setShapeColor(`#${v}`); }}
                    maxLength={6}
                    aria-label="Shape color hex"
                    className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
                  />
                </div>
              </div>
            )}
            {shapeColorPickerOpen && !!store.shapeColor && (
              <div className="animate-fade-in">
                <div className="custom-color-picker"><HexColorPicker color={store.shapeColor} onChange={store.setShapeColor} /></div>
              </div>
            )}
          </>
        )}

      </ToolPanelDisclosure>

      {/* Chain / Pendant */}
      <ToolPanelDisclosure
        label={t('studio3d.geometry.showChain')}
        icon={<Link size={13} />}
        badge={store.showChain ? <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">on</span> : undefined}
      >
        <ToolPanelRow label="Enable">
          <Switch checked={store.showChain} onCheckedChange={store.setShowChain} aria-label="Chain" />
        </ToolPanelRow>
        {store.showChain && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput label={t('studio3d.geometry.chainLinks')} value={chainLinks} min={2} max={16} step={1} onChange={setChainLinks} />
              <ScrubInput label={t('studio3d.geometry.chainScale')} value={chainScale} min={0.3} max={3} step={0.1} onChange={setChainScale} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <ScrubInput label={t('studio3d.geometry.bailSize')} value={bailSz} min={0.1} max={1.5} step={0.05} onChange={setBailSz} />
              <ScrubInput label={t('studio3d.geometry.bailOffset')} value={bailOff} min={-3} max={3} step={0.05} onChange={setBailOff} />
              <ScrubInput label={t('studio3d.geometry.chainOffset')} value={chainOff} min={-3} max={3} step={0.05} onChange={setChainOff} />
            </div>
            <ToolPanelRow label={t('studio3d.geometry.chainColor')}>
              <Switch checked={!!store.chainColor} onCheckedChange={(on) => store.setChainColor(on ? store.color : '')} aria-label="Custom chain color" />
            </ToolPanelRow>
            {!!store.chainColor && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-6 h-6 rounded border border-white/10 shrink-0 cursor-pointer hover:border-white/30 transition-colors"
                  style={{ backgroundColor: store.chainColor }}
                  onClick={() => setChainColorPickerOpen((v) => !v)}
                  aria-label="Toggle chain color picker"
                />
                <div className="flex items-center flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                  <span className="text-[10px] text-neutral-500 mr-1">#</span>
                  <input
                    type="text"
                    value={store.chainColor.replace('#', '').toUpperCase()}
                    onChange={(e) => { const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6); if (v.length === 6) store.setChainColor(`#${v}`); }}
                    maxLength={6}
                    aria-label="Chain color hex"
                    className="bg-transparent text-xs text-white font-mono tracking-wider w-full focus:outline-none"
                  />
                </div>
              </div>
            )}
            {chainColorPickerOpen && !!store.chainColor && (
              <div className="animate-fade-in">
                <div className="custom-color-picker"><HexColorPicker color={store.chainColor} onChange={store.setChainColor} /></div>
              </div>
            )}
          </>
        )}
      </ToolPanelDisclosure>


      <ConfirmationModal
        isOpen={showRandomizeConfirm}
        onClose={() => setShowRandomizeConfirm(false)}
        onConfirm={() => {
          setHasRandomizedOnce(true);
          setShowRandomizeConfirm(false);
          store.randomize();
          toast.success('Surprise!');
        }}
        title={t('studio3d.randomizeTitle')}
        message={t('studio3d.randomizeMessage')}
        confirmText={t('studio3d.randomizeConfirm')}
        variant="warning"
      />

      <BrandLogoPickerModal
        isOpen={brandPickerOpen}
        onClose={() => setBrandPickerOpen(false)}
        guidelines={brandGuidelines}
        isLoading={brandLoading}
        onSelectLogo={handleBrandLogoSelect}
      />
    </>
  );
});

const CommunityGallery: React.FC = React.memo(() => {
  const [scenes, setScenes] = useState<PublicScene[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [forking, setForking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    const { scenes: s } = await getPublicScenes({ limit: 12 });
    setScenes(s);
    setLoaded(true);
    setLoading(false);
  }, [loaded]);

  const handleFork = useCallback(async (id: string) => {
    setForking(id);
    const ok = await forkScene(id);
    setForking(null);
    if (ok) toast.success('Scene forked!');
    else toast.error('Failed to fork');
  }, []);

  return (
    <ToolPanelDisclosure
      label="Community"
      icon={<Globe size={13} />}
      badge={scenes.length > 0 ? <span className="text-[9px] font-mono text-neutral-600">{scenes.length}</span> : undefined}
    >
      {!loaded ? (
        <button
          onClick={load}
          className="w-full px-2 py-2 rounded text-[10px] uppercase tracking-wider bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200 transition-colors border border-dashed border-white/10"
        >
          {loading ? <GlitchLoader size={12} /> : 'Browse public scenes'}
        </button>
      ) : scenes.length === 0 ? (
        <p className="text-center text-neutral-600 text-[10px] py-3">No public scenes yet</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-700">
          {scenes.map((scene) => (
            <div key={scene.id} className="flex items-center gap-1.5 group">
              <button
                onClick={() => handleFork(scene.id)}
                disabled={forking === scene.id}
                className="flex-1 flex items-center gap-2 text-left px-2 py-1.5 rounded text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              >
                {scene.thumbnailUrl ? (
                  <img src={scene.thumbnailUrl} alt="" className="w-7 h-7 rounded border border-white/10 object-cover shrink-0" draggable={false} />
                ) : (
                  <div
                    className="w-7 h-7 rounded border border-white/10 shrink-0"
                    style={{ backgroundColor: scene.config?.background || '#0a0a0a' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-[10px]">{scene.name}</span>
                  {scene.user?.name && (
                    <span className="block truncate text-[8px] text-neutral-600">{scene.user.name}</span>
                  )}
                </div>
                <GitFork size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToolPanelDisclosure>
  );
});

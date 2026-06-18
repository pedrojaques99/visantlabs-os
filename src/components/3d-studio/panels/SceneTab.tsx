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
  getSavedScenes,
  saveScene,
  loadScene,
  deleteScene,
  getPublicScenes,
  forkScene,
  type SavedScene,
  type PublicScene,
} from '@/stores/studio3dStore';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from './_shared';
import {
  Upload,
  FileText,
  Type,
  Box,
  Film,
  Save,
  FolderOpen,
  Trash2,
  Link,
  Palette,
  Globe,
  GitFork,
} from 'lucide-react';
import {
  ToolPanelSection,
  ToolPanelDisclosure,
  ToolPanelGrid,
  ToolPanelChip,
  ToolPanelRow,
  ExpandableColorPicker,
} from '@/components/shared/ToolPanel';
import { FONT_OPTIONS } from './_shared';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandLogoPickerModal } from '../BrandLogoPickerModal';
import { ScenePresetsStrip } from '../ScenePresetsStrip';

// Fine-grained subscription: the input / geometry / shape / chain slice this
// tab renders (was a full-store subscription re-rendering on any store
// mutation). Trace params used only inside async callbacks are read via
// useStudio3DStore.getState() (non-reactive) and intentionally excluded here.
const scenePanelSelector = (s: StoreState) => ({
  _sceneName: s._sceneName,
  inputMode: s.inputMode,
  isLoading: s.isLoading,
  fileName: s.fileName,
  text: s.text,
  font: s.font,
  svgData: s.svgData,
  color: s.color,
  depth: s.depth,
  objectScale: s.objectScale,
  smoothness: s.smoothness,
  bevelEnabled: s.bevelEnabled,
  bevelThickness: s.bevelThickness,
  bevelSize: s.bevelSize,
  shapeType: s.shapeType,
  shapeColor: s.shapeColor,
  reliefDepth: s.reliefDepth,
  coinRadius: s.coinRadius,
  badgeWidth: s.badgeWidth,
  badgeHeight: s.badgeHeight,
  badgeRadius: s.badgeRadius,
  stampRadius: s.stampRadius,
  stampTeeth: s.stampTeeth,
  stampToothDepth: s.stampToothDepth,
  shieldWidth: s.shieldWidth,
  shieldHeight: s.shieldHeight,
  hexRadius: s.hexRadius,
  showChain: s.showChain,
  chainLinks: s.chainLinks,
  chainScale: s.chainScale,
  chainColor: s.chainColor,
  bailSize: s.bailSize,
  bailOffset: s.bailOffset,
  chainOffset: s.chainOffset,
  tracePreset: s.tracePreset,
  traceTurdSize: s.traceTurdSize,
  traceOptTolerance: s.traceOptTolerance,
  traceThreshold: s.traceThreshold,
  traceAlphaMax: s.traceAlphaMax,
  setBrandGuidelineId: s.setBrandGuidelineId,
  setInputMode: s.setInputMode,
  setIsLoading: s.setIsLoading,
  setModelUrl: s.setModelUrl,
  setSvgData: s.setSvgData,
  setText: s.setText,
  setFont: s.setFont,
  setDepth: s.setDepth,
  setObjectScale: s.setObjectScale,
  setSmoothness: s.setSmoothness,
  setBevelEnabled: s.setBevelEnabled,
  setBevelThickness: s.setBevelThickness,
  setBevelSize: s.setBevelSize,
  setShapeType: s.setShapeType,
  setShapeColor: s.setShapeColor,
  setReliefDepth: s.setReliefDepth,
  setCoinRadius: s.setCoinRadius,
  setBadgeWidth: s.setBadgeWidth,
  setBadgeHeight: s.setBadgeHeight,
  setBadgeRadius: s.setBadgeRadius,
  setStampRadius: s.setStampRadius,
  setStampTeeth: s.setStampTeeth,
  setStampToothDepth: s.setStampToothDepth,
  setShieldWidth: s.setShieldWidth,
  setShieldHeight: s.setShieldHeight,
  setHexRadius: s.setHexRadius,
  setShowChain: s.setShowChain,
  setChainLinks: s.setChainLinks,
  setChainScale: s.setChainScale,
  setChainColor: s.setChainColor,
  setBailSize: s.setBailSize,
  setBailOffset: s.setBailOffset,
  setChainOffset: s.setChainOffset,
  setTracePreset: s.setTracePreset,
  setTraceTurdSize: s.setTraceTurdSize,
  setTraceOptTolerance: s.setTraceOptTolerance,
  setTraceThreshold: s.setTraceThreshold,
  setTraceAlphaMax: s.setTraceAlphaMax,
});

export const SceneTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const store = useStudio3DStore(useShallow(scenePanelSelector));
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const lastPngFile = useRef<File | null>(null);
  const [isRetracing, setIsRetracing] = useState(false);

  const [depth, setDepth] = useDebouncedSlider(store.depth, store.setDepth);
  const [objectScale, setObjectScale] = useDebouncedSlider(store.objectScale, store.setObjectScale);
  const [smoothness, setSmoothness] = useDebouncedSlider(store.smoothness, store.setSmoothness);
  const [bevelThickness, setBevelThickness] = useDebouncedSlider(
    store.bevelThickness,
    store.setBevelThickness
  );
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

  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const { data: brandGuidelines = [], isLoading: brandLoading } = useBrandGuidelines(true);
  const hasBrandLogos = brandGuidelines.some((g) => g.logos && g.logos.length > 0);

  const [savedScenes, setSavedScenes] = useState<SavedScene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [sceneName, setSceneName] = useState(store._sceneName || '');

  useEffect(() => {
    setScenesLoading(true);
    getSavedScenes().then((scenes) => {
      setSavedScenes(scenes);
      setScenesLoading(false);
    });
  }, []);

  const handleModelUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      store.setModelUrl(url, file.name);
      toast.success(t('studio3d.input.loaded', { fileName: file.name }));
      e.target.value = '';
    },
    [store, t]
  );

  const processFile = useCallback(
    async (file: File) => {
      if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
        lastPngFile.current = null;
        const text = await file.text();
        store.setSvgData(text, file.name);
        toast.success(t('studio3d.input.loaded', { fileName: file.name }));
      } else if (file.type.startsWith('image/')) {
        lastPngFile.current = file;
        store.setIsLoading(true);
        try {
          const { tracePng } = await import('@/services/svgPipeline');
          const s = useStudio3DStore.getState();
          const svg = await tracePng(file, {
            turdSize: s.traceTurdSize,
            optTolerance: s.traceOptTolerance,
            threshold: s.traceThreshold,
            alphaMax: s.traceAlphaMax,
            preset: s.tracePreset,
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
    },
    [store, t]
  );

  const handleRetrace = useCallback(async () => {
    const file = lastPngFile.current;
    if (!file) return;
    setIsRetracing(true);
    try {
      const { tracePng } = await import('@/services/svgPipeline');
      const s = useStudio3DStore.getState();
      const svg = await tracePng(file, {
        turdSize: s.traceTurdSize,
        optTolerance: s.traceOptTolerance,
        threshold: s.traceThreshold,
        alphaMax: s.traceAlphaMax,
        preset: s.tracePreset,
      });
      store.setSvgData(svg, file.name);
      toast.success(t('studio3d.input.converted', { fileName: file.name }));
    } catch {
      toast.error(t('studio3d.input.processFailed'));
    } finally {
      setIsRetracing(false);
    }
  }, [store, t]);

  const handleBrandLogoSelect = useCallback(
    async (logoUrl: string, fileName: string, guidelineId?: string) => {
      // Record the brand so the on-brand scene gallery appears (and survives reload).
      if (guidelineId) store.setBrandGuidelineId(guidelineId);
      store.setIsLoading(true);
      try {
        const proxyUrl = `/api/images/proxy?url=${encodeURIComponent(logoUrl)}`;
        const res = await fetch(proxyUrl);
        const { base64, mimeType } = (await res.json()) as { base64: string; mimeType: string };

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
          const { tracePng } = await import('@/services/svgPipeline');
          const s = useStudio3DStore.getState();
          const svg = await tracePng(file, {
            turdSize: s.traceTurdSize,
            optTolerance: s.traceOptTolerance,
            threshold: s.traceThreshold,
            alphaMax: s.traceAlphaMax,
            preset: s.tracePreset,
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
    },
    [store, t]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
      e.target.value = '';
    },
    [processFile]
  );

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

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      const file = e.dataTransfer.files?.[0];
      if (file) await processFile(file);
    },
    [processFile]
  );

  return (
    <>
      {/* Quick-start: built-in scene presets + on-brand scenes + Random */}
      <ScenePresetsStrip />

      {/* Input */}
      <ToolPanelDisclosure
        label={t('studio3d.input.title')}
        icon={<Upload size={13} />}
        defaultOpen
      >
        <ToolPanelGrid>
          <ToolPanelChip
            active={store.inputMode === 'svg'}
            onClick={() => store.setInputMode('svg')}
          >
            <span className="flex items-center justify-center gap-1">
              <FileText size={12} /> {t('studio3d.input.svgPng')}
            </span>
          </ToolPanelChip>
          <ToolPanelChip
            active={store.inputMode === 'text'}
            onClick={() => store.setInputMode('text')}
          >
            <span className="flex items-center justify-center gap-1">
              <Type size={12} /> {t('studio3d.input.text')}
            </span>
          </ToolPanelChip>
          <ToolPanelChip
            active={store.inputMode === 'model'}
            onClick={() => store.setInputMode('model')}
          >
            <span className="flex items-center justify-center gap-1">
              <Box size={12} /> 3D Model
            </span>
          </ToolPanelChip>
          {hasBrandLogos && (
            <ToolPanelChip onClick={() => setBrandPickerOpen(true)}>
              <span className="flex items-center justify-center gap-1">
                <Palette size={12} /> Brand
              </span>
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
            <input
              ref={modelInputRef}
              type="file"
              accept=".glb,.gltf"
              onChange={handleModelUpload}
              className="hidden"
              aria-label="Upload GLB or GLTF model"
            />
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
              isDragging
                ? 'border-white/30 bg-white/5 scale-[1.02]'
                : 'border-white/10 hover:border-white/20'
            )}
          >
            <Upload
              size={20}
              className={cn('transition-colors', isDragging ? 'text-white' : 'text-neutral-500')}
            />
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider transition-colors text-center',
                isDragging ? 'text-white' : 'text-neutral-500'
              )}
            >
              {store.isLoading ? (
                <GlitchLoader size={12} />
              ) : (
                store.fileName ||
                (isMobile ? t('mobile.tapToUpload') : t('studio3d.input.dropZone'))
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".svg,.png,.jpg,.jpeg,.webp"
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Upload SVG or image"
            />
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
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} className="bg-neutral-900">
                  {f}
                </option>
              ))}
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
                      <img
                        src={scene.thumbnail}
                        alt=""
                        className="w-6 h-6 rounded border border-white/10 object-cover shrink-0"
                        draggable={false}
                      />
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
          badge={
            <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              trace
            </span>
          }
        >
          <div className="flex flex-wrap gap-1">
            {(['logo', 'lettering', 'lineArt', 'stamp', 'custom'] as const).map((p) => (
              <ToolPanelChip
                key={p}
                active={store.tracePreset === p}
                onClick={() => {
                  store.setTracePreset(p);
                }}
              >
                {p === 'lineArt' ? 'Line Art' : p.charAt(0).toUpperCase() + p.slice(1)}
              </ToolPanelChip>
            ))}
          </div>
          {store.tracePreset === 'custom' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="Noise"
                  value={store.traceTurdSize}
                  min={0}
                  max={20}
                  step={1}
                  onChange={store.setTraceTurdSize}
                />
                <ScrubInput
                  label="Simplify"
                  value={store.traceOptTolerance}
                  min={0}
                  max={2}
                  step={0.05}
                  onChange={store.setTraceOptTolerance}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput
                  label="Threshold"
                  value={typeof store.traceThreshold === 'number' ? store.traceThreshold : 128}
                  min={0}
                  max={255}
                  step={1}
                  onChange={store.setTraceThreshold}
                />
                <ScrubInput
                  label="Corners"
                  value={store.traceAlphaMax}
                  min={0}
                  max={1.334}
                  step={0.05}
                  onChange={store.setTraceAlphaMax}
                />
              </div>
            </>
          )}
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
      <ToolPanelDisclosure
        label={t('studio3d.geometry.title')}
        icon={<Box size={13} />}
        defaultOpen
      >
        <div className="grid grid-cols-2 gap-1.5">
          <ScrubInput
            label={t('studio3d.geometry.depth')}
            value={depth}
            min={0.1}
            max={10}
            step={0.1}
            onChange={setDepth}
          />
          <ScrubInput
            label={t('studio3d.geometry.objectScale')}
            value={objectScale}
            min={0.1}
            max={5}
            step={0.05}
            onChange={setObjectScale}
          />
        </div>
        <ToolPanelRow label={t('studio3d.geometry.bevel')}>
          <Switch
            checked={store.bevelEnabled}
            onCheckedChange={store.setBevelEnabled}
            aria-label="Bevel"
          />
        </ToolPanelRow>
        {store.bevelEnabled && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput
              label={t('studio3d.geometry.thickness')}
              value={bevelThickness}
              min={0}
              max={20}
              step={0.1}
              onChange={setBevelThickness}
            />
            <ScrubInput
              label={t('studio3d.geometry.size')}
              value={bevelSize}
              min={0}
              max={20}
              step={0.1}
              onChange={setBevelSize}
            />
            <ScrubInput
              label={t('studio3d.geometry.smoothness')}
              value={smoothness}
              min={0}
              max={8}
              step={1}
              onChange={setSmoothness}
            />
          </div>
        )}
      </ToolPanelDisclosure>

      {/* Shape */}
      <ToolPanelDisclosure label={t('studio3d.geometry.shapeType')} defaultOpen>
        <ToolPanelGrid cols={3}>
          {(['standard', 'coin', 'badge', 'stamp', 'shield', 'hexagon'] as const).map((type) => (
            <ToolPanelChip
              key={type}
              active={store.shapeType === type}
              onClick={() => store.setShapeType(type)}
            >
              {t(`studio3d.geometry.shape_${type}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        {store.shapeType === 'coin' && (
          <ScrubInput
            label={t('studio3d.geometry.coinRadius')}
            value={coinRadius}
            min={0.5}
            max={5}
            step={0.1}
            onChange={setCoinRadius}
          />
        )}
        {store.shapeType === 'badge' && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput
              label={t('studio3d.geometry.badgeWidth')}
              value={badgeW}
              min={1}
              max={8}
              step={0.1}
              onChange={setBadgeW}
            />
            <ScrubInput
              label={t('studio3d.geometry.badgeHeight')}
              value={badgeH}
              min={1}
              max={8}
              step={0.1}
              onChange={setBadgeH}
            />
            <ScrubInput
              label={t('studio3d.geometry.badgeRadius')}
              value={badgeR}
              min={0}
              max={2}
              step={0.05}
              onChange={setBadgeR}
            />
          </div>
        )}
        {store.shapeType === 'stamp' && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput
              label={t('studio3d.geometry.stampRadius')}
              value={sRadius}
              min={0.5}
              max={5}
              step={0.1}
              onChange={setSRadius}
            />
            <ScrubInput
              label={t('studio3d.geometry.stampTeeth')}
              value={sTeeth}
              min={8}
              max={48}
              step={1}
              onChange={setSTeeth}
            />
            <ScrubInput
              label={t('studio3d.geometry.stampToothDepth')}
              value={sTooth}
              min={0.05}
              max={1}
              step={0.05}
              onChange={setSTooth}
            />
          </div>
        )}
        {store.shapeType === 'shield' && (
          <div className="grid grid-cols-2 gap-1.5">
            <ScrubInput
              label={t('studio3d.geometry.shieldWidth')}
              value={shieldW}
              min={0.5}
              max={5}
              step={0.1}
              onChange={setShieldW}
            />
            <ScrubInput
              label={t('studio3d.geometry.shieldHeight')}
              value={shieldH}
              min={0.5}
              max={5}
              step={0.1}
              onChange={setShieldH}
            />
          </div>
        )}
        {store.shapeType === 'hexagon' && (
          <ScrubInput
            label={t('studio3d.geometry.hexRadius')}
            value={hexR}
            min={0.5}
            max={5}
            step={0.1}
            onChange={setHexR}
          />
        )}
        {store.shapeType !== 'standard' && (
          <>
            <ScrubInput
              label={t('studio3d.geometry.reliefDepth')}
              value={reliefDepth}
              min={0.05}
              max={1.5}
              step={0.05}
              onChange={setReliefDepth}
            />
            <ToolPanelRow label={t('studio3d.geometry.shapeColor')}>
              <Switch
                checked={!!store.shapeColor}
                onCheckedChange={(on) => store.setShapeColor(on ? '#888888' : '')}
                aria-label="Custom shape color"
              />
            </ToolPanelRow>
            {!!store.shapeColor && (
              <ExpandableColorPicker
                color={store.shapeColor}
                onChange={store.setShapeColor}
                label="Shape color"
              />
            )}
          </>
        )}
      </ToolPanelDisclosure>

      {/* Chain / Pendant */}
      <ToolPanelDisclosure
        label={t('studio3d.geometry.showChain')}
        icon={<Link size={13} />}
        badge={
          store.showChain ? (
            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
              on
            </span>
          ) : undefined
        }
      >
        <ToolPanelRow label="Enable">
          <Switch
            checked={store.showChain}
            onCheckedChange={store.setShowChain}
            aria-label="Chain"
          />
        </ToolPanelRow>
        {store.showChain && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <ScrubInput
                label={t('studio3d.geometry.chainLinks')}
                value={chainLinks}
                min={2}
                max={16}
                step={1}
                onChange={setChainLinks}
              />
              <ScrubInput
                label={t('studio3d.geometry.chainScale')}
                value={chainScale}
                min={0.3}
                max={3}
                step={0.1}
                onChange={setChainScale}
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <ScrubInput
                label={t('studio3d.geometry.bailSize')}
                value={bailSz}
                min={0.1}
                max={1.5}
                step={0.05}
                onChange={setBailSz}
              />
              <ScrubInput
                label={t('studio3d.geometry.bailOffset')}
                value={bailOff}
                min={-3}
                max={3}
                step={0.05}
                onChange={setBailOff}
              />
              <ScrubInput
                label={t('studio3d.geometry.chainOffset')}
                value={chainOff}
                min={-3}
                max={3}
                step={0.05}
                onChange={setChainOff}
              />
            </div>
            <ToolPanelRow label={t('studio3d.geometry.chainColor')}>
              <Switch
                checked={!!store.chainColor}
                onCheckedChange={(on) => store.setChainColor(on ? store.color : '')}
                aria-label="Custom chain color"
              />
            </ToolPanelRow>
            {!!store.chainColor && (
              <ExpandableColorPicker
                color={store.chainColor}
                onChange={store.setChainColor}
                label="Chain color"
              />
            )}
          </>
        )}
      </ToolPanelDisclosure>


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
      badge={
        scenes.length > 0 ? (
          <span className="text-[9px] font-mono text-neutral-600">{scenes.length}</span>
        ) : undefined
      }
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
                  <img
                    src={scene.thumbnailUrl}
                    alt=""
                    className="w-7 h-7 rounded border border-white/10 object-cover shrink-0"
                    draggable={false}
                  />
                ) : (
                  <div
                    className="w-7 h-7 rounded border border-white/10 shrink-0"
                    style={{ backgroundColor: scene.config?.background || '#0a0a0a' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-[10px]">{scene.name}</span>
                  {scene.user?.name && (
                    <span className="block truncate text-[8px] text-neutral-600">
                      {scene.user.name}
                    </span>
                  )}
                </div>
                <GitFork
                  size={10}
                  className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToolPanelDisclosure>
  );
});

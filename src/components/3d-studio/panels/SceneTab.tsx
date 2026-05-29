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
  type SavedScene,
} from '@/stores/studio3dStore';
import {
  Upload, FileText, Type, Box, Film, Save, FolderOpen, Trash2, Shuffle,
} from 'lucide-react';
import {
  ToolPanelSection, ToolPanelDisclosure, ToolPanelGrid, ToolPanelChip, ToolPanelRow,
} from '@/components/shared/ToolPanel';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { FONT_OPTIONS } from './_shared';

export const SceneTab: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const store = useStudio3DStore();
  const [isDragging, setIsDragging] = useState(false);
  const [hasRandomizedOnce, setHasRandomizedOnce] = useState(false);
  const [showRandomizeConfirm, setShowRandomizeConfirm] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

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

  const [savedScenes, setSavedScenes] = useState<SavedScene[]>([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [sceneName, setSceneName] = useState('');

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
      const text = await file.text();
      store.setSvgData(text, file.name);
      toast.success(t('studio3d.input.loaded', { fileName: file.name }));
    } else if (file.type.startsWith('image/')) {
      store.setIsLoading(true);
      try {
        const { pngToSvg } = await import('../PngToSvgConverter');
        const svg = await pngToSvg(file);
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
      {/* Input */}
      <ToolPanelSection title={t('studio3d.input.title')}>
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
      </ToolPanelSection>

      {/* Scenes */}
      <ToolPanelDisclosure label="Scenes" icon={<Film size={13} />} id="sec-scenes">
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
              className="h-7 px-2 text-[10px]"
              disabled={!sceneName.trim()}
              aria-label="Save scene"
              onClick={async () => {
                const scene = await saveScene(sceneName.trim());
                if (scene) {
                  setSavedScenes(await getSavedScenes());
                  setSceneName('');
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
                    className="flex-1 text-left px-2 py-1 rounded text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white transition-colors truncate"
                  >
                    <FolderOpen size={10} className="inline mr-1.5 opacity-50" />
                    {scene.name}
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

      {/* Geometry — shape selector + shape-specific controls */}
      <ToolPanelSection title={t('studio3d.geometry.title')}>
        <ToolPanelGrid cols={3}>
          {(['standard', 'coin', 'badge', 'stamp', 'shield', 'hexagon', 'pendant'] as const).map((type) => (
            <ToolPanelChip key={type} active={store.shapeType === type} onClick={() => store.setShapeType(type)}>
              {t(`studio3d.geometry.shape_${type}`)}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        {(store.shapeType === 'coin' || store.shapeType === 'pendant') && (
          <div className="grid grid-cols-1 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.coinRadius')} value={coinRadius} min={0.5} max={5} step={0.1} onChange={setCoinRadius} />
          </div>
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
          <div className="grid grid-cols-1 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.hexRadius')} value={hexR} min={0.5} max={5} step={0.1} onChange={setHexR} />
          </div>
        )}
        {store.shapeType === 'pendant' && (
          <>
            <ToolPanelRow label={t('studio3d.geometry.showChain')}>
              <Switch checked={store.showChain} onCheckedChange={store.setShowChain} aria-label="Chain" />
            </ToolPanelRow>
            {store.showChain && (
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubInput label={t('studio3d.geometry.chainLinks')} value={chainLinks} min={2} max={16} step={1} onChange={setChainLinks} />
                <ScrubInput label={t('studio3d.geometry.chainScale')} value={chainScale} min={0.3} max={3} step={0.1} onChange={setChainScale} />
              </div>
            )}
          </>
        )}

        {/* Depth, scale, bevel */}
        <div className="grid grid-cols-2 gap-1.5 mt-2 pt-2 border-t border-white/5">
          <ScrubInput label={t('studio3d.geometry.depth')} value={depth} min={0.5} max={10} step={0.1} onChange={setDepth} />
          <ScrubInput label={t('studio3d.geometry.objectScale')} value={objectScale} min={0.1} max={5} step={0.05} onChange={setObjectScale} />
        </div>
        <ToolPanelRow label={t('studio3d.geometry.bevel')}>
          <Switch checked={store.bevelEnabled} onCheckedChange={store.setBevelEnabled} aria-label="Bevel" />
        </ToolPanelRow>
        {store.bevelEnabled && (
          <div className="grid grid-cols-3 gap-1.5">
            <ScrubInput label={t('studio3d.geometry.thickness')} value={bevelThickness} min={0} max={2} step={0.01} onChange={setBevelThickness} />
            <ScrubInput label={t('studio3d.geometry.size')} value={bevelSize} min={0} max={2} step={0.01} onChange={setBevelSize} />
            <ScrubInput label={t('studio3d.geometry.smoothness')} value={smoothness} min={0} max={8} step={1} onChange={setSmoothness} />
          </div>
        )}
      </ToolPanelSection>

      {/* Presets */}
      <ToolPanelSection title={t('studio3d.scenePresets.title')}>
        <ToolPanelGrid>
          {Object.keys(SCENE_PRESETS).map((name) => (
            <ToolPanelChip key={name} onClick={() => store.applyScenePreset(name)}>
              {name}
            </ToolPanelChip>
          ))}
        </ToolPanelGrid>
        <button
          onClick={() => {
            if (!hasRandomizedOnce) {
              setShowRandomizeConfirm(true);
            } else {
              store.randomize();
              toast.success('Surprise!');
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-dashed border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 transition-all text-[10px] uppercase tracking-widest font-mono"
        >
          <Shuffle size={13} />
          Surprise me
        </button>
      </ToolPanelSection>

      <ConfirmationModal
        isOpen={showRandomizeConfirm}
        onClose={() => setShowRandomizeConfirm(false)}
        onConfirm={() => {
          setHasRandomizedOnce(true);
          setShowRandomizeConfirm(false);
          store.randomize();
          toast.success('Surprise!');
        }}
        title="Surprise Me"
        message="This will randomize all scene parameters (material, color, lighting, animation, etc). Your current settings will be lost."
        confirmText="Let's go!"
        variant="warning"
      />
    </>
  );
});

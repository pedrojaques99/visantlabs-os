import React, { useRef, useEffect, useMemo } from 'react';
import { Diamond, Paintbrush, Type as TypeIcon, Image as ImageIcon, Plus, Layers, X, Scan } from 'lucide-react';
import { useCreativeStore } from './store/creativeStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useQueryClient } from '@tanstack/react-query';
import { CREATIVE_PROJECT_KEYS } from '@/hooks/queries/useCreativeProjects';
import { creativeProjectApi } from '@/services/creativeProjectApi';
import { snapshotCreativeFromStore, saveCurrentCreativeAsNew } from './lib/persistCreative';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';
import { CreativeSetupSidebar } from './CreativeSetupSidebar';
import { CreativeEditorSidebar } from './CreativeEditorSidebar';
import { CreativeCanvas } from './CreativeCanvas';
import { CreativeToolbar, BackgroundToolbar } from './CreativeToolbar';
import { PremiumGlitchLoader } from '@/components/ui/PremiumGlitchLoader';
import { exportCanvasAsPng } from './lib/exportPng';
import { captureCanvasThumbnail } from './lib/captureThumbnail';
import { getPreviewDimensions } from './lib/formatDimensions';
import { isPersistedId } from './lib/layerUtils';
import { Link } from 'react-router-dom';
import {
  BreadcrumbWithBack, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator
} from '@/components/ui/BreadcrumbWithBack';
import { toast } from 'sonner';

export const CreativeStudio: React.FC = () => {
  const {
    status, format, brandId, removeLayer, selectedLayerIds, setSelectedLayerIds,
    pages, activePageIndex, setActivePageIndex, addPage, removePage, setStatus,
    groupSelected, ungroupSelected, backgroundSelected,
    activeTool, setActiveTool
  } = useCreativeStore();

  const creativeId = useCreativeStore((s) => s.creativeId);
  const projectName = useCreativeStore((s) => s.projectName);
  const prompt = useCreativeStore((s) => s.prompt);
  const layers = useCreativeStore((s) => s.layers);
  const overlay = useCreativeStore((s) => s.overlay);
  const backgroundUrl = useCreativeStore((s) => s.backgroundUrl);

  const { undo, redo } = useCreativeStore.temporal.getState();
  const { colors, allGuidelines } = useBrandKit();

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = React.useState({ width: 0, height: 0 });

  const currentGuideline = allGuidelines.find(g => g.id === brandId);
  const accentColor = currentGuideline?.colors?.[0]?.hex ?? colors[0]?.hex ?? '#00e5ff';
  const defaultFont = currentGuideline?.typography?.[0]?.family ?? 'Inter, sans-serif';

  // Sync brandId with global CanvasHeader
  const { setLinkedGuidelineId } = useCanvasHeader();
  useEffect(() => {
    if (brandId) setLinkedGuidelineId(brandId);
  }, [brandId, setLinkedGuidelineId]);

  // Compute preview dimensions
  useEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      const padding = 120;
      const maxW = el.offsetWidth - padding * 2;
      const maxH = el.offsetHeight - padding * 2;
      setPreviewSize(getPreviewDimensions(format, maxW, maxH));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [format]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.hasAttribute('contenteditable');

      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey)) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if ((e.shiftKey && e.key === 'z') || e.key === 'y') { e.preventDefault(); redo(); }
        if (e.key === 'd' && selectedLayerIds.length > 0) {
          e.preventDefault();
          const { duplicateLayer } = useCreativeStore.getState();
          selectedLayerIds.forEach(id => duplicateLayer(id));
          toast.info(`${selectedLayerIds.length} layers duplicados`);
        }
        if (e.key === 'g' && !e.shiftKey && selectedLayerIds.length > 1) {
          e.preventDefault();
          groupSelected();
          toast.success('Camadas agrupadas');
        }
        if (e.key === 'g' && e.shiftKey && selectedLayerIds.length === 1) {
          e.preventDefault();
          ungroupSelected();
          toast.info('Grupo desfeito');
        }
      }

      if (e.key === 'Escape' && selectedLayerIds.length > 0) {
        setSelectedLayerIds([]);
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerIds.length > 0) {
        e.preventDefault();
        selectedLayerIds.forEach(id => removeLayer(id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedLayerIds, setSelectedLayerIds, removeLayer, groupSelected, ungroupSelected]);

  const handleExport = async () => {
    if (!canvasRef.current) return;
    try {
      await exportCanvasAsPng(canvasRef.current, format, `creative-${Date.now()}.png`);
      toast.success('Criativo exportado!');
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha ao exportar');
    }
  };

  const handleCaptureThumbnail = async (): Promise<string | null> => {
    if (!canvasRef.current) return null;
    return captureCanvasThumbnail(canvasRef.current);
  };

  const isEditing = status === 'editing';

  const autoSaveData = useMemo(
    () => ({ projectName, prompt, format, brandId, backgroundUrl, overlay, layers, pages, activePageIndex }),
    [projectName, prompt, format, brandId, backgroundUrl, overlay, layers, pages, activePageIndex]
  );

  const queryClient = useQueryClient();
  const { status: autoSaveStatus, lastSavedAt } = useAutoSave({
    data: autoSaveData,
    enabled: isEditing,
    debounceMs: 2000,
    onSave: async () => {
      const thumbnailUrl = await handleCaptureThumbnail();
      const { setCreativeId } = useCreativeStore.getState();
      const currentId = useCreativeStore.getState().creativeId;
      const persisted = isPersistedId(currentId);

      if (persisted) {
        await creativeProjectApi.update(currentId as string, {
          ...snapshotCreativeFromStore(),
          thumbnailUrl,
        });
      } else {
        const project = await saveCurrentCreativeAsNew(undefined, thumbnailUrl);
        setCreativeId(project.id);
      }
      queryClient.invalidateQueries({ queryKey: CREATIVE_PROJECT_KEYS.lists });
    },
  });

  return (
    <div className="flex h-[calc(100vh-1px)] bg-black overflow-hidden select-none">
      {status === 'editing' ? (
        <CreativeEditorSidebar
          onExport={handleExport}
          onCaptureThumbnail={handleCaptureThumbnail}
          autoSaveStatus={autoSaveStatus}
          lastSavedAt={lastSavedAt}
        />
      ) : (
        <CreativeSetupSidebar />
      )}

      <main
        className="flex-1 flex flex-col overflow-hidden bg-neutral-950/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const { setSelectedLayerIds, setBackgroundSelected } = useCreativeStore.getState();
            setSelectedLayerIds([]);
            setBackgroundSelected(false);
          }
        }}
      >
        {/* ── Top header bar (breadcrumb left, actions right) ── */}
        <div className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-white/[0.04] z-40">
          <BreadcrumbWithBack to="/create/projects">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild><Link to="/create/projects">Creative Projects</Link></BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Creative Studio</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>

          {status === 'editing' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-px bg-neutral-900/60 border border-white/10 rounded-full p-1">
                <button className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
                  <Paintbrush size={12} className="text-brand-cyan" /> Variar Cores
                </button>
                <button className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
                  <ImageIcon size={12} className="text-emerald-400" /> Variar Imagens
                </button>
                <button className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
                  <TypeIcon size={12} className="text-amber-400" /> Variar Copy
                </button>
              </div>
              <button
                onClick={() => setActiveTool(activeTool === 'lasso' ? 'select' : 'lasso')}
                className={`px-4 py-2 rounded-full border text-[10px] font-bold uppercase tracking-[0.1em] transition-all flex items-center gap-2 ${
                  activeTool === 'lasso'
                    ? 'border-brand-cyan/60 bg-brand-cyan/20 text-brand-cyan'
                    : 'border-white/10 bg-neutral-900/60 text-neutral-400 hover:text-white hover:border-white/20'
                }`}
                title="Laço — selecionar região para editar com IA"
              >
                <Scan size={12} /> Laço
              </button>
              <button
                onClick={() => setStatus('setup')}
                className="px-5 py-2 rounded-full border border-brand-cyan/20 bg-brand-cyan/5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-cyan hover:bg-brand-cyan/20 hover:border-brand-cyan/40 transition-all flex items-center gap-2"
              >
                <Diamond size={12} /> Gerar Novo
              </button>
            </div>
          )}
        </div>

        {/* ── Canvas area (fills remaining space, centers content) ── */}
        <div
          ref={containerRef}
          className="flex-1 relative flex flex-col items-center justify-center overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const { setSelectedLayerIds, setBackgroundSelected } = useCreativeStore.getState();
              setSelectedLayerIds([]);
              setBackgroundSelected(false);
            }
          }}
        >

        {status === 'generating' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-50 bg-black/80 backdrop-blur-xl animate-in fade-in">
            <div className="p-8 rounded-3xl bg-neutral-900/40 border border-white/5 shadow-2xl flex flex-col items-center gap-6 min-w-[320px]">
              <PremiumGlitchLoader className="w-full" />
            </div>
          </div>
        )}

        {status === 'setup' && previewSize.width > 0 && (
          <div
            className="border border-dashed border-white/10 rounded-lg bg-neutral-900/20"
            style={{ width: previewSize.width, height: previewSize.height }}
          />
        )}

        {/* ── Multi-Card Gallery ── */}
        {status === 'editing' && pages.length > 1 ? (
          <div className="flex items-center gap-8 px-12 overflow-x-auto overflow-y-hidden custom-scrollbar-h max-w-full scroll-smooth py-12"
            style={{ justifyContent: pages.length <= 3 ? 'center' : 'flex-start' }}
          >
            {pages.map((page, idx) => {
              const isActive = idx === activePageIndex;
              // Active frame gets full size, inactive frames get a smaller preview
              const scale = isActive ? 1 : 0.6;
              const dimensions = getPreviewDimensions(
                page.format,
                previewSize.width * scale,
                previewSize.height * scale
              );
              return (
                <div
                  key={page.id}
                  className={`relative shrink-0 transition-all duration-500 ease-out group/frame ${isActive
                      ? 'z-10'
                      : 'opacity-40 hover:opacity-70 cursor-pointer'
                    }`}
                  onClick={() => !isActive && setActivePageIndex(idx)}
                >
                  {/* Remove frame button */}
                  {pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePage(idx);
                      }}
                      className="absolute -top-3 -right-3 z-20 w-6 h-6 rounded-full bg-neutral-800 border border-white/10 hover:bg-red-500/80 hover:border-red-400 flex items-center justify-center text-neutral-500 hover:text-white transition-all opacity-0 group-hover/frame:opacity-100"
                      title="Remover frame"
                    >
                      <X size={12} />
                    </button>
                  )}
                  {/* Frame label */}
                  <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium tracking-wider uppercase ${isActive ? 'text-brand-cyan' : 'text-neutral-600'
                    }`}>
                    {idx + 1}/{pages.length}
                  </div>
                  <CreativeCanvas
                    ref={isActive ? canvasRef : null}
                    width={dimensions.width}
                    height={dimensions.height}
                    accentColor={accentColor}
                    defaultFont={defaultFont}
                  />
                </div>
              );
            })}
            <button
              onClick={() => addPage()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/10 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 flex items-center justify-center text-neutral-600 hover:text-brand-cyan transition-all group shrink-0"
            >
              <Plus size={28} className="group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        ) : status === 'editing' && previewSize.width > 0 ? (
          <div className="flex items-center gap-8 justify-center py-12">
            <CreativeCanvas
              ref={canvasRef}
              width={previewSize.width}
              height={previewSize.height}
              accentColor={accentColor}
              defaultFont={defaultFont}
            />
            <button
              onClick={() => addPage()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/10 hover:border-brand-cyan/40 hover:bg-brand-cyan/5 flex items-center justify-center text-neutral-600 hover:text-brand-cyan transition-all group shrink-0"
            >
              <Plus size={28} className="group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        ) : null}

          {status === 'editing' && backgroundSelected && <BackgroundToolbar />}
          {status === 'editing' && <CreativeToolbar />}
        </div>
      </main>
    </div>
  );
};

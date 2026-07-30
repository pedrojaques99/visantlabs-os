import React, { useRef, useEffect, useMemo } from 'react';
import { Diamond, Scan } from '@/lib/ui/icons';
import { useCreativeStore } from './store/creativeStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useQueryClient } from '@tanstack/react-query';
import { CREATIVE_PROJECT_KEYS } from '@/hooks/queries/useCreativeProjects';
import { creativeProjectApi } from '@/services/creativeProjectApi';
import {
  snapshotCreativeFromStore,
  saveCurrentCreativeAsNew,
  ensurePersistedBackground,
} from './lib/persistCreative';
import { useBrandKit } from '@/contexts/BrandKitContext';
import { useCanvasHeader } from '@/components/canvas/CanvasHeaderContext';
import { CreativeSetupSidebar } from './CreativeSetupSidebar';
import { CreativeEditorSidebar } from './CreativeEditorSidebar';
import { CreativeActivationCanvas } from './CreativeActivationCanvas';
import { KonvaCanvas } from './KonvaCanvas';
import type Konva from 'konva';
import { CreativeToolbar, BackgroundToolbar } from './CreativeToolbar';
import { KeyboardCheatsheet } from './KeyboardCheatsheet';
import { PagesPanel } from './PagesPanel';
import { copyLayersToClipboard, pasteLayersFromClipboard } from './lib/clipboard';
import { GeneratingImageCard } from '@/components/ui/GeneratingImageCard';
import { exportCanvasAsPng } from './lib/exportPng';
import { captureCanvasThumbnail } from './lib/captureThumbnail';
import { getPreviewDimensions } from './lib/formatDimensions';
import { isPersistedId } from './lib/layerUtils';
import { createPortal } from 'react-dom';
import { useShellHeader } from '@/components/shell/ShellHeaderContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const CreativeStudio: React.FC = () => {
  // Portal das ações do editor pra AppSpine (espinha única). Ver return.
  const shellHeader = useShellHeader();
  // State — atomic selectors so each field re-renders only when it changes.
  const status = useCreativeStore((s) => s.status);
  const format = useCreativeStore((s) => s.format);
  const brandId = useCreativeStore((s) => s.brandId);
  const selectedLayerIds = useCreativeStore((s) => s.selectedLayerIds);
  const pages = useCreativeStore((s) => s.pages);
  const activePageIndex = useCreativeStore((s) => s.activePageIndex);
  const backgroundSelected = useCreativeStore((s) => s.backgroundSelected);
  const activeTool = useCreativeStore((s) => s.activeTool);
  const creativeId = useCreativeStore((s) => s.creativeId);
  const projectName = useCreativeStore((s) => s.projectName);
  const prompt = useCreativeStore((s) => s.prompt);
  const layers = useCreativeStore((s) => s.layers);
  const overlay = useCreativeStore((s) => s.overlay);
  const backgroundUrl = useCreativeStore((s) => s.backgroundUrl);

  // Actions — stable identity in zustand, picking individually never re-renders.
  const removeLayer = useCreativeStore((s) => s.removeLayer);
  const setSelectedLayerIds = useCreativeStore((s) => s.setSelectedLayerIds);
  const setStatus = useCreativeStore((s) => s.setStatus);
  const groupSelected = useCreativeStore((s) => s.groupSelected);
  const ungroupSelected = useCreativeStore((s) => s.ungroupSelected);
  const setActiveTool = useCreativeStore((s) => s.setActiveTool);

  const { undo, redo } = useCreativeStore.temporal.getState();
  const { colors, allGuidelines } = useBrandKit();

  const canvasRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewSize, setPreviewSize] = React.useState({ width: 0, height: 0 });
  const [cheatsheetOpen, setCheatsheetOpen] = React.useState(false);

  const currentGuideline = allGuidelines.find((g) => g.id === brandId);
  const accentColor = currentGuideline?.colors?.[0]?.hex ?? colors[0]?.hex ?? '#00e5ff';
  const defaultFont = currentGuideline?.typography?.[0]?.family ?? 'Inter, sans-serif';

  // Espelha a marca do studio no BrandKit (toolbar swatches/fonts). Inclui o
  // caso null: sem isso, abrir um projeto sem marca — ou trocar de marca —
  // deixava os tokens da marca anterior ativos (fonte fantasma / dessync).
  const { setLinkedGuidelineId } = useCanvasHeader();
  useEffect(() => {
    setLinkedGuidelineId(brandId ?? null);
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

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        }
        if ((e.shiftKey && e.key === 'z') || e.key === 'y') {
          e.preventDefault();
          redo();
        }
        if (e.key === 'd' && selectedLayerIds.length > 0) {
          e.preventDefault();
          const { duplicateLayer } = useCreativeStore.getState();
          selectedLayerIds.forEach((id) => duplicateLayer(id));
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
        if (e.key === 'c' && selectedLayerIds.length > 0) {
          e.preventDefault();
          void copyLayersToClipboard(selectedLayerIds);
        }
        if (e.key === 'v') {
          e.preventDefault();
          pasteLayersFromClipboard().then((newIds) => {
            if (newIds.length) setSelectedLayerIds(newIds);
          });
        }
        if (e.key === 'a') {
          e.preventDefault();
          const all = useCreativeStore
            .getState()
            .layers.filter((l) => !l.locked)
            .map((l) => l.id);
          setSelectedLayerIds(all);
        }
        // Page navigation: Ctrl+] / Ctrl+[ — next / prev page
        if (e.key === ']' && !e.shiftKey) {
          e.preventDefault();
          const {
            activePageIndex: idx,
            pages: pgs,
            setActivePageIndex: setIdx,
          } = useCreativeStore.getState();
          if (idx + 1 < pgs.length) setIdx(idx + 1);
        }
        if (e.key === '[' && !e.shiftKey) {
          e.preventDefault();
          const { activePageIndex: idx, setActivePageIndex: setIdx } = useCreativeStore.getState();
          if (idx > 0) setIdx(idx - 1);
        }
        // Ctrl+Shift+D — duplicate current page (different from Ctrl+D = duplicate layer)
        if (e.key === 'D' && e.shiftKey) {
          e.preventDefault();
          const { activePageIndex: idx, duplicatePage: dup } = useCreativeStore.getState();
          dup(idx);
          toast.info('Página duplicada');
        }
      }

      if (e.key === 'Escape' && selectedLayerIds.length > 0) {
        setSelectedLayerIds([]);
      }

      // Cheatsheet — '?' (= shift+/ on most layouts)
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setCheatsheetOpen((v) => !v);
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLayerIds.length > 0) {
        e.preventDefault();
        // Respeita o lock (igual ao arrow-nudge e ao drag no canvas).
        const lockedIds = new Set(
          useCreativeStore
            .getState()
            .layers.filter((l) => l.locked)
            .map((l) => l.id)
        );
        selectedLayerIds.forEach((id) => {
          if (!lockedIds.has(id)) removeLayer(id);
        });
      }

      // Arrow nudge — 1px (default) / 10px (shift). Skips locked layers.
      if (
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown') &&
        selectedLayerIds.length > 0
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const { layers: cur, updateLayer } = useCreativeStore.getState();
        const w = previewSize.width || 1;
        const h = previewSize.height || 1;
        cur.forEach((l) => {
          if (!selectedLayerIds.includes(l.id) || l.locked) return;
          updateLayer(l.id, {
            position: {
              x: Math.max(0, Math.min(1, l.data.position.x + dx / w)),
              y: Math.max(0, Math.min(1, l.data.position.y + dy / h)),
            },
          } as any);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    undo,
    redo,
    selectedLayerIds,
    setSelectedLayerIds,
    removeLayer,
    groupSelected,
    ungroupSelected,
    previewSize.width,
    previewSize.height,
  ]);

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
    () => ({
      projectName,
      prompt,
      format,
      brandId,
      backgroundUrl,
      overlay,
      layers,
      pages,
      activePageIndex,
    }),
    [projectName, prompt, format, brandId, backgroundUrl, overlay, layers, pages, activePageIndex]
  );

  const queryClient = useQueryClient();
  // Cancel any in-flight save when a newer one starts — last-write wins, no
  // wasted requests when the user is mid-edit.
  const saveAbortRef = useRef<AbortController | null>(null);
  const { status: autoSaveStatus, lastSavedAt } = useAutoSave({
    data: autoSaveData,
    enabled: isEditing,
    debounceMs: 2000,
    onSave: async () => {
      saveAbortRef.current?.abort();
      const controller = new AbortController();
      saveAbortRef.current = controller;
      const { signal } = controller;

      try {
        const thumbnailUrl = await handleCaptureThumbnail();
        if (signal.aborted) return;

        const { setCreativeId } = useCreativeStore.getState();
        const currentId = useCreativeStore.getState().creativeId;
        const persisted = isPersistedId(currentId);

        if (persisted) {
          // Sobe qualquer bg `blob:` pro R2 antes de gravar, senão o servidor
          // guarda uma URL morta (imagem some no reload).
          await ensurePersistedBackground();
          if (signal.aborted) return;
          await creativeProjectApi.update(
            currentId as string,
            { ...snapshotCreativeFromStore(), thumbnailUrl },
            { signal }
          );
        } else {
          const project = await saveCurrentCreativeAsNew(undefined, thumbnailUrl, { signal });
          if (!signal.aborted) setCreativeId(project.id);
        }
        if (!signal.aborted) {
          queryClient.invalidateQueries({ queryKey: CREATIVE_PROJECT_KEYS.lists });
        }
      } catch (err: any) {
        // Aborts are expected when newer save supersedes — don't surface as error.
        if (err?.name === 'AbortError' || signal.aborted) return;
        throw err;
      }
    },
  });

  useEffect(() => () => saveAbortRef.current?.abort(), []);

  return (
    <div className="flex h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3.5rem)] bg-black overflow-hidden select-none">
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

      <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950/50">
        {/* Ações do editor teleportadas pra AppSpine (espinha única do app). O
            "voltar" e o título "Creative Studio" já vivem na espinha — o
            breadcrumb próprio era um segundo header. Plano APP-SPINE F2. */}
        {status === 'editing' &&
          shellHeader?.actionsSlot &&
          createPortal(
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTool(activeTool === 'lasso' ? 'select' : 'lasso')}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-[0.1em] transition-colors flex items-center gap-2',
                  activeTool === 'lasso'
                    ? 'border-brand-cyan/60 bg-brand-cyan/20 text-brand-cyan'
                    : 'border-white/10 bg-neutral-900/60 text-neutral-400 hover:text-white hover:border-white/20'
                )}
                title="Laço — selecionar região para editar com IA"
              >
                <Scan size={12} /> Laço
              </button>
              <button
                onClick={() => setStatus('setup')}
                className="px-4 py-1.5 rounded-full border border-brand-cyan/20 bg-brand-cyan/5 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-cyan hover:bg-brand-cyan/20 hover:border-neutral-700 transition-colors flex items-center gap-2"
              >
                <Diamond size={12} /> Gerar Novo
              </button>
            </div>,
            shellHeader.actionsSlot
          )}

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
            <GeneratingImageCard isLoading variant="overlay" className="z-50" />
          )}

          {status === 'setup' && <CreativeActivationCanvas />}

          {/* ── Single canvas — viewport drives multi-page via active page ── */}
          {status === 'editing' && previewSize.width > 0 && (
            <div className="flex items-center justify-center py-12">
              <KonvaCanvas
                ref={canvasRef}
                width={previewSize.width}
                height={previewSize.height}
                accentColor={accentColor}
                defaultFont={defaultFont}
                onOpenCheatsheet={() => setCheatsheetOpen(true)}
              />
            </div>
          )}

          {status === 'editing' && backgroundSelected && (
            <BackgroundToolbar onEditAI={() => useCreativeStore.getState().setStatus('setup')} />
          )}
          {status === 'editing' && <CreativeToolbar />}
        </div>

        {status === 'editing' && <PagesPanel />}
      </main>

      <KeyboardCheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />
    </div>
  );
};

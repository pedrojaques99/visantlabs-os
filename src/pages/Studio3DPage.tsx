import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  Suspense,
  useSyncExternalStore,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { ControlsPanel } from '@/components/3d-studio/ControlsPanel';

const SceneCanvas = React.lazy(() =>
  import('@/components/3d-studio/SceneCanvas').then((m) => ({ default: m.SceneCanvas }))
);
import { useStudio3DStore, saveScene, shareScene } from '@/stores/studio3dStore';
import {
  exportPNG,
  exportVideo,
  exportGLB,
  exportOBJ,
  exportTurntable,
  exportVideoServerSide,
} from '@/components/3d-studio/ExportManager';
import { ExportModal } from '@/components/shared/ExportModal';
import type { VideoFormat } from '@/utils/videoExport';
import type { SceneHandle } from '@/components/3d-studio/engine/useSceneRef';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useTranslation } from '@/hooks/useTranslation';
import {
  setCameraView,
  resetCamera,
  dollyCamera,
  rotateCamera,
  DEG15,
} from '@/components/3d-studio/CameraBridge';
import { usePasteImage } from '@/hooks/usePasteImage';
import {
  Upload,
  Type,
  Keyboard,
  X,
  Undo2,
  Redo2,
  RotateCcw,
  Download,
  PanelRightOpen,
  Eye,
  Box,
  Maximize2,
  Minimize2,
  Share2,
} from 'lucide-react';
import { CanvasErrorBoundary } from '@/components/shared/CanvasErrorBoundary';
import { useIsMobile } from '@/hooks/use-media-query';

export const Studio3DPage: React.FC = () => {
  const { t } = useTranslation();
  const store = useStudio3DStore;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const svgData = store((s) => s.svgData);
  const text = store((s) => s.text);
  const inputMode = store((s) => s.inputMode);
  const modelUrl = store((s) => s.modelUrl);
  const isEmpty = inputMode === 'svg' ? !svgData : inputMode === 'text' ? !text : !modelUrl;

  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const panelVisible = store((s) => s.panelVisible);
  const setPanelVisible = store((s) => s.setPanelVisible);
  const resetScene = store((s) => s.resetScene);
  const material = store((s) => s.material);
  const depth = store((s) => s.depth);
  const animate = store((s) => s.animate);
  const fileName = store((s) => s.fileName);
  const shaderEnabled = store((s) => s.shaderEnabled);
  const shaderType = store((s) => s.shaderType);
  const cameraInfo = store((s) => s._cameraInfo);
  const videoDuration = store((s) => s.videoDuration);
  const videoFps = store((s) => s.videoFps);
  const shadow = store((s) => s.shadow);
  const groundPlane = store((s) => s.groundPlane);
  const showGrid = store((s) => s.showGrid);
  const [scenePopover, setScenePopover] = useState(false);

  useEffect(() => {
    const sceneId = searchParams.get('sceneId');
    if (!sceneId) return;
    const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
    fetch(`${API_BASE}/studio3d/${sceneId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.scene) return;
        const { config, svgData, inputMode, text, font } = data.scene;
        if (config) store.getState().applyConfig(config);
        if (svgData) store.getState().setSvgData(svgData, data.scene.name || '');
        if (inputMode) store.getState().applyConfig({ inputMode });
        if (text) store.getState().applyConfig({ text });
        if (font) store.getState().applyConfig({ font });
        toast.success(`Scene "${data.scene.name}" loaded`);
      })
      .catch(() => toast.error('Failed to load scene'));
    setSearchParams({}, { replace: true });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);
  const handleSceneReady = useCallback((handle: SceneHandle) => {
    sceneHandleRef.current = handle;
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    const s = store.getState();
    s.setIsExporting(true);
    const shader = s.shaderEnabled ? s.getShaderSettings() : undefined;
    try {
      const canvas = canvasRef.current;
      const name = s.fileName?.replace(/\.[^.]+$/, '') || '3d-export';
      switch (s.exportFormat) {
        case 'png':
          await exportPNG(
            canvas,
            s.aspectRatio,
            s.exportResolution,
            s.transparentBg,
            s.background,
            name,
            shader
          );
          break;
        case 'webm':
          await exportVideo(canvas, s.videoDuration, name, (p) => s.setExportProgress(p), shader);
          break;
        case 'glb':
          if (!sceneHandleRef.current) throw new Error('Scene not ready');
          await exportGLB(sceneHandleRef.current.scene, name);
          break;
        case 'obj':
          if (!sceneHandleRef.current) throw new Error('Scene not ready');
          await exportOBJ(sceneHandleRef.current.scene, name);
          break;
        case 'turntable': {
          const prevAnim = s.animate;
          const prevSpeed = s.animateSpeed;
          const turntableDuration = s.videoDuration;
          const turntableSpeed = (2 * Math.PI) / turntableDuration;
          store.setState({ animate: 'spin', animateSpeed: turntableSpeed, animateReverse: false });
          await new Promise((r) => setTimeout(r, 100));
          await exportTurntable(
            canvas,
            turntableDuration,
            name,
            (p) => s.setExportProgress(p),
            shader
          );
          store.setState({ animate: prevAnim, animateSpeed: prevSpeed });
          break;
        }
      }
      toast.success(t('studio3d.export.exported', { format: s.exportFormat.toUpperCase() }));
    } catch {
      toast.error(t('studio3d.export.exportFailed'));
    } finally {
      s.setIsExporting(false);
    }
  }, []);

  const getShaderSettings = useCallback(() => {
    const s = store.getState();
    return s.shaderEnabled ? s.getShaderSettings() : undefined;
  }, []);

  const handleVideoExport = useCallback(
    async (fmt: VideoFormat, onProgress: (pct: number) => void) => {
      if (!canvasRef.current) throw new Error('No canvas');
      const s = store.getState();
      const shader = s.shaderEnabled ? s.getShaderSettings() : undefined;
      return exportVideoServerSide(
        canvasRef.current,
        s.videoDuration,
        fmt,
        onProgress,
        shader,
        s.videoFps
      );
    },
    []
  );

  const { undo, redo } = store.temporal.getState();
  const canUndo = useSyncExternalStore(
    store.temporal.subscribe,
    () => store.temporal.getState().pastStates.length > 0
  );
  const canRedo = useSyncExternalStore(
    store.temporal.subscribe,
    () => store.temporal.getState().futureStates.length > 0
  );
  const undoCount = useSyncExternalStore(
    store.temporal.subscribe,
    () => store.temporal.getState().pastStates.length
  );
  const redoCount = useSyncExternalStore(
    store.temporal.subscribe,
    () => store.temporal.getState().futureStates.length
  );

  const undoWithFeedback = useCallback(() => {
    undo();
    toast('Undo', { duration: 1000 });
  }, [undo]);
  const redoWithFeedback = useCallback(() => {
    redo();
    toast('Redo', { duration: 1000 });
  }, [redo]);

  useToolEditorHotkeys({
    onExport: () => setExportModalOpen(true),
    panelVisible,
    setPanelVisible,
    undo: undoWithFeedback,
    redo: redoWithFeedback,
  });

  // Camera shortcuts (3D-specific)
  const camOpts = { enableOnFormTags: false as const };
  useHotkeys('1', () => setCameraView('front'), camOpts);
  useHotkeys('3', () => setCameraView('right'), camOpts);
  useHotkeys('7', () => setCameraView('top'), camOpts);
  useHotkeys('9', () => setCameraView('back'), camOpts);
  useHotkeys('5', () => setCameraView('iso'), camOpts);
  useHotkeys('home', () => resetCamera(), camOpts);
  useHotkeys('equal', () => dollyCamera(2), camOpts);
  useHotkeys('minus', () => dollyCamera(-2), camOpts);
  useHotkeys('left', () => rotateCamera(-DEG15, 0), camOpts);
  useHotkeys('right', () => rotateCamera(DEG15, 0), camOpts);
  useHotkeys('up', () => rotateCamera(0, -DEG15), camOpts);
  useHotkeys('down', () => rotateCamera(0, DEG15), camOpts);
  useHotkeys('f', () => store.getState().setShowStats(!store.getState().showStats), camOpts);
  useHotkeys('shift+/', () => setShowShortcuts((v) => !v), camOpts);

  const prevAnimRef = useRef(animate !== 'none' ? animate : 'spin');
  useHotkeys(
    'space',
    (e) => {
      e.preventDefault();
      const s = store.getState();
      if (s.animate !== 'none') {
        prevAnimRef.current = s.animate;
        s.setAnimate('none');
        toast('Paused', { duration: 800 });
      } else {
        s.setAnimate(prevAnimRef.current || 'spin');
        toast('Playing', { duration: 800 });
      }
    },
    camOpts
  );

  const captureThumb = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return undefined;
    const t = document.createElement('canvas');
    const size = 80;
    const ratio = Math.min(size / c.width, size / c.height, 1);
    t.width = Math.round(c.width * ratio);
    t.height = Math.round(c.height * ratio);
    t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
    return t.toDataURL('image/jpeg', 0.6);
  }, []);

  useHotkeys(
    'mod+s',
    async (e) => {
      e.preventDefault();
      const s = store.getState();
      const name = s._sceneName || s.fileName || 'Untitled';
      const scene = await saveScene(name, captureThumb());
      if (scene) toast.success('Scene saved');
      else toast.error('Failed to save scene');
    },
    { enableOnFormTags: true, preventDefault: true }
  );

  useEffect(() => {
    const handlePasteSvgText = async (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!text.includes('<svg')) return;

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) return;
        }
      }

      e.preventDefault();
      e.stopPropagation();
      const s = store.getState();
      s.setIsLoading(true);
      try {
        const { optimizeSvgRemote } = await import('@/components/3d-studio/PngToSvgConverter');
        const svg = await optimizeSvgRemote(text);
        s.setSvgData(svg, 'clipboard.svg');
        toast.success('SVG pasted from clipboard', { description: 'Optimized and loaded' });
      } catch {
        s.setSvgData(text, 'clipboard.svg');
        toast.success('SVG pasted from clipboard', { description: 'Loaded without optimization' });
      } finally {
        s.setIsLoading(false);
      }
    };
    window.addEventListener('paste', handlePasteSvgText);
    return () => window.removeEventListener('paste', handlePasteSvgText);
  }, [t]);

  usePasteImage(
    useCallback(
      async ({ file }) => {
        if (!file) return;
        const s = store.getState();
        if (file.type === 'image/svg+xml') {
          s.setSvgData(await file.text(), file.name || 'pasted.svg');
          toast.success(t('studio3d.input.loaded', { fileName: file.name || 'pasted.svg' }));
        } else if (file.type.startsWith('image/')) {
          s.setIsLoading(true);
          try {
            const { pngToSvg } = await import('@/components/3d-studio/PngToSvgConverter');
            const svg = await pngToSvg(file);
            s.setSvgData(svg, file.name || 'pasted.png');
            toast.success(t('studio3d.input.converted', { fileName: file.name || 'pasted.png' }));
          } catch {
            toast.error(t('studio3d.input.processFailed'));
          } finally {
            s.setIsLoading(false);
          }
        }
      },
      [t]
    )
  );

  const handleViewportDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const s = store.getState();
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      s.setSvgData(await file.text(), file.name);
      toast.success(t('studio3d.input.loaded', { fileName: file.name }));
    } else if (file.name.match(/\.(glb|gltf)$/i)) {
      const url = URL.createObjectURL(file);
      s.setModelUrl(url, file.name);
      toast.success(t('studio3d.input.loaded', { fileName: file.name }));
    } else if (file.type.startsWith('image/')) {
      s.setIsLoading(true);
      try {
        const { pngToSvg } = await import('@/components/3d-studio/PngToSvgConverter');
        s.setSvgData(await pngToSvg(file), file.name);
        toast.success(t('studio3d.input.converted', { fileName: file.name }));
      } catch {
        toast.error(t('studio3d.input.processFailed'));
      } finally {
        s.setIsLoading(false);
      }
    }
  }, []);

  const statusItems = [
    { label: material },
    { label: `depth ${depth}` },
    { label: animate !== 'none' ? animate : 'static' },
    ...(shaderEnabled ? [{ label: shaderType, color: 'text-cyan-400' }] : []),
    ...(cameraInfo?.view ? [{ label: cameraInfo.view, color: 'text-cyan-400' }] : []),
    ...(cameraInfo
      ? [
          { label: `${cameraInfo.polar}° / ${cameraInfo.azimuth}°` },
          { label: `d:${cameraInfo.distance}` },
        ]
      : []),
  ];

  return (
    <>
      <ToolEditorShell
        title={t('studio3d.title')}
        documentTitle="3D Studio — Visant"
        panelVisible={panelVisible}
        setPanelVisible={setPanelVisible}
        onReset={resetScene}
        resetTitle={t('studio3d.resetScene')}
        resetMessage={t('studio3d.resetConfirmMessage')}
        resetConfirmText={t('studio3d.resetConfirmButton')}
        undo={{ handler: () => undo(), disabled: !canUndo }}
        redo={{ handler: () => redo(), disabled: !canRedo }}
        controlsPanel={<ControlsPanel onExport={() => setExportModalOpen(true)} />}
        controlsPanelWidth={300}
        mobileSheetLabel={t('studio3d.controls')}
        statusItems={statusItems}
        fileName={fileName}
        isDragOver={isDragOver}
        hideTopBar
        canvasClassName="absolute inset-0 transition-all duration-300"
        dragProps={{
          onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(true);
          },
          onDragLeave: () => setIsDragOver(false),
          onDrop: handleViewportDrop,
        }}
        dropMessage={t('studio3d.dropHere')}
      >
        {/* Floating left toolbar */}
        <div
          className={cn(
            'absolute left-3 top-3 z-20 flex flex-col gap-1 bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-1.5 shadow-2xl shadow-black/50',
            isMobile && 'left-2 top-2 p-1'
          )}
        >
          <button
            onClick={() => setPanelVisible(!panelVisible)}
            title={t('studio3d.controls')}
            className={cn(
              'flex items-center justify-center rounded-lg transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9',
              panelVisible
                ? 'bg-white/10 text-white ring-1 ring-white/30'
                : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5'
            )}
          >
            <PanelRightOpen size={isMobile ? 18 : 15} />
          </button>

          <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

          <button
            onClick={undoWithFeedback}
            disabled={!canUndo}
            title={`Undo (Ctrl+Z)${undoCount ? ` · ${undoCount}` : ''}`}
            className={cn(
              'relative flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            <Undo2 size={isMobile ? 18 : 15} />
            {undoCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-white/10 text-[8px] font-mono text-neutral-400 px-0.5">{undoCount}</span>
            )}
          </button>
          <button
            onClick={redoWithFeedback}
            disabled={!canRedo}
            title={`Redo (Ctrl+Shift+Z)${redoCount ? ` · ${redoCount}` : ''}`}
            className={cn(
              'relative flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            <Redo2 size={isMobile ? 18 : 15} />
            {redoCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-white/10 text-[8px] font-mono text-neutral-400 px-0.5">{redoCount}</span>
            )}
          </button>

          <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

          <button
            onClick={resetScene}
            title={t('studio3d.resetScene')}
            className={cn(
              'flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            <RotateCcw size={isMobile ? 18 : 15} />
          </button>
          <button
            onClick={() => setExportModalOpen(true)}
            title="Export (Shift+E)"
            className={cn(
              'flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            <Download size={isMobile ? 18 : 15} />
          </button>
          <button
            onClick={async () => {
              const s = store.getState();
              const name = s._sceneName || s.fileName || 'Untitled';
              const url = await shareScene(name, captureThumb());
              if (url) {
                await navigator.clipboard.writeText(url);
                toast.success('Share link copied!');
              } else {
                toast.error('Failed to create share link');
              }
            }}
            title="Share link"
            className={cn(
              'flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            <Share2 size={isMobile ? 18 : 15} />
          </button>
          <button
            onClick={toggleFullscreen}
            title="Fullscreen"
            className={cn(
              'flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all',
              isMobile ? 'w-11 h-11' : 'w-9 h-9'
            )}
          >
            {isFullscreen ? (
              <Minimize2 size={isMobile ? 18 : 15} />
            ) : (
              <Maximize2 size={isMobile ? 18 : 15} />
            )}
          </button>

          <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

          <div className="relative">
            <button
              onClick={() => setScenePopover((v) => !v)}
              title="Scene options"
              className={cn(
                'flex items-center justify-center rounded-lg transition-all',
                isMobile ? 'w-11 h-11' : 'w-9 h-9',
                scenePopover
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5'
              )}
            >
              <Eye size={isMobile ? 18 : 15} />
            </button>
            {scenePopover && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  role="button"
                  tabIndex={-1}
                  aria-label="Close popover"
                  onClick={() => setScenePopover(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setScenePopover(false);
                  }}
                />
                <div className="absolute left-full top-0 ml-2 z-40 bg-neutral-950/95 backdrop-blur-xl border border-neutral-800/60 rounded-lg p-2 shadow-2xl shadow-black/50 min-w-[140px] space-y-0.5">
                  {(
                    [
                      {
                        label: 'Shadows',
                        active: shadow,
                        toggle: () => store.getState().setShadow(!shadow),
                      },
                      {
                        label: 'Ground',
                        active: groundPlane,
                        toggle: () => store.getState().setGroundPlane(!groundPlane),
                      },
                      {
                        label: 'Grid',
                        active: showGrid,
                        toggle: () => store.getState().setShowGrid(!showGrid),
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.label}
                      onClick={item.toggle}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors',
                        item.active
                          ? 'text-white bg-white/10'
                          : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/5'
                      )}
                    >
                      {item.label}
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          item.active ? 'bg-emerald-400' : 'bg-neutral-700'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {!isMobile && (
            <>
              <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />
              <button
                onClick={() => setShowShortcuts((v) => !v)}
                title="Keyboard shortcuts (?)"
                className="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all"
              >
                <Keyboard size={15} />
              </button>
            </>
          )}
        </div>

        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-neutral-950">
              <span className="text-[10px] uppercase tracking-widest text-neutral-600 animate-pulse">
                {t('studio3d.loadingEngine')}
              </span>
            </div>
          }
        >
          <CanvasErrorBoundary>
            <SceneCanvas onCanvasReady={handleCanvasReady} onSceneReady={handleSceneReady} />
          </CanvasErrorBoundary>
        </Suspense>
        {showShortcuts && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
            role="presentation"
          >
            <div
              className="bg-neutral-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white uppercase tracking-wider">
                  {t('studio3d.shortcuts.title')}
                </h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="text-neutral-500 hover:text-white transition-colors"
                  aria-label="Close shortcuts"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1 text-[11px]">
                {[
                  ['1 / 3 / 7 / 9', 'Front / Right / Top / Back'],
                  ['5', 'Isometric view'],
                  ['Home', 'Reset camera'],
                  ['+ / -', 'Zoom in / out'],
                  ['Drag', 'Orbit / Rotate'],
                  ['Shift+Drag', 'Pan'],
                  ['Arrow keys', 'Orbit camera'],
                  ['F', 'Toggle FPS stats'],
                  ['Ctrl+Z', 'Undo'],
                  ['Ctrl+Shift+Z', 'Redo'],
                  ['Ctrl+S', 'Save scene'],
                  ['Ctrl+E', 'Export'],
                  ['Space', 'Play / Pause animation'],
                  ['Ctrl+\\', 'Toggle panel'],
                  ['?', 'This dialog'],
                ].map(([key, desc]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1 border-b border-neutral-800 last:border-0"
                  >
                    <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono text-[10px]">
                      {key}
                    </kbd>
                    <span className="text-neutral-400">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </ToolEditorShell>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        canvasRef={canvasRef}
        filenamePrefix={`3d-studio_${fileName?.replace(/\.[^.]+$/, '') || 'export'}`}
        getShaderSettings={getShaderSettings}
        isVideo={animate !== 'none'}
        videoDuration={videoDuration}
        videoFps={videoFps}
        onVideoDurationChange={(d) => store.getState().setVideoDuration(d)}
        onVideoFpsChange={(fps) => store.getState().setVideoFps(fps)}
        onExportVideo={animate !== 'none' ? handleVideoExport : undefined}
        onExportScaled={(scale) => {
          const source = canvasRef.current;
          if (!source) return undefined;
          const s = store.getState();
          const scaled = document.createElement('canvas');
          scaled.width = Math.round(source.width * scale);
          scaled.height = Math.round(source.height * scale);
          const ctx = scaled.getContext('2d');
          if (!ctx) return undefined;
          if (!s.transparentBg) {
            ctx.fillStyle = s.background;
            ctx.fillRect(0, 0, scaled.width, scaled.height);
          }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(source, 0, 0, scaled.width, scaled.height);
          return scaled;
        }}
      />
    </>
  );
};

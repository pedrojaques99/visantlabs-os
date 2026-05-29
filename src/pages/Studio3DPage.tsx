import React, { useRef, useCallback, useState, useEffect, Suspense, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { ControlsPanel } from '@/components/3d-studio/ControlsPanel';

const SceneCanvas = React.lazy(() => import('@/components/3d-studio/SceneCanvas').then(m => ({ default: m.SceneCanvas })));
import { useStudio3DStore } from '@/stores/studio3dStore';
import { exportPNG, exportVideo, exportGLB, exportOBJ, exportTurntable, exportVideoServerSide } from '@/components/3d-studio/ExportManager';
import { ExportModal } from '@/components/shared/ExportModal';
import type { VideoFormat } from '@/utils/videoExport';
import type { SceneHandle } from '@/components/3d-studio/engine/useSceneRef';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useTranslation } from '@/hooks/useTranslation';
import { setCameraView, resetCamera, dollyCamera, rotateCamera, DEG15 } from '@/components/3d-studio/CameraBridge';
import { usePasteImage } from '@/hooks/usePasteImage';
import { Upload, Type, Keyboard, X, Undo2, Redo2, RotateCcw, Download, PanelRightOpen, Eye, Box, Maximize2, Minimize2 } from 'lucide-react';
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

  useEffect(() => {
    const sceneId = searchParams.get('sceneId');
    if (!sceneId) return;
    const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
    fetch(`${API_BASE}/studio3d/${sceneId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
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

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => { canvasRef.current = canvas; }, []);
  const handleSceneReady = useCallback((handle: SceneHandle) => { sceneHandleRef.current = handle; }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    const s = store.getState();
    s.setIsExporting(true);
    const shader = s.shaderEnabled ? s.getShaderSettings() : undefined;
    try {
      const canvas = canvasRef.current;
      const name = s.fileName?.replace(/\.[^.]+$/, '') || '3d-export';
      switch (s.exportFormat) {
        case 'png': await exportPNG(canvas, s.aspectRatio, s.exportResolution, s.transparentBg, s.background, name, shader); break;
        case 'webm': await exportVideo(canvas, s.videoDuration, name, (p) => s.setExportProgress(p), shader); break;
        case 'glb':
          if (!sceneHandleRef.current) throw new Error('Scene not ready');
          await exportGLB(sceneHandleRef.current.scene, name); break;
        case 'obj':
          if (!sceneHandleRef.current) throw new Error('Scene not ready');
          await exportOBJ(sceneHandleRef.current.scene, name); break;
        case 'turntable': {
          const prevAnim = s.animate;
          const prevSpeed = s.animateSpeed;
          const turntableDuration = s.videoDuration;
          const turntableSpeed = (2 * Math.PI) / turntableDuration;
          store.setState({ animate: 'spin', animateSpeed: turntableSpeed, animateReverse: false });
          await new Promise(r => setTimeout(r, 100));
          await exportTurntable(canvas, turntableDuration, name, (p) => s.setExportProgress(p), shader);
          store.setState({ animate: prevAnim, animateSpeed: prevSpeed });
          break;
        }
      }
      toast.success(t('studio3d.export.exported', { format: s.exportFormat.toUpperCase() }));
    } catch { toast.error(t('studio3d.export.exportFailed')); }
    finally { s.setIsExporting(false); }
  }, []);

  const getShaderSettings = useCallback(() => {
    const s = store.getState();
    return s.shaderEnabled ? s.getShaderSettings() : undefined;
  }, []);

  const handleVideoExport = useCallback(async (fmt: VideoFormat, onProgress: (pct: number) => void) => {
    if (!canvasRef.current) throw new Error('No canvas');
    const s = store.getState();
    const shader = s.shaderEnabled ? s.getShaderSettings() : undefined;
    return exportVideoServerSide(canvasRef.current, s.videoDuration, fmt, onProgress, shader);
  }, []);

  const { undo, redo } = store.temporal.getState();
  const canUndo = useSyncExternalStore(
    store.temporal.subscribe,
    () => store.temporal.getState().pastStates.length > 0,
  );
  const canRedo = useSyncExternalStore(
    store.temporal.subscribe,
    () => store.temporal.getState().futureStates.length > 0,
  );

  useToolEditorHotkeys({
    onExport: handleExport,

    panelVisible,
    setPanelVisible,
    undo,
    redo,
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
  useHotkeys('shift+/', () => setShowShortcuts(v => !v), camOpts);

  usePasteImage(useCallback(async ({ file }) => {
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
      } catch { toast.error(t('studio3d.input.processFailed')); }
      finally { s.setIsLoading(false); }
    }
  }, [t]));

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
      } catch { toast.error(t('studio3d.input.processFailed')); }
      finally { s.setIsLoading(false); }
    }
  }, []);

  const statusItems = [
    { label: material },
    { label: `depth ${depth}` },
    { label: animate !== 'none' ? animate : 'static' },
    ...(shaderEnabled ? [{ label: shaderType, color: 'text-cyan-400' }] : []),
    ...(cameraInfo?.view ? [{ label: cameraInfo.view, color: 'text-cyan-400' }] : []),
    ...(cameraInfo ? [{ label: `${cameraInfo.polar}° / ${cameraInfo.azimuth}°` }, { label: `d:${cameraInfo.distance}` }] : []),
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
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); },
        onDragLeave: () => setIsDragOver(false),
        onDrop: handleViewportDrop,
      }}
      dropMessage={t('studio3d.dropHere')}
    >
      {/* Floating left toolbar */}
      <div className={cn('absolute left-3 top-3 z-20 flex flex-col gap-1 bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-1.5 shadow-2xl shadow-black/50', isMobile && 'left-2 top-2 p-1')}>
        <button onClick={() => setPanelVisible(!panelVisible)} title={t('studio3d.controls')} className={cn('flex items-center justify-center rounded-lg transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9', panelVisible ? 'bg-white/10 text-white ring-1 ring-white/30' : 'text-neutral-600 hover:text-neutral-300 hover:bg-white/5')}>
          <PanelRightOpen size={isMobile ? 18 : 15} />
        </button>

        <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

        <button onClick={() => undo()} disabled={!canUndo} title="Undo (Ctrl+Z)" className={cn('flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9')}>
          <Undo2 size={isMobile ? 18 : 15} />
        </button>
        <button onClick={() => redo()} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" className={cn('flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9')}>
          <Redo2 size={isMobile ? 18 : 15} />
        </button>

        <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />

        <button onClick={resetScene} title={t('studio3d.resetScene')} className={cn('flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9')}>
          <RotateCcw size={isMobile ? 18 : 15} />
        </button>
        <button onClick={() => setExportModalOpen(true)} title="Export (Shift+E)" className={cn('flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9')}>
          <Download size={isMobile ? 18 : 15} />
        </button>
        <button onClick={toggleFullscreen} title="Fullscreen" className={cn('flex items-center justify-center rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all', isMobile ? 'w-11 h-11' : 'w-9 h-9')}>
          {isFullscreen ? <Minimize2 size={isMobile ? 18 : 15} /> : <Maximize2 size={isMobile ? 18 : 15} />}
        </button>

        {!isMobile && (
          <>
            <div className="h-px bg-neutral-800/60 mx-1 my-0.5" />
            <button onClick={() => setShowShortcuts(v => !v)} title="Keyboard shortcuts (?)" className="flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-all">
              <Keyboard size={15} />
            </button>
          </>
        )}
      </div>

      <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-neutral-950"><span className="text-[10px] uppercase tracking-widest text-neutral-600 animate-pulse">{t('studio3d.loadingEngine')}</span></div>}>
        <SceneCanvas onCanvasReady={handleCanvasReady} onSceneReady={handleSceneReady} />
      </Suspense>
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} role="presentation">
          <div className="bg-neutral-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white uppercase tracking-wider">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-neutral-500 hover:text-white transition-colors" aria-label="Close shortcuts"><X size={14} /></button>
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
                ['Ctrl+E', 'Export'],
                ['Ctrl+\\', 'Toggle panel'],
                ['?', 'This dialog'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-1 border-b border-neutral-800 last:border-0">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 font-mono text-[10px]">{key}</kbd>
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
      videoDuration={store.getState().videoDuration}
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

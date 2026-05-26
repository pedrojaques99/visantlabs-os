import React, { useRef, useCallback, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { ControlsPanel } from '@/components/3d-studio/ControlsPanel';

const SceneCanvas = React.lazy(() => import('@/components/3d-studio/SceneCanvas').then(m => ({ default: m.SceneCanvas })));
import { useStudio3DStore } from '@/stores/studio3dStore';
import { exportPNG, exportVideo, exportGLB, exportOBJ, exportBatchViews, exportTurntable } from '@/components/3d-studio/ExportManager';
import type { SceneHandle } from '@/components/3d-studio/engine/useSceneRef';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useTranslation } from '@/hooks/useTranslation';
import { setCameraView, resetCamera, dollyCamera, rotateCamera, DEG15 } from '@/components/3d-studio/CameraBridge';
import { usePasteImage } from '@/hooks/usePasteImage';
import { Upload, Type, Keyboard, X } from 'lucide-react';

export const Studio3DPage: React.FC = () => {
  const { t } = useTranslation();
  const store = useStudio3DStore;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneHandleRef = useRef<SceneHandle | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const svgData = store((s) => s.svgData);
  const text = store((s) => s.text);
  const inputMode = store((s) => s.inputMode);
  const modelUrl = store((s) => s.modelUrl);
  const isEmpty = inputMode === 'svg' ? !svgData : inputMode === 'text' ? !text : !modelUrl;

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

  const handleBatchExport = useCallback(async () => {
    if (!canvasRef.current) return;
    const s = store.getState();
    s.setIsExporting(true);
    const shader = s.shaderEnabled ? s.getShaderSettings() : undefined;
    try {
      const name = s.fileName?.replace(/\.[^.]+$/, '') || '3d-export';
      await exportBatchViews(canvasRef.current, s.aspectRatio, s.exportResolution, s.transparentBg, s.background, name, setCameraView, shader);
      toast.success('All views exported');
    } catch { toast.error('Batch export failed'); }
    finally { s.setIsExporting(false); }
  }, []);

  const { undo, redo, pastStates, futureStates } = store.temporal.getState();

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
    <ToolEditorShell
      title={t('studio3d.title')}
      documentTitle="3D Studio — Visant"
      panelVisible={panelVisible}
      setPanelVisible={setPanelVisible}
      onReset={resetScene}
      resetTitle={t('studio3d.resetScene')}
      resetMessage={t('studio3d.resetConfirmMessage')}
      resetConfirmText={t('studio3d.resetConfirmButton')}
      undo={{ handler: () => undo(), disabled: pastStates.length === 0 }}
      redo={{ handler: () => redo(), disabled: futureStates.length === 0 }}
      controlsPanel={<ControlsPanel onExport={handleExport} onBatchExport={handleBatchExport} />}
      controlsPanelWidth={300}
      mobileSheetLabel={t('studio3d.controls')}
      statusItems={statusItems}
      fileName={fileName}
      isDragOver={isDragOver}
      dragProps={{
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); },
        onDragLeave: () => setIsDragOver(false),
        onDrop: handleViewportDrop,
      }}
      dropMessage={t('studio3d.dropHere')}

    >
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center bg-neutral-950"><span className="text-[10px] uppercase tracking-widest text-neutral-600 animate-pulse">{t('studio3d.loadingEngine')}</span></div>}>
        <SceneCanvas onCanvasReady={handleCanvasReady} onSceneReady={handleSceneReady} />
      </Suspense>
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center gap-4 text-neutral-500">
            <Upload size={28} strokeWidth={1.2} />
            <p className="text-[11px] uppercase tracking-widest">{t('studio3d.dropHere')}</p>
            <div className="flex gap-4 mt-2 text-[10px] text-neutral-600 font-mono uppercase tracking-wider">
              <span>{t('studio3d.input.views')}</span>
              <span>{t('studio3d.input.orbit')}</span>
              <span>{t('studio3d.input.zoom')}</span>
              <span>{t('studio3d.input.reset')}</span>
            </div>
          </div>
        </div>
      )}
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
  );
};

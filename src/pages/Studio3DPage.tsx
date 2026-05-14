import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { SceneCanvas } from '@/components/3d-studio/SceneCanvas';
import { ControlsPanel } from '@/components/3d-studio/ControlsPanel';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { exportPNG, exportVideo } from '@/components/3d-studio/ExportManager';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export const Studio3DPage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const panelVisible = useStudio3DStore((s) => s.panelVisible);
  const setPanelVisible = useStudio3DStore((s) => s.setPanelVisible);
  const resetScene = useStudio3DStore((s) => s.resetScene);
  const setIsExporting = useStudio3DStore((s) => s.setIsExporting);

  const material = useStudio3DStore((s) => s.material);
  const depth = useStudio3DStore((s) => s.depth);
  const animate = useStudio3DStore((s) => s.animate);
  const fileName = useStudio3DStore((s) => s.fileName);
  const shaderEnabled = useStudio3DStore((s) => s.shaderEnabled);
  const shaderType = useStudio3DStore((s) => s.shaderType);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    const store = useStudio3DStore.getState();
    setIsExporting(true);

    const shader = store.shaderEnabled ? store.getShaderSettings() : undefined;

    try {
      const canvas = canvasRef.current;
      const name = store.fileName?.replace(/\.[^.]+$/, '') || '3d-export';

      switch (store.exportFormat) {
        case 'png':
          await exportPNG(canvas, store.aspectRatio, store.exportResolution, store.transparentBg, store.background, name, shader);
          break;
        case 'mp4':
        case 'gif':
          await exportVideo(canvas, store.videoDuration, name, undefined, shader);
          break;
      }
      toast.success(`${store.exportFormat.toUpperCase()} exported`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed — try again');
    } finally {
      setIsExporting(false);
    }
  }, [setIsExporting]);

  const handleReset = useCallback(() => {
    resetScene();
    setConfirmReset(false);
    toast.success('Scene reset');
  }, [resetScene]);

  // Keyboard shortcuts
  useHotkeys('mod+e', (e) => { e.preventDefault(); handleExport(); }, { enableOnFormTags: false });
  useHotkeys('r', () => setConfirmReset(true), { enableOnFormTags: false });
  useHotkeys('mod+\\', () => setPanelVisible(!panelVisible), { enableOnFormTags: false });

  // Drag&drop on entire viewport
  const handleViewportDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const store = useStudio3DStore.getState();
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const text = await file.text();
      store.setSvgData(text, file.name);
      toast.success(`Loaded ${file.name}`);
    } else if (file.type.startsWith('image/')) {
      store.setIsLoading(true);
      try {
        const { pngToSvg } = await import('@/components/3d-studio/PngToSvgConverter');
        const svg = await pngToSvg(file);
        store.setSvgData(svg, file.name);
        toast.success(`Converted ${file.name} to SVG`);
      } catch {
        toast.error('Failed to process image');
      } finally {
        store.setIsLoading(false);
      }
    }
  }, []);

  const containerStyle = useMemo(() => ({
    paddingRight: !isMobile && panelVisible ? 236 : 0,
    paddingBottom: isMobile ? (mobileSheetOpen ? '55%' : 52) : 40,
  }), [isMobile, panelVisible, mobileSheetOpen]);

  return (
    <AppShell>
      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to apps">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => navigate('/apps')}>
                <ChevronLeft size={16} />
              </Button>
            </Tooltip>
            <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono ml-1">
              3D STUDIO
            </span>
          </>
        }
        right={
          <>
            <Tooltip content="Reset scene (R)">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={14} />
              </Button>
            </Tooltip>
            {!isMobile && (
              <Tooltip content={panelVisible ? 'Hide panel (⌘\\)' : 'Show panel (⌘\\)'}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => setPanelVisible(!panelVisible)}>
                  {panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                </Button>
              </Tooltip>
            )}
          </>
        }
      />

      <div
        className="absolute inset-0 pt-10 transition-all duration-300"
        style={containerStyle}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleViewportDrop}
      >
        <SceneCanvas onCanvasReady={handleCanvasReady} />
      </div>

      {!isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={220}>
          <ControlsPanel onExport={handleExport} />
        </AppShellPanel>
      )}

      {isMobile && (
        <div
          className={cn(
            'absolute left-0 right-0 bottom-0 z-20 transition-all duration-300 ease-out',
            mobileSheetOpen ? 'h-[55%]' : 'h-[52px]',
          )}
        >
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="w-full flex items-center justify-center gap-1 py-2 bg-neutral-900/90 backdrop-blur-xl border-t border-white/[0.06] text-neutral-400"
          >
            {mobileSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span className="text-[10px] uppercase tracking-widest">Controls</span>
          </button>
          {mobileSheetOpen && (
            <div className="h-[calc(100%-36px)] bg-neutral-950/95 backdrop-blur-xl overflow-hidden">
              <ControlsPanel onExport={handleExport} />
            </div>
          )}
        </div>
      )}

      {!isMobile && (
        <AppShellStatusBar>
          <span>{material}</span>
          <span>•</span>
          <span>depth {depth}</span>
          <span>•</span>
          <span>{animate !== 'none' ? animate : 'static'}</span>
          {shaderEnabled && (
            <>
              <span>•</span>
              <span className="text-cyan-400">{shaderType}</span>
            </>
          )}
          {fileName && (
            <>
              <span>•</span>
              <span className="max-w-[120px] truncate">{fileName}</span>
            </>
          )}
        </AppShellStatusBar>
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset scene"
        message="All settings will return to defaults. This cannot be undone."
        confirmText="Reset"
        variant="warning"
      />
    </AppShell>
  );
};

import React, { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { SceneCanvas } from '@/components/3d-studio/SceneCanvas';
import { ControlsPanel } from '@/components/3d-studio/ControlsPanel';
import { useStudio3DStore } from '@/stores/studio3dStore';
import { exportPNG, exportVideo } from '@/components/3d-studio/ExportManager';

export const Studio3DPage: React.FC = () => {
  const navigate = useNavigate();
  const store = useStudio3DStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    store.setIsExporting(true);

    try {
      const canvas = canvasRef.current;
      const name = store.fileName?.replace(/\.[^.]+$/, '') || '3d-export';

      switch (store.exportFormat) {
        case 'png':
          await exportPNG(canvas, store.aspectRatio, store.exportResolution, store.transparentBg, store.background, name);
          break;
        case 'mp4':
        case 'gif':
          await exportVideo(canvas, store.videoDuration, name);
          break;
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      store.setIsExporting(false);
    }
  }, [store]);

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
            <Tooltip content="Reset scene">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={store.resetScene}>
                <RotateCcw size={14} />
              </Button>
            </Tooltip>
            <Tooltip content={store.panelVisible ? 'Hide panel' : 'Show panel'}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => store.setPanelVisible(!store.panelVisible)}>
                {store.panelVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>
            </Tooltip>
          </>
        }
      />

      <div className="absolute inset-0 pt-10 pb-10" style={{ paddingRight: store.panelVisible ? 236 : 0 }}>
        <SceneCanvas onCanvasReady={handleCanvasReady} />
      </div>

      <AppShellPanel side="right" visible={store.panelVisible} width={220}>
        <ControlsPanel onExport={handleExport} />
      </AppShellPanel>

      <AppShellStatusBar>
        <span>{store.material}</span>
        <span>•</span>
        <span>depth {store.depth}</span>
        <span>•</span>
        <span>{store.animate !== 'none' ? store.animate : 'static'}</span>
        {store.fileName && (
          <>
            <span>•</span>
            <span className="max-w-[120px] truncate">{store.fileName}</span>
          </>
        )}
      </AppShellStatusBar>
    </AppShell>
  );
};

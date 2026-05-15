import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { HalftoneCanvas } from '@/components/halftone/HalftoneCanvas';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import { useIsMobile } from '@/hooks/use-media-query';

export const HalftonePage: React.FC = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => { document.title = 'CMYK Halftone — Visant'; }, []);

  const panelVisible = useHalftoneStore((s) => s.panelVisible);
  const setPanelVisible = useHalftoneStore((s) => s.setPanelVisible);
  const resetSettings = useHalftoneStore((s) => s.resetSettings);
  const frequency = useHalftoneStore((s) => s.frequency);
  const dotSize = useHalftoneStore((s) => s.dotSize);
  const blendMode = useHalftoneStore((s) => s.blendMode);
  const fileName = useHalftoneStore((s) => s.fileName);
  const shaderEnabled = useHalftoneStore((s) => s.shaderEnabled);
  const shaderType = useHalftoneStore((s) => s.shaderType);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    const store = useHalftoneStore.getState();
    store.setIsExporting(true);
    try {
      let exportCanvas = canvasRef.current;
      if (store.shaderEnabled) {
        exportCanvas = await applyShaderToCanvas(exportCanvas, store.getShaderSettings());
      }
      const blob = await new Promise<Blob>((resolve) => {
        exportCanvas.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `halftone_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PNG exported');
    } catch {
      toast.error('Export failed — try again');
    } finally {
      store.setIsExporting(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    resetSettings();
    setConfirmReset(false);
    toast.success('Settings reset');
  }, [resetSettings]);

  // Keyboard shortcuts
  useHotkeys('mod+e', (e) => { e.preventDefault(); handleExport(); }, { enableOnFormTags: false });
  useHotkeys('r', () => setConfirmReset(true), { enableOnFormTags: false });
  useHotkeys('mod+\\', () => setPanelVisible(!panelVisible), { enableOnFormTags: false });

  // Drag & drop image upload
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    useHalftoneStore.getState().setImageUrl(url, file.name);
    toast.success(`Loaded ${file.name}`);
  }, []);

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
              CMYK HALFTONE
            </span>
          </>
        }
        right={
          <>
            <Tooltip content="Reset settings (R)">
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
            <AppShellLegalMenu />
          </>
        }
      />

      <div
        className="absolute inset-0 pt-10 transition-all duration-300"
        style={{
          paddingRight: !isMobile && panelVisible ? 236 : 0,
          paddingBottom: isMobile ? (mobileSheetOpen ? '45%' : 48) : 40,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <HalftoneCanvas onCanvasReady={handleCanvasReady} />

        {isDragOver && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm border-2 border-dashed border-cyan-500/50 rounded-lg">
            <span className="text-sm text-cyan-400 font-mono uppercase tracking-widest">Drop image here</span>
          </div>
        )}
      </div>

      {!isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={300}>
          <HalftoneControls onExport={handleExport} />
        </AppShellPanel>
      )}

      {isMobile && (
        <div className={cn(
          'absolute left-0 right-0 bottom-0 z-20 transition-transform duration-300 ease-out',
          mobileSheetOpen ? 'h-[45%]' : 'h-[48px]',
        )}>
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="w-full flex items-center justify-center gap-1.5 h-[48px] bg-neutral-900/90 backdrop-blur-xl border-t border-white/[0.06] text-neutral-400 active:bg-neutral-800/90"
          >
            {mobileSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span className="text-[11px] uppercase tracking-widest">Controls</span>
          </button>
          {mobileSheetOpen && (
            <div className="h-[calc(100%-48px)] bg-neutral-950/95 backdrop-blur-xl overflow-y-auto scrollbar-none">
              <HalftoneControls onExport={handleExport} />
            </div>
          )}
        </div>
      )}

      {!isMobile && (
        <AppShellStatusBar>
          <span>freq {frequency}</span>
          <span>•</span>
          <span>dot {dotSize.toFixed(2)}</span>
          <span>•</span>
          <span>{['subtractive', 'additive', 'normal'][blendMode]}</span>
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
        title="Reset settings"
        message="All halftone settings will return to defaults. This cannot be undone."
        confirmText="Reset"
        variant="warning"
      />
    </AppShell>
  );
};

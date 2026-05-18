import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { AppShellMobileSheet } from '@/components/ui/AppShellMobileSheet';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { HalftoneCanvas } from '@/components/halftone/HalftoneCanvas';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import { useIsMobile } from '@/hooks/use-media-query';
import { usePasteImage } from '@/hooks/usePasteImage';
import { useTranslation } from '@/hooks/useTranslation';

export const HalftonePage: React.FC = () => {
  const { t } = useTranslation();
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
      toast.success(t('halftone.png_exported'));
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
  useHotkeys('tab', (e) => { e.preventDefault(); setPanelVisible(!panelVisible); }, { enableOnFormTags: false });

  // Drag & drop image upload
  usePasteImage(useCallback(({ file }) => {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    useHalftoneStore.getState().setImageUrl(url, file.name || 'pasted-image');
    toast.success(t('halftone.loaded_file', { name: file.name || t('halftone.pasted_image') }));
  }, []));

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
    toast.success(t('halftone.loaded_file', { name: file.name }));
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
            <MicroTitle className="text-[10px] text-neutral-600 uppercase tracking-widest ml-1">
              CMYK HALFTONE
            </MicroTitle>
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
              <Tooltip content={panelVisible ? 'Hide panel (Tab)' : 'Show panel (Tab)'}>
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
          paddingRight: !isMobile && panelVisible ? 316 : 0,
          paddingBottom: isMobile ? (mobileSheetOpen ? '45%' : 48) : 40,
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <HalftoneCanvas onCanvasReady={handleCanvasReady} />
        <DropOverlay visible={isDragOver} message={t('halftone.drop_image_here')} />
      </div>

      {!isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={300}>
          <HalftoneControls onExport={handleExport} />
        </AppShellPanel>
      )}

      {isMobile && (
        <AppShellMobileSheet open={mobileSheetOpen} onToggle={() => setMobileSheetOpen(!mobileSheetOpen)}>
          <HalftoneControls onExport={handleExport} />
        </AppShellMobileSheet>
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
        title={t('halftone.reset_settings')}
        message={t('halftone.all_halftone_settings_will_return_to_def')}
        confirmText="Reset"
        variant="warning"
      />
    </AppShell>
  );
};

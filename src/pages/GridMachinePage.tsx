import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { AppShellLegalMenu } from '@/components/ui/AppShellLegalMenu';
import { AppShellMobileSheet } from '@/components/ui/AppShellMobileSheet';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { GridCanvas, type GridCanvasHandle } from '@/components/grid-machine/GridCanvas';
import { GridMachineControls } from '@/components/grid-machine/ControlsPanel';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { analyzeSvg } from '@/components/grid-machine/SvgAnalyzer';
import { useIsMobile } from '@/hooks/use-media-query';
import { usePasteImage } from '@/hooks/usePasteImage';
import { useTranslation } from '@/hooks/useTranslation';

export const GridMachinePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gridRef = useRef<GridCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => { document.title = 'Grid Machine — Visant'; }, []);

  const panelVisible = useGridMachineStore((s) => s.panelVisible);
  const setPanelVisible = useGridMachineStore((s) => s.setPanelVisible);
  const svgContent = useGridMachineStore((s) => s.svgContent);
  const fileName = useGridMachineStore((s) => s.fileName);
  const analysis = useGridMachineStore((s) => s.analysis);
  const setSvg = useGridMachineStore((s) => s.setSvg);
  const setAnalysis = useGridMachineStore((s) => s.setAnalysis);
  const setIsExporting = useGridMachineStore((s) => s.setIsExporting);
  const clear = useGridMachineStore((s) => s.clear);

  const loadSvg = useCallback((content: string, name: string) => {
    setSvg(content, name);
    const result = analyzeSvg(content);
    setAnalysis(result);
    const anchors = result.points.filter(p => p.type === 'anchor').length;
    const handles = result.points.filter(p => p.type === 'handle').length;
    toast.success(t('grid.machine.loaded_name_anchors_anchors_handles_h'));
  }, [setSvg, setAnalysis]);

  usePasteImage(useCallback(async ({ file }) => {
    if (!file) return;
    if (file.type === 'image/svg+xml') {
      const text = await file.text();
      loadSvg(text, file.name || 'pasted.svg');
    }
  }, [loadSvg]));

  useEffect(() => {
    const handlePasteText = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text && text.trimStart().startsWith('<svg')) {
        e.preventDefault();
        loadSvg(text, 'pasted.svg');
      }
    };
    window.addEventListener('paste', handlePasteText);
    return () => window.removeEventListener('paste', handlePasteText);
  }, [loadSvg]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      toast.error(t('grid.machine.please_upload_an_svg_file'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadSvg(reader.result as string, file.name);
    reader.readAsText(file);
    e.target.value = '';
  }, [loadSvg]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      toast.error(t('grid.machine.only_svg_files_are_supported'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadSvg(reader.result as string, file.name);
    reader.readAsText(file);
  }, [loadSvg]);

  const handleExportPng = useCallback(async () => {
    const canvas = gridRef.current?.getCanvas();
    if (!canvas) return;
    setIsExporting(true);
    try {
      const scale = 2;
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width * scale;
      offscreen.height = canvas.height * scale;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve) => {
        offscreen.toBlob((b) => resolve(b!), 'image/png');
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grid-${fileName?.replace(/\.svg$/i, '') || 'export'}_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('grid.machine.png_exported_2x'));
    } catch {
      toast.error(t('grid.machine.export_failed'));
    } finally {
      setIsExporting(false);
    }
  }, [fileName, setIsExporting]);

  const handleExportSvg = useCallback(() => {
    const svg = gridRef.current?.exportSvg();
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grid-${fileName?.replace(/\.svg$/i, '') || 'export'}_${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('grid.machine.svg_exported'));
  }, [fileName]);

  const handleReset = useCallback(() => {
    clear();
    setConfirmReset(false);
    toast.success(t('grid.machine.cleared'));
  }, [clear]);

  useHotkeys('mod+e', (e) => { e.preventDefault(); handleExportPng(); }, { enableOnFormTags: false });
  useHotkeys('r', () => { if (svgContent) setConfirmReset(true); }, { enableOnFormTags: false });
  useHotkeys('tab', (e) => { e.preventDefault(); setPanelVisible(!panelVisible); }, { enableOnFormTags: false });
  useHotkeys('mod+o', (e) => { e.preventDefault(); fileInputRef.current?.click(); }, { enableOnFormTags: false });

  const anchorCount = analysis?.points.filter(p => p.type === 'anchor').length ?? 0;
  const handleCount = analysis?.points.filter(p => p.type === 'handle').length ?? 0;

  return (
    <AppShell>
      <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleFileSelect} />

      <AppShellTopBar
        left={
          <>
            <Tooltip content="Back to apps">
              <Button variant="ghost" size="icon" aria-label="Back to apps" className="h-7 w-7 text-neutral-500" onClick={() => navigate('/apps')}>
                <ChevronLeft size={16} />
              </Button>
            </Tooltip>
            <MicroTitle className="text-[10px] text-neutral-600 uppercase tracking-widest ml-1">
              GRID MACHINE
            </MicroTitle>
          </>
        }
        right={
          <>
            <Tooltip content="Open SVG (Ctrl+O)">
              <Button variant="ghost" size="icon" aria-label="Open SVG" className="h-7 w-7 text-neutral-500" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
              </Button>
            </Tooltip>
            {svgContent && (
              <Tooltip content="Clear (R)">
                <Button variant="ghost" size="icon" aria-label="Clear" className="h-7 w-7 text-neutral-500" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={14} />
                </Button>
              </Tooltip>
            )}
            {!isMobile && (
              <Tooltip content={panelVisible ? 'Hide panel (Tab)' : 'Show panel (Tab)'}>
                <Button variant="ghost" size="icon" aria-label={panelVisible ? 'Hide panel' : 'Show panel'} className="h-7 w-7 text-neutral-500" onClick={() => setPanelVisible(!panelVisible)}>
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
        onDrop={(e) => { setIsDragOver(false); handleDrop(e); }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
      >
        <DropOverlay visible={isDragOver} message={t('grid.machine.drop_svg_here')} />
        {svgContent ? (
          <GridCanvas ref={gridRef} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-10 rounded-2xl border border-dashed border-white/10 hover:border-white/20 transition-colors cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Upload size={20} className="text-neutral-500 group-hover:text-neutral-300" />
              </div>
              <div className="text-center">
                <p className="text-[12px] text-neutral-400">{t('grid.machine.drop_an_svg_file_here')}</p>
                <p className="text-[10px] text-neutral-600 mt-1">{t('grid.machine.or_click_ctrlv_to_paste')}</p>
              </div>
            </button>
          </div>
        )}
      </div>

      {svgContent && !isMobile && (
        <AppShellPanel side="right" visible={panelVisible} width={300}>
          <GridMachineControls onExportPng={handleExportPng} onExportSvg={handleExportSvg} />
        </AppShellPanel>
      )}

      {svgContent && isMobile && (
        <AppShellMobileSheet open={mobileSheetOpen} onToggle={() => setMobileSheetOpen(!mobileSheetOpen)}>
          <GridMachineControls onExportPng={handleExportPng} onExportSvg={handleExportSvg} />
        </AppShellMobileSheet>
      )}

      {!isMobile && svgContent && (
        <AppShellStatusBar>
          <span>{anchorCount} anchors</span>
          <span>·</span>
          <span>{handleCount} handles</span>
          {analysis && (
            <>
              <span>·</span>
              <span>{Math.round(analysis.viewBox.width)}×{Math.round(analysis.viewBox.height)}</span>
            </>
          )}
          {fileName && (
            <>
              <span>·</span>
              <span className="max-w-[120px] truncate">{fileName}</span>
            </>
          )}
        </AppShellStatusBar>
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title={t('grid.machine.clear_workspace')}
        message={t('grid.machine.this_will_remove_the_current_svg_and_')}
        confirmText="Clear"
        variant="warning"
      />
    </AppShell>
  );
};

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { ChevronLeft, PanelRightOpen, PanelRightClose, RotateCcw, ChevronUp, ChevronDown, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { AppShell, AppShellTopBar, AppShellPanel, AppShellStatusBar } from '@/components/ui/AppShell';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { GridCanvas, type GridCanvasHandle } from '@/components/grid-machine/GridCanvas';
import { GridMachineControls } from '@/components/grid-machine/ControlsPanel';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { analyzeSvg } from '@/components/grid-machine/SvgAnalyzer';
import { useIsMobile } from '@/hooks/use-media-query';

export const GridMachinePage: React.FC = () => {
  const navigate = useNavigate();
  const gridRef = useRef<GridCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

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
    toast.success(`Loaded ${name} — ${anchors} anchors, ${handles} handles`);
  }, [setSvg, setAnalysis]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      toast.error('Please upload an SVG file');
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
      toast.error('Only SVG files are supported');
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
      toast.success('PNG exported (2x)');
    } catch {
      toast.error('Export failed');
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
    toast.success('SVG exported');
  }, [fileName]);

  const handleReset = useCallback(() => {
    clear();
    setConfirmReset(false);
    toast.success('Cleared');
  }, [clear]);

  useHotkeys('mod+e', (e) => { e.preventDefault(); handleExportPng(); }, { enableOnFormTags: false });
  useHotkeys('r', () => { if (svgContent) setConfirmReset(true); }, { enableOnFormTags: false });
  useHotkeys('mod+\\', () => setPanelVisible(!panelVisible), { enableOnFormTags: false });
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
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => navigate('/apps')}>
                <ChevronLeft size={16} />
              </Button>
            </Tooltip>
            <span className="text-[10px] text-neutral-600 uppercase tracking-widest font-mono ml-1">
              GRID MACHINE
            </span>
          </>
        }
        right={
          <>
            <Tooltip content="Open SVG (Ctrl+O)">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => fileInputRef.current?.click()}>
                <Upload size={14} />
              </Button>
            </Tooltip>
            {svgContent && (
              <Tooltip content="Clear (R)">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-neutral-500" onClick={() => setConfirmReset(true)}>
                  <RotateCcw size={14} />
                </Button>
              </Tooltip>
            )}
            {!isMobile && (
              <Tooltip content={panelVisible ? 'Hide panel' : 'Show panel'}>
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
        style={{
          paddingRight: !isMobile && panelVisible ? 236 : 0,
          paddingBottom: isMobile ? (mobileSheetOpen ? '55%' : 52) : 40,
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {svgContent ? (
          <GridCanvas ref={gridRef} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-10 rounded-2xl border border-dashed border-white/10 hover:border-white/20 transition-colors cursor-pointer group"
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <Upload size={20} className="text-neutral-500 group-hover:text-neutral-300" />
              </div>
              <div className="text-center">
                <p className="text-[12px] text-neutral-400">Drop an SVG file here</p>
                <p className="text-[10px] text-neutral-600 mt-1">or click to browse</p>
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
        <div className={cn(
          'absolute left-0 right-0 bottom-0 z-20 transition-all duration-300 ease-out',
          mobileSheetOpen ? 'h-[55%]' : 'h-[52px]',
        )}>
          <button
            onClick={() => setMobileSheetOpen(!mobileSheetOpen)}
            className="w-full flex items-center justify-center gap-1 py-2 bg-neutral-900/90 backdrop-blur-xl border-t border-white/[0.06] text-neutral-400"
          >
            {mobileSheetOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            <span className="text-[10px] uppercase tracking-widest">Controls</span>
          </button>
          {mobileSheetOpen && (
            <div className="h-[calc(100%-36px)] bg-neutral-950/95 backdrop-blur-xl overflow-hidden">
              <GridMachineControls onExportPng={handleExportPng} onExportSvg={handleExportSvg} />
            </div>
          )}
        </div>
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
        title="Clear workspace"
        message="This will remove the current SVG and reset all settings."
        confirmText="Clear"
        variant="warning"
      />
    </AppShell>
  );
};

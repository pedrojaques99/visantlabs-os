import React, { useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/Tooltip';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { GridCanvas, type GridCanvasHandle } from '@/components/grid-machine/GridCanvas';
import { GridMachineControls } from '@/components/grid-machine/ControlsPanel';
import { useGridMachineStore } from '@/stores/gridMachineStore';
import { analyzeSvg } from '@/components/grid-machine/SvgAnalyzer';
import { downloadBlob } from '@/utils/clipboard';
import { useExportCanvas } from '@/hooks/useExportCanvas';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { usePasteImage } from '@/hooks/usePasteImage';
import { useTranslation } from '@/hooks/useTranslation';

export const GridMachinePage: React.FC = () => {
  const { t } = useTranslation();
  const store = useGridMachineStore;
  const gridRef = useRef<GridCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const panelVisible = store((s) => s.panelVisible);
  const setPanelVisible = store((s) => s.setPanelVisible);
  const svgContent = store((s) => s.svgContent);
  const fileName = store((s) => s.fileName);
  const analysis = store((s) => s.analysis);
  const clear = store((s) => s.clear);

  const loadSvg = useCallback((content: string, name: string) => {
    store.getState().setSvg(content, name);
    const result = analyzeSvg(content);
    store.getState().setAnalysis(result);
    const anchors = result.points.filter(p => p.type === 'anchor').length;
    const handles = result.points.filter(p => p.type === 'handle').length;
    toast.success(t('grid.machine.loaded_name_anchors_anchors_handles_h'));
  }, []);

  const { exportScaled } = useExportCanvas({
    filenamePrefix: `grid-${fileName?.replace(/\.svg$/i, '') || 'export'}`,
    setIsExporting: (v) => store.getState().setIsExporting(v),
    successMessage: t('grid.machine.png_exported_2x'),
  });

  const handleExportPng = useCallback(async () => {
    const canvas = gridRef.current?.getCanvas();
    if (!canvas) return;
    await exportScaled(canvas, 2);
  }, [exportScaled]);

  const handleExportSvg = useCallback(() => {
    const svg = gridRef.current?.exportSvg();
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(blob, `grid-${fileName?.replace(/\.svg$/i, '') || 'export'}_${Date.now()}.svg`);
    toast.success(t('grid.machine.svg_exported'));
  }, [fileName]);

  useToolEditorHotkeys({
    onExport: handleExportPng,

    panelVisible,
    setPanelVisible,
    extras: [
      { keys: 'mod+o', handler: (e) => { e.preventDefault(); fileInputRef.current?.click(); } },
    ],
  });

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

  const anchorCount = analysis?.points.filter(p => p.type === 'anchor').length ?? 0;
  const handleCount = analysis?.points.filter(p => p.type === 'handle').length ?? 0;

  const statusItems = svgContent ? [
    { label: `${anchorCount} anchors` },
    { label: `${handleCount} handles` },
    ...(analysis ? [{ label: `${Math.round(analysis.viewBox.width)}×${Math.round(analysis.viewBox.height)}` }] : []),
  ] : [];

  return (
    <ToolEditorShell
      title="GRID MACHINE"
      documentTitle="Grid Machine — Visant"
      panelVisible={panelVisible && !!svgContent}
      setPanelVisible={setPanelVisible}
      onReset={clear}
      resetTitle={t('grid.machine.clear_workspace')}
      resetMessage={t('grid.machine.this_will_remove_the_current_svg_and_')}
      resetConfirmText="Clear"
      extraTopBarRight={
        <Tooltip content="Open SVG (Ctrl+O)">
          <Button variant="ghost" size="icon" aria-label="Open SVG" className="h-7 w-7 text-neutral-500" onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} />
          </Button>
        </Tooltip>
      }
      controlsPanel={<GridMachineControls onExportPng={handleExportPng} onExportSvg={handleExportSvg} />}
      statusItems={statusItems}
      fileName={svgContent ? fileName : undefined}
      dragProps={{
        onDrop: (e: React.DragEvent) => { handleDrop(e); },
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); },
        onDragLeave: () => {},
      }}
      dropMessage={t('grid.machine.drop_svg_here')}
    >
      <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" className="hidden" onChange={handleFileSelect} />
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
    </ToolEditorShell>
  );
};

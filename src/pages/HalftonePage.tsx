import React, { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { HalftoneCanvas } from '@/components/halftone/HalftoneCanvas';
import { HalftoneControls } from '@/components/halftone/HalftoneControls';
import { useHalftoneStore } from '@/stores/halftoneStore';
import { useExportCanvas } from '@/hooks/useExportCanvas';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useToolEditorDragDrop } from '@/hooks/useToolEditorDragDrop';
import { useToolInput } from '@/hooks/useToolInput';
import { useTranslation } from '@/hooks/useTranslation';

export const HalftonePage: React.FC = () => {
  const { t } = useTranslation();
  const store = useHalftoneStore;

  const panelVisible = store((s) => s.panelVisible);
  const setPanelVisible = store((s) => s.setPanelVisible);
  const resetSettings = store((s) => s.resetSettings);
  const frequency = store((s) => s.frequency);
  const dotSize = store((s) => s.dotSize);
  const blendMode = store((s) => s.blendMode);
  const fileName = store((s) => s.fileName);
  const shaderEnabled = store((s) => s.shaderEnabled);
  const shaderType = store((s) => s.shaderType);
  const zoom = store((s) => s.zoom);
  const undo = store((s) => s.undo);
  const redo = store((s) => s.redo);
  const historyIndex = store((s) => s.historyIndex);
  const historyLength = store((s) => s.settingsHistory.length);

  const { canvasRef, onCanvasReady, exportPng } = useExportCanvas({
    filenamePrefix: 'halftone',
    getShaderSettings: () => {
      const s = store.getState();
      return s.shaderEnabled ? s.getShaderSettings() : undefined;
    },
    setIsExporting: (v) => store.getState().setIsExporting(v),
    successMessage: t('halftone.png_exported'),
  });

  const { isDragOver, dragProps, dropMessage } = useToolEditorDragDrop({
    accept: 'image',
    onFile: useCallback((file: File) => {
      const url = URL.createObjectURL(file);
      store.getState().setImageUrl(url, file.name || 'pasted-image');
      toast.success(t('halftone.loaded_file', { name: file.name || t('halftone.pasted_image') }));
    }, []),
    dropMessage: t('halftone.drop_image_here'),
  });

  const { pendingAsset, acceptAsset } = useToolInput('halftone');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) store.getState().setImageUrl(url, asset.label || 'pipeline-asset');
  }, [pendingAsset, acceptAsset]);

  useToolEditorHotkeys({
    onExport: exportPng,

    panelVisible,
    setPanelVisible,
    undo,
    redo,
    zoom: {
      current: zoom,
      set: (z) => store.getState().setZoom(z),
      resetPan: () => store.getState().setPan(0, 0),
    },
  });

  const statusItems = [
    { label: `${Math.round(zoom * 100)}%` },
    { label: `freq ${frequency}` },
    { label: `dot ${dotSize.toFixed(2)}` },
    { label: ['subtractive', 'additive', 'normal'][blendMode] },
    ...(shaderEnabled ? [{ label: shaderType, color: 'text-cyan-400' }] : []),
  ];

  return (
    <ToolEditorShell
      title="CMYK HALFTONE"
      documentTitle="CMYK Halftone — Visant"
      panelVisible={panelVisible}
      setPanelVisible={setPanelVisible}
      onReset={resetSettings}
      resetTitle={t('halftone.reset_settings')}
      resetMessage={t('halftone.all_halftone_settings_will_return_to_def')}
      undo={{ handler: undo, disabled: historyIndex < 0 }}
      redo={{ handler: redo, disabled: historyIndex >= historyLength - 1 }}
      controlsPanel={<HalftoneControls onExport={exportPng} />}
      statusItems={statusItems}
      fileName={fileName}
      isDragOver={isDragOver}
      dragProps={dragProps}
      dropMessage={dropMessage}
    >
      <HalftoneCanvas onCanvasReady={onCanvasReady} />
    </ToolEditorShell>
  );
};

import React, { useCallback, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ToolEditorShell } from '@/components/shared/ToolEditorShell';
import { TextureFilterCanvas } from '@/components/texture-filter/TextureFilterCanvas';
import { TextureFilterControls } from '@/components/texture-filter/TextureFilterControls';
import { useTextureFilterStore } from '@/stores/textureFilterStore';
import { useExportCanvas } from '@/hooks/useExportCanvas';
import { useToolEditorHotkeys } from '@/hooks/useToolEditorHotkeys';
import { useToolEditorDragDrop } from '@/hooks/useToolEditorDragDrop';
import { useToolInput } from '@/hooks/useToolInput';

export const TextureFilterPage: React.FC = () => {
  const store = useTextureFilterStore;

  const panelVisible = store((s) => s.panelVisible);
  const setPanelVisible = store((s) => s.setPanelVisible);
  const resetSettings = store((s) => s.resetSettings);
  const blendMode = store((s) => s.blendMode);
  const opacity = store((s) => s.opacity);
  const textureName = store((s) => s.textureName);
  const fileName = store((s) => s.fileName);
  const shaderEnabled = store((s) => s.shaderEnabled);
  const shaderType = store((s) => s.shaderType);
  const zoom = store((s) => s.zoom);
  const maskMode = store((s) => s.maskMode);
  const undo = store((s) => s.undo);
  const redo = store((s) => s.redo);
  const historyIndex = store((s) => s.historyIndex);
  const historyLength = store((s) => s.settingsHistory.length);

  const { onCanvasReady, exportPng } = useExportCanvas({
    filenamePrefix: 'texture_filter',
    getShaderSettings: () => {
      const s = store.getState();
      return s.shaderEnabled ? s.getShaderSettings() : undefined;
    },
    setIsExporting: (v) => store.getState().setIsExporting(v),
  });

  const { isDragOver, dragProps, dropMessage } = useToolEditorDragDrop({
    accept: 'image+video',
    onFile: useCallback((file: File) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      store.getState().setImageUrl(url, file.name || 'pasted', isVideo ? 'video' : 'image');
      toast.success(`Loaded ${file.name || 'pasted image'}`);
    }, []),
    dropMessage: 'Drop image or video here',
  });

  const { pendingAsset, acceptAsset } = useToolInput('texture-filter');
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
    { label: blendMode },
    { label: `${(opacity * 100).toFixed(0)}%` },
    { label: textureName },
    ...(maskMode ? [{ label: 'mask', color: 'text-purple-400' }] : []),
    ...(shaderEnabled ? [{ label: shaderType, color: 'text-cyan-400' }] : []),
  ];

  return (
    <ToolEditorShell
      title="TEXTURE FILTER"
      documentTitle="Texture Filter — Visant"
      panelVisible={panelVisible}
      setPanelVisible={setPanelVisible}
      onReset={resetSettings}
      resetMessage="All texture filter settings will return to defaults."
      undo={{ handler: undo, disabled: historyIndex < 0 }}
      redo={{ handler: redo, disabled: historyIndex >= historyLength - 1 }}
      controlsPanel={<TextureFilterControls onExport={exportPng} />}
      statusItems={statusItems}
      fileName={fileName}
      isDragOver={isDragOver}
      dragProps={dragProps}
      dropMessage={dropMessage}
    >
      <TextureFilterCanvas onCanvasReady={onCanvasReady} />
      {!store((s) => s.imageUrl) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="flex flex-col items-center gap-4 text-neutral-500">
            <Upload size={28} strokeWidth={1.2} />
            <p className="text-[11px] uppercase tracking-widest">
              Drop or paste an image or video to begin
            </p>
            <p className="text-[10px] tracking-wide opacity-60">
              Ctrl+V — paste · Tab — toggle panel
            </p>
          </div>
        </div>
      )}
    </ToolEditorShell>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { Maximize2, Diamond, X } from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpscaleStore, type UpscaleItem } from '@/stores/upscaleStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { applyShaderEffect } from '@/utils/shaders/shaderRenderer';
import { downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ImageCompareSlider } from '@/components/shared/ImageCompareSlider';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/Dropzone';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useTranslation } from '@/hooks/useTranslation';
import { useToolInput } from '@/hooks/useToolInput';
import { QuickActions } from '@/components/shared/QuickActions';
import JSZip from 'jszip';
import { glassSurface } from '@/lib/ui/glass';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Thumb } from '@/components/ui/Thumb';
import { fade, transitions } from '@/lib/ui/motion';

const SCALE_OPTIONS = [2, 3, 4] as const;

/** Local scale-fade — no scale preset in the module; tokens supply ease/duration. */
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

async function processItem(
  item: UpscaleItem,
  scaleFactor: number,
  sharpening: number,
  updateItem: (id: string, patch: Partial<UpscaleItem>) => void
) {
  updateItem(item.id, { status: 'processing' });
  try {
    const base64 = await applyShaderEffect(item.sourceUrl, undefined, undefined, {
      shaderType: 'upscale',
      scaleFactor,
      upscaleSharpening: sharpening,
    });
    const result = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    updateItem(item.id, { status: 'done', resultBase64: result });
  } catch (err: any) {
    console.error(`Upscale failed for ${item.fileName}:`, err);
    updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
  }
}

export const UpscalePage: React.FC = () => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);

  const items = useUpscaleStore((s) => s.items);
  const scaleFactor = useUpscaleStore((s) => s.scaleFactor);
  const sharpening = useUpscaleStore((s) => s.sharpening);
  const isProcessing = useUpscaleStore((s) => s.isProcessing);
  const addFiles = useUpscaleStore((s) => s.addFiles);
  const removeItem = useUpscaleStore((s) => s.removeItem);
  const updateItem = useUpscaleStore((s) => s.updateItem);
  const setScaleFactor = useUpscaleStore((s) => s.setScaleFactor);
  const setSharpening = useUpscaleStore((s) => s.setSharpening);
  const setIsProcessing = useUpscaleStore((s) => s.setIsProcessing);
  const reset = useUpscaleStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('upscale');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) addFiles([{ url, name: asset.label || 'pipeline-asset.png' }]);
  }, [pendingAsset, acceptAsset, addFiles]);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;
  const previewItem =
    items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const valid: { url: string; name: string }[] = [];
      Array.from(fileList).forEach((file) => {
        const error = validateFile(file, 'image');
        if (error) {
          toast.error(`${file.name}: ${error}`);
          return;
        }
        valid.push({ url: URL.createObjectURL(file), name: file.name });
      });
      if (valid.length) addFiles(valid);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleProcessAll = useCallback(async () => {
    if (isProcessing) return;
    const toProcess = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!toProcess.length) {
      toast.info(t('miniTools.nothingToProcess'));
      return;
    }

    setIsProcessing(true);
    setConvertProgress(0);
    let done = 0;
    const total = toProcess.length;
    for (const item of toProcess) {
      await processItem(item, scaleFactor, sharpening, updateItem);
      done++;
      setConvertProgress(Math.round((done / total) * 100));
    }
    setIsProcessing(false);
    toast.success(t('miniTools.upscale.done', { count: done }));
  }, [items, scaleFactor, sharpening, isProcessing, updateItem, setIsProcessing, t]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      await downloadImage(doneItems[0].resultBase64, `upscale-${scaleFactor}x`);
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const base64Data = item.resultBase64.includes(',')
        ? item.resultBase64.split(',')[1]
        : item.resultBase64;
      const ext = item.fileName.replace(/\.[^.]+$/, '');
      zip.file(`${ext}_${scaleFactor}x.png`, base64Data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `upscale-batch-${scaleFactor}x-${Date.now()}.zip`);
    toast.success(t('miniTools.zipDownloaded'));
  }, [items, scaleFactor, t]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  }, [previewItem, t]);

  const hasItems = items.length > 0;

  const panelContent = hasItems ? (
    <div className="space-y-5">
      {/* Add more */}
      <Dropzone
        onFiles={handleFiles}
        accept="image/jpeg,image/png,image/webp"
        multiple
        label={t('miniTools.addImages')}
        size="sm"
        dropTarget={false}
      />

      {/* Thumbnail queue */}
      <div className="max-h-[32vh] overflow-y-auto space-y-1.5 pr-1">
        {items.map((item) => (
          <motion.div
            key={item.id}
            onClick={() => setPreviewId(item.id)}
            {...fade}
            layout
            className={cn(
              'group flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-colors duration-200',
              previewItem?.id === item.id ? 'bg-muted ring-1 ring-border' : 'hover:bg-muted/60'
            )}
          >
            <Thumb
              src={item.resultBase64 || item.sourceUrl}
              alt=""
              className="w-10 h-10 rounded object-cover bg-muted flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-mono text-foreground truncate">{item.fileName}</p>
              <StatusBadge status={item.status} />
            </div>
            <button
              type="button"
              aria-label={t('miniTools.remove')}
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item.id);
              }}
              className={cn(
                hoverReveal,
                'text-muted-foreground hover:text-foreground flex-shrink-0'
              )}
            >
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="h-px bg-border" />

      {/* Controls */}
      <div className="space-y-4">
        {/* Scale buttons */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.upscale.scale')}
          </span>
          <SegmentedControl
            aria-label={t('miniTools.upscale.scale')}
            size="sm"
            fullWidth
            value={String(scaleFactor)}
            onChange={(v) => setScaleFactor(Number(v))}
            disabled={isProcessing}
            options={SCALE_OPTIONS.map((s) => ({ value: String(s), label: `${s}x` }))}
          />
        </div>

        {/* Sharpening slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Diamond size={10} className="text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {t('miniTools.upscale.sharpening')}
              </span>
            </div>
            <span className="text-2xs font-mono text-muted-foreground tabular-nums">
              {Math.round(sharpening * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sharpening}
            onChange={(e) => setSharpening(parseFloat(e.target.value))}
            disabled={isProcessing}
            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Actions */}
      <div className="space-y-2">
        <AnimatePresence>
          {queuedOrErrorCount > 0 && (
            <motion.div {...fadeScale}>
              <Button
                onClick={handleProcessAll}
                disabled={isProcessing}
                variant="primary"
                size="sm"
                className="w-full text-xs"
              >
                {isProcessing ? (
                  <GlitchLoader size={14} color="currentColor" />
                ) : (
                  <Maximize2 size={14} />
                )}
                <span className="ml-2">
                  {isProcessing
                    ? t('common.processing')
                    : queuedOrErrorCount > 1
                      ? t('miniTools.upscale.runCount', { count: queuedOrErrorCount })
                      : t('miniTools.upscale.run')}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {doneCount > 0 && !isProcessing && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="upscale"
                outputMime="image/png"
                summary={t('miniTools.upscale.done', { count: doneCount })}
                onDownloadAll={handleDownloadAll}
                onCopy={handleCopyPreview}
                assetData={
                  previewItem?.resultBase64
                    ? {
                        imageBase64: previewItem.resultBase64,
                        mimeType: 'image/png',
                        label: previewItem.fileName,
                      }
                    : undefined
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  ) : undefined;

  const statusBarContent = hasItems ? (
    <div className="flex items-center gap-3 text-2xs tabular-nums text-muted-foreground">
      <span>
        {doneCount}/{items.length}
      </span>
    </div>
  ) : undefined;

  return (
    <MiniAppShell
      icon={Maximize2}
      title={t('apps.bicubicUpscale.name')}
      toolId="upscale"
      documentTitle={t('apps.bicubicUpscale.name')}
      onReset={hasItems ? reset : undefined}
      panel={panelContent}
      panelLabel={t('miniTools.panelLabel')}
      statusBar={statusBarContent}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      <AnimatePresence mode="wait">
        {!hasItems ? (
          <motion.div key="upload" {...fade} className="flex w-full justify-center py-8">
            <Dropzone
              onFiles={handleFiles}
              accept="image/jpeg,image/png,image/webp"
              multiple
              label={t('miniTools.dropImages')}
              dropTarget={false}
              className="max-w-md"
            />
          </motion.div>
        ) : (
          /* ─── Working state — centered preview with ImageCompareSlider ─── */
          <motion.div
            key="workspace"
            {...fadeScale}
            className={cn(
              'relative w-full max-w-3xl rounded-xl overflow-hidden min-h-[300px] flex items-center justify-center',
              glassSurface.surface
            )}
          >
            {previewItem ? (
              <>
                <AnimatePresence mode="wait">
                  {previewItem.status === 'done' && previewItem.resultBase64 ? (
                    <motion.div key="compare" className="w-full" {...fade}>
                      <ImageCompareSlider
                        before={previewItem.sourceUrl}
                        after={previewItem.resultBase64}
                      />
                    </motion.div>
                  ) : (
                    <motion.img
                      key="source"
                      src={previewItem.sourceUrl}
                      alt={previewItem.fileName}
                      className="w-full h-auto max-h-[60vh] object-contain"
                      {...fade}
                    />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center bg-background/80"
                      {...fade}
                    >
                      <FlyingPaperLoader
                        progress={convertProgress}
                        label={`${convertProgress}% · ${doneCount}/${items.length}`}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};

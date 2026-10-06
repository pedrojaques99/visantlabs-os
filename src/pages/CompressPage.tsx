import React, { useCallback, useEffect, useState } from 'react';
import { Minimize2, X, ArrowRight } from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompressStore, type CompressItem } from '@/stores/compressStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { loadImage, downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/Dropzone';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { QuickActions } from '@/components/shared/QuickActions';
import { BrandToolSelect } from '@/components/shared/BrandToolSelect';
import { useTranslation } from '@/hooks/useTranslation';
import { useToolInput } from '@/hooks/useToolInput';
import { useBrandDefaults } from '@/hooks/useBrandDefaults';
import { formatBytes } from '@/utils/formatUtils';
import JSZip from 'jszip';
import { glassSurface } from '@/lib/ui/glass';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Thumb } from '@/components/ui/Thumb';
import { fade, transitions } from '@/lib/ui/motion';

/** Local scale-fade — no scale preset in the module; tokens supply ease/duration. */
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

const DIMENSION_OPTIONS = [512, 1024, 2048, 4096] as const;
const FORMAT_OPTIONS: Array<'jpeg' | 'png' | 'webp'> = ['jpeg', 'png', 'webp'];

async function compressItem(
  item: CompressItem,
  quality: number,
  maxDimension: number,
  outputFormat: 'jpeg' | 'png' | 'webp',
  updateItem: (id: string, patch: Partial<CompressItem>) => void
) {
  updateItem(item.id, { status: 'processing' });
  try {
    const img = await loadImage(item.sourceUrl);

    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > maxDimension || h > maxDimension) {
      const ratio = Math.min(maxDimension / w, maxDimension / h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        `image/${outputFormat}`,
        quality / 100
      );
    });

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('FileReader failed'));
      reader.readAsDataURL(blob);
    });

    updateItem(item.id, { status: 'done', resultBase64: dataUrl, compressedSize: blob.size });
  } catch (err: any) {
    console.error(`Compress failed for ${item.fileName}:`, err);
    updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
  }
}

export const CompressPage: React.FC = () => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);

  const items = useCompressStore((s) => s.items);
  const quality = useCompressStore((s) => s.quality);
  const maxDimension = useCompressStore((s) => s.maxDimension);
  const outputFormat = useCompressStore((s) => s.outputFormat);
  const isProcessing = useCompressStore((s) => s.isProcessing);
  const addFiles = useCompressStore((s) => s.addFiles);
  const removeItem = useCompressStore((s) => s.removeItem);
  const updateItem = useCompressStore((s) => s.updateItem);
  const setQuality = useCompressStore((s) => s.setQuality);
  const setMaxDimension = useCompressStore((s) => s.setMaxDimension);
  const setOutputFormat = useCompressStore((s) => s.setOutputFormat);
  const setIsProcessing = useCompressStore((s) => s.setIsProcessing);
  const reset = useCompressStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('compress');
  const { brandId, setBrandId, defaults: brandDefaults } = useBrandDefaults('compress');

  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) addFiles([{ url, name: asset.label || 'pipeline-asset.png', size: 0 }]);
  }, [pendingAsset, acceptAsset, addFiles]);

  useEffect(() => {
    if (!brandDefaults) return;
    setQuality(brandDefaults.quality);
    setOutputFormat(brandDefaults.outputFormat);
  }, [brandDefaults, setQuality, setOutputFormat]);

  const hasItems = items.length > 0;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;
  const previewItem =
    items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  const totalOriginal = items
    .filter((i) => i.status === 'done')
    .reduce((sum, i) => sum + i.originalSize, 0);
  const totalCompressed = items
    .filter((i) => i.status === 'done')
    .reduce((sum, i) => sum + i.compressedSize, 0);
  const totalSaved = totalOriginal - totalCompressed;
  const totalPercent = totalOriginal > 0 ? Math.round((totalSaved / totalOriginal) * 100) : 0;

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const valid: { url: string; name: string; size: number }[] = [];
      Array.from(fileList).forEach((file) => {
        const error = validateFile(file, 'image');
        if (error) {
          toast.error(`${file.name}: ${error}`);
          return;
        }
        valid.push({ url: URL.createObjectURL(file), name: file.name, size: file.size });
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
      await compressItem(item, quality, maxDimension, outputFormat, updateItem);
      done++;
      setConvertProgress(Math.round((done / total) * 100));
    }
    setIsProcessing(false);
    toast.success(t('miniTools.compress.done', { count: done }));
  }, [items, quality, maxDimension, outputFormat, isProcessing, updateItem, setIsProcessing, t]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      await downloadImage(doneItems[0].resultBase64, `compressed-${outputFormat}`);
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const base64Data = item.resultBase64.includes(',')
        ? item.resultBase64.split(',')[1]
        : item.resultBase64;
      const ext = item.fileName.replace(/\.[^.]+$/, '');
      zip.file(`${ext}_compressed.${outputFormat}`, base64Data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `compress-batch-${Date.now()}.zip`);
    toast.success(t('miniTools.zipDownloaded'));
  }, [items, outputFormat, t]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  }, [previewItem, t]);

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
              <div className="flex items-center gap-1">
                <StatusBadge status={item.status} />
                {item.status === 'done' && item.originalSize > 0 && (
                  <span className="text-2xs font-mono text-success tabular-nums">
                    -
                    {Math.round(
                      ((item.originalSize - item.compressedSize) / item.originalSize) * 100
                    )}
                    %
                  </span>
                )}
              </div>
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
        <BrandToolSelect value={brandId} onChange={setBrandId} />

        {/* Quality slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.quality')}
            </span>
            <span className="text-2xs font-mono text-muted-foreground tabular-nums">
              {quality}%
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            disabled={isProcessing}
            className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
          />
        </div>

        {/* Max dimension */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.maxDimension')}
          </span>
          <SegmentedControl
            aria-label={t('miniTools.maxDimension')}
            size="sm"
            fullWidth
            value={String(maxDimension)}
            onChange={(v) => setMaxDimension(Number(v))}
            disabled={isProcessing}
            options={DIMENSION_OPTIONS.map((d) => ({ value: String(d), label: d }))}
          />
        </div>

        {/* Format */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('miniTools.format')}</span>
          <SegmentedControl
            aria-label={t('miniTools.format')}
            size="sm"
            fullWidth
            value={outputFormat}
            onChange={setOutputFormat}
            disabled={isProcessing}
            options={FORMAT_OPTIONS.map((f) => ({ value: f, label: f.toUpperCase() }))}
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
                  <Minimize2 size={14} />
                )}
                <span className="ml-2">
                  {isProcessing
                    ? t('miniTools.compress.running')
                    : queuedOrErrorCount > 1
                      ? t('miniTools.compress.runCount', { count: queuedOrErrorCount })
                      : t('miniTools.compress.run')}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {doneCount > 0 && !isProcessing && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="compress"
                outputMime={`image/${outputFormat}`}
                summary={t('miniTools.compress.done', { count: doneCount })}
                savedBytes={totalSaved}
                savedPercent={totalPercent}
                onDownloadAll={handleDownloadAll}
                onCopy={handleCopyPreview}
                assetData={
                  previewItem?.resultBase64
                    ? {
                        imageBase64: previewItem.resultBase64,
                        mimeType: `image/${outputFormat}`,
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
      {doneCount > 0 && totalPercent > 0 && (
        <>
          <span>·</span>
          <span className="text-success">{t('miniTools.smaller', { percent: totalPercent })}</span>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <MiniAppShell
      icon={Minimize2}
      title={t('apps.imageCompressor.name')}
      toolId="compress"
      documentTitle={t('apps.imageCompressor.name')}
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
                <img
                  src={previewItem.resultBase64 || previewItem.sourceUrl}
                  alt={previewItem.fileName}
                  className="w-full h-auto max-h-[72vh] object-contain"
                />
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
                <AnimatePresence>
                  {previewItem.status === 'done' && (
                    <motion.div
                      className="absolute top-2 right-2 flex items-center gap-1.5 text-2xs font-mono tabular-nums"
                      {...fade}
                    >
                      <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                        {formatBytes(previewItem.originalSize)}
                      </span>
                      <ArrowRight size={10} className="text-muted-foreground" />
                      <span className="rounded bg-muted px-2 py-0.5 text-foreground">
                        {formatBytes(previewItem.compressedSize)}
                      </span>
                      {previewItem.originalSize > 0 && (
                        <span className="rounded bg-success/20 px-2 py-0.5 text-success">
                          -
                          {Math.round(
                            ((previewItem.originalSize - previewItem.compressedSize) /
                              previewItem.originalSize) *
                              100
                          )}
                          %
                        </span>
                      )}
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

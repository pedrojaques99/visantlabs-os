import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Maximize2, Diamond, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpscaleStore, type UpscaleItem } from '@/stores/upscaleStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { applyShaderEffect } from '@/utils/shaders/shaderRenderer';
import { downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ImageCompareSlider } from '@/components/shared/ImageCompareSlider';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useToolInput } from '@/hooks/useToolInput';
import { QuickActions } from '@/components/shared/QuickActions';
import JSZip from 'jszip';

const SCALE_OPTIONS = [2, 3, 4] as const;

const ease = [0.4, 0, 0.2, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease },
};

const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: 0.3, ease },
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
  const inputRef = useRef<HTMLInputElement>(null);
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
    (fileList: FileList) => {
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

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      if (e.target) e.target.value = '';
    },
    [handleFiles]
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
      toast.info('Nothing to process');
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
    toast.success(`${done} image${done > 1 ? 's' : ''} upscaled`);
  }, [items, scaleFactor, sharpening, isProcessing, updateItem, setIsProcessing]);

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
    toast.success('ZIP downloaded');
  }, [items, scaleFactor]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success('Copied to clipboard');
    else toast.error(result.error || 'Copy failed');
  }, [previewItem]);

  const hasItems = items.length > 0;

  return (
    <MiniToolShell
      icon={Maximize2}
      title="Bicubic Upscale"
      countLabel={hasItems ? `${doneCount}/${items.length}` : undefined}
      onReset={reset}
      showReset={hasItems}
      centered={!hasItems}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      <AnimatePresence mode="wait">
        {!hasItems ? (
          /* ─── Empty / Upload state — vertically centered ─── */
          <motion.div key="upload" {...fadeUp} className="flex flex-col items-center gap-6 py-8">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Maximize2 size={28} className="text-neutral-500" />
            </motion.div>

            <motion.div
              className="text-center space-y-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              <p className="text-sm text-neutral-300 font-medium">
                Upscale images with bicubic interpolation
              </p>
              <p className="text-xs text-neutral-600 font-mono">
                Up to 4x with sharpening — batch supported
              </p>
            </motion.div>

            <motion.label
              className={cn(
                'flex flex-col items-center justify-center gap-3 w-full max-w-md h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all',
                isDragOver
                  ? 'border-brand-cyan bg-brand-cyan/5 scale-[1.02]'
                  : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40 hover:bg-neutral-900/40'
              )}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Upload size={24} className="text-neutral-500" />
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Drop images or click to upload
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </motion.label>
          </motion.div>
        ) : (
          /* ─── Working state ─── */
          <motion.div key="workspace" {...fadeScale} className="space-y-5">
            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
              {/* Preview */}
              <motion.div
                className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950/40 min-h-[300px] flex items-center justify-center"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                {previewItem ? (
                  <>
                    <AnimatePresence mode="wait">
                      {previewItem.status === 'done' && previewItem.resultBase64 ? (
                        <motion.div
                          key="compare"
                          className="w-full"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
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
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        />
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {isProcessing && (
                        <motion.div
                          className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <FlyingPaperLoader
                            progress={convertProgress}
                            label={`${convertProgress}% — ${doneCount}/${items.length}`}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : null}
              </motion.div>

              {/* Queue panel */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
              >
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all hover:bg-neutral-900/30">
                  <Upload size={12} />
                  Add images
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleInputChange}
                  />
                </label>

                <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      onClick={() => setPreviewId(item.id)}
                      className={cn(
                        'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all duration-200 group',
                        previewItem?.id === item.id
                          ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30'
                          : 'hover:bg-neutral-900/60'
                      )}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      layout
                    >
                      <img
                        src={item.resultBase64 || item.sourceUrl}
                        alt=""
                        className="w-10 h-10 rounded object-cover bg-neutral-900 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-neutral-300 truncate">
                          {item.fileName}
                        </p>
                        <StatusBadge status={item.status} />
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all flex-shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Controls */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
            >
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Scale</span>
                  <div className="flex gap-1">
                    {SCALE_OPTIONS.map((s) => (
                      <motion.button
                        key={s}
                        onClick={() => setScaleFactor(s)}
                        disabled={isProcessing}
                        className={cn(
                          'px-2.5 py-0.5 rounded text-xs font-mono transition-all duration-200',
                          scaleFactor === s
                            ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                            : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        {s}x
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <Diamond size={10} className="text-brand-cyan flex-shrink-0" />
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Sharp</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={sharpening}
                    onChange={(e) => setSharpening(parseFloat(e.target.value))}
                    disabled={isProcessing}
                    className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 w-8 text-right tabular-nums">
                    {Math.round(sharpening * 100)}%
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <AnimatePresence>
                  {queuedOrErrorCount > 0 && (
                    <motion.div className="flex-1" {...fadeScale}>
                      <Button
                        onClick={handleProcessAll}
                        disabled={isProcessing}
                        className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest transition-all duration-200"
                      >
                        {isProcessing ? (
                          <GlitchLoader size={14} color="currentColor" />
                        ) : (
                          <Maximize2 size={14} />
                        )}
                        <span className="ml-2">
                          {isProcessing
                            ? `Processing…`
                            : `Upscale ${
                                queuedOrErrorCount > 1 ? `${queuedOrErrorCount} images` : ''
                              }`}
                        </span>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {doneCount > 0 && !isProcessing && (
                  <motion.div {...fadeScale}>
                    <QuickActions
                      toolId="upscale"
                      outputMime="image/png"
                      summary={`${doneCount} image${doneCount > 1 ? 's' : ''} upscaled`}
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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniToolShell>
  );
};

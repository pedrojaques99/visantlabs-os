import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Minimize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCompressStore, type CompressItem } from '@/stores/compressStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { loadImage, downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { QuickActions } from '@/components/shared/QuickActions';
import { BrandToolSelect } from '@/components/shared/BrandToolSelect';
import { useTranslation } from '@/hooks/useTranslation';
import { useToolInput } from '@/hooks/useToolInput';
import { useBrandDefaults } from '@/hooks/useBrandDefaults';
import { formatBytes } from '@/utils/formatUtils';
import JSZip from 'jszip';

const ease = [0.4, 0, 0.2, 1] as const;
const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.35, ease } };
const fadeScale = { initial: { opacity: 0, scale: 0.96 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { duration: 0.3, ease } };

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
  const inputRef = useRef<HTMLInputElement>(null);
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
    (fileList: FileList) => {
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
      await compressItem(item, quality, maxDimension, outputFormat, updateItem);
      done++;
      setConvertProgress(Math.round((done / total) * 100));
    }
    setIsProcessing(false);
    toast.success(`${done} image${done > 1 ? 's' : ''} compressed`);
  }, [items, quality, maxDimension, outputFormat, isProcessing, updateItem, setIsProcessing]);

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
    toast.success('ZIP downloaded');
  }, [items, outputFormat]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success('Copied to clipboard');
    else toast.error(result.error || 'Copy failed');
  }, [previewItem]);

  return (
    <MiniToolShell
      icon={Minimize2}
      title="Image Compressor"
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
        {/* Upload zone — centered Apple-style landing */}
        {!hasItems ? (
          <motion.div key="upload" {...fadeUp} className="flex flex-col items-center gap-6 py-8">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Minimize2 size={28} className="text-neutral-500" />
            </motion.div>

            <motion.div
              className="text-center space-y-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              <p className="text-sm text-neutral-300 font-medium">Compress & optimize images</p>
              <p className="text-xs text-neutral-600 font-mono">
                Reduce file size with quality control — batch supported
              </p>
            </motion.div>

            <motion.label
              className={cn(
                'flex flex-col items-center justify-center gap-3 w-full max-w-md h-48 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200',
                isDragOver
                  ? 'border-brand-cyan bg-brand-cyan/5'
                  : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40'
              )}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <Upload size={24} className="text-neutral-500" />
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Drop images or click — batch supported
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
          <motion.div key="workspace" {...fadeScale} className="space-y-5">
            {/* Preview + Queue grid */}
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
                    <img
                      src={previewItem.resultBase64 || previewItem.sourceUrl}
                      alt={previewItem.fileName}
                      className="w-full h-auto max-h-[60vh] object-contain"
                    />
                    <AnimatePresence>
                      {isProcessing && (
                        <motion.div
                          className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <FlyingPaperLoader
                            progress={convertProgress}
                            label={`${convertProgress}% — ${doneCount}/${items.length}`}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {previewItem.status === 'done' && (
                        <motion.div
                          className="absolute top-2 right-2 flex items-center gap-1.5"
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.25 }}
                        >
                          <span className="text-[10px] font-mono uppercase tracking-wider bg-neutral-900/80 text-neutral-400 px-2 py-0.5 rounded tabular-nums">
                            {formatBytes(previewItem.originalSize)}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500">→</span>
                          <span className="text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded tabular-nums">
                            {formatBytes(previewItem.compressedSize)}
                          </span>
                          {previewItem.originalSize > 0 && (
                            <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded tabular-nums">
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

              {/* Queue panel */}
              <motion.div
                className="space-y-3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
              >
                {/* Add more */}
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/30 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all duration-200">
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

                {/* Thumbnail queue */}
                <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      onClick={() => setPreviewId(item.id)}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      layout
                      className={cn(
                        'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all duration-200 group',
                        previewItem?.id === item.id
                          ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30'
                          : 'hover:bg-neutral-900/60'
                      )}
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
                        <div className="flex items-center gap-1">
                          <StatusBadge status={item.status} />
                          <AnimatePresence>
                            {item.status === 'done' && item.originalSize > 0 && (
                              <motion.span
                                className="text-[9px] font-mono text-emerald-500 tabular-nums"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2 }}
                              >
                                -
                                {Math.round(
                                  ((item.originalSize - item.compressedSize) / item.originalSize) *
                                    100
                                )}
                                %
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeItem(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all duration-200 flex-shrink-0"
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
              {/* Brand + Quality + Max Dimension + Format */}
              <div className="flex flex-wrap items-center gap-4">
                <BrandToolSelect value={brandId} onChange={setBrandId} />
                <div className="w-px h-4 bg-neutral-700/30" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {/* Quality slider */}
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Quality</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    disabled={isProcessing}
                    className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 w-8 text-right tabular-nums">
                    {quality}%
                  </span>
                </div>

                {/* Max dimension */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Max</span>
                  <div className="flex gap-1">
                    {DIMENSION_OPTIONS.map((d) => (
                      <motion.button
                        key={d}
                        onClick={() => setMaxDimension(d)}
                        disabled={isProcessing}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'px-2.5 py-0.5 rounded text-xs font-mono transition-all duration-200 tabular-nums',
                          maxDimension === d
                            ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                            : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                        )}
                      >
                        {d}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Format */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Format</span>
                  <div className="flex gap-1">
                    {FORMAT_OPTIONS.map((f) => (
                      <motion.button
                        key={f}
                        onClick={() => setOutputFormat(f)}
                        disabled={isProcessing}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cn(
                          'px-2.5 py-0.5 rounded text-xs font-mono uppercase transition-all duration-200',
                          outputFormat === f
                            ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                            : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                        )}
                      >
                        {f}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <AnimatePresence>
                  {queuedOrErrorCount > 0 && (
                    <motion.div {...fadeScale} className="flex-1">
                      <Button
                        onClick={handleProcessAll}
                        disabled={isProcessing}
                        className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                      >
                        {isProcessing ? (
                          <GlitchLoader size={14} color="currentColor" />
                        ) : (
                          <Minimize2 size={14} />
                        )}
                        <span className="ml-2">
                          {isProcessing
                            ? 'Compressing...'
                            : `Compress ${queuedOrErrorCount > 1 ? `${queuedOrErrorCount} images` : 'All'}`}
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
                        summary={`${doneCount} image${doneCount > 1 ? 's' : ''} compressed`}
                        savedBytes={totalSaved}
                        savedPercent={totalPercent}
                        onDownloadAll={handleDownloadAll}
                        onCopy={handleCopyPreview}
                        assetData={previewItem?.resultBase64 ? {
                          imageBase64: previewItem.resultBase64,
                          mimeType: `image/${outputFormat}`,
                          label: previewItem.fileName,
                        } : undefined}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MiniToolShell>
  );
};

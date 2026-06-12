import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, ArrowLeftRight, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConverterStore, type ConvertItem, type OutputFormat } from '@/stores/converterStore';
import { loadImage } from '@/utils/imageUtils';
import { downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { pdfApi } from '@/services/pdfApi';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { QuickActions } from '@/components/shared/QuickActions';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/formatUtils';
import { useToolInput } from '@/hooks/useToolInput';
import JSZip from 'jszip';

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

/* ── Conversion logic (all client-side) ── */

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

async function convertItem(
  item: ConvertItem,
  outputFormat: OutputFormat,
  jpgQuality: number
): Promise<{ blob: Blob; url: string }> {
  if (outputFormat === 'pdf') {
    const { jsPDF } = await import('jspdf');
    const img = await loadImage(item.sourceUrl);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const pdf = new jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'px', format: [w, h] });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h);
    const blob = pdf.output('blob');
    return { blob, url: URL.createObjectURL(blob) };
  }

  if (outputFormat === 'ico') {
    const img = await loadImage(item.sourceUrl);
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const pngBlob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/png'));
    const pngBuf = new Uint8Array(await pngBlob.arrayBuffer());
    // ICO: 6-byte header + 16-byte directory entry + PNG payload
    const ico = new Uint8Array(6 + 16 + pngBuf.length);
    const view = new DataView(ico.buffer);
    // Header: reserved=0, type=1 (ICO), count=1
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    // Directory entry
    ico[6] = size; // width
    ico[7] = size; // height
    ico[8] = 0; // color palette
    ico[9] = 0; // reserved
    view.setUint16(10, 1, true); // color planes
    view.setUint16(12, 32, true); // bits per pixel
    view.setUint32(14, pngBuf.length, true); // image size
    view.setUint32(18, 22, true); // offset to image data (6+16)
    ico.set(pngBuf, 22);
    const blob = new Blob([ico], { type: 'image/x-icon' });
    return { blob, url: URL.createObjectURL(blob) };
  }

  // Standard canvas conversion: png, jpg, webp
  const img = await loadImage(item.sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const mime = MIME_MAP[outputFormat] || 'image/png';
  const quality = outputFormat === 'jpg' ? jpgQuality / 100 : undefined;
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), mime, quality));
  return { blob, url: URL.createObjectURL(blob) };
}

const OUTPUT_FORMATS: OutputFormat[] = ['png', 'jpg', 'webp', 'pdf', 'ico'];

/* ── Component ── */

export const ConverterPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [convertProgress, setConvertProgress] = useState(0);

  const items = useConverterStore((s) => s.items);
  const outputFormat = useConverterStore((s) => s.outputFormat);
  const jpgQuality = useConverterStore((s) => s.jpgQuality);
  const isProcessing = useConverterStore((s) => s.isProcessing);
  const addFiles = useConverterStore((s) => s.addFiles);
  const removeItem = useConverterStore((s) => s.removeItem);
  const updateItem = useConverterStore((s) => s.updateItem);
  const setOutputFormat = useConverterStore((s) => s.setOutputFormat);
  const setJpgQuality = useConverterStore((s) => s.setJpgQuality);
  const setIsProcessing = useConverterStore((s) => s.setIsProcessing);
  const reset = useConverterStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('converter');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) addFiles([{ url, name: asset.label || 'pipeline-asset.png', size: 0 }] as any);
  }, [pendingAsset, acceptAsset, addFiles]);

  const hasItems = items.length > 0;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;
  const previewItem =
    items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      const valid: File[] = [];
      const pdfFiles: File[] = [];
      Array.from(fileList).forEach((file) => {
        if (file.type === 'application/pdf') {
          pdfFiles.push(file);
          return;
        }
        const error = validateFile(file, 'image');
        if (error) {
          toast.error(`${file.name}: ${error}`);
          return;
        }
        valid.push(file);
      });
      if (valid.length) addFiles(valid);

      // Rasterize PDF pages and add each as a separate image
      for (const pdf of pdfFiles) {
        try {
          const reader = new FileReader();
          const base64: string = await new Promise((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(pdf);
          });
          const { images } = await pdfApi.toImages(base64);
          const pageFiles: File[] = images.map((img) => {
            const byteString = atob(img.data);
            const bytes = new Uint8Array(byteString.length);
            for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
            const baseName = pdf.name.replace(/\.pdf$/i, '');
            return new File([bytes], `${baseName}-page${img.page}.png`, { type: 'image/png' });
          });
          if (pageFiles.length) addFiles(pageFiles);
          toast.success(
            `${pdf.name}: ${pageFiles.length} page${pageFiles.length > 1 ? 's' : ''} imported`
          );
        } catch (err: any) {
          toast.error(`${pdf.name}: ${err?.message || 'Failed to process PDF'}`);
        }
      }
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

  const handleConvertAll = useCallback(async () => {
    if (isProcessing) return;
    const toProcess = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!toProcess.length) {
      toast.info('Nothing to convert');
      return;
    }

    setIsProcessing(true);
    setConvertProgress(0);
    let done = 0;
    const total = toProcess.length;
    for (const item of toProcess) {
      updateItem(item.id, { status: 'processing' });
      try {
        const result = await convertItem(item, outputFormat, jpgQuality);
        updateItem(item.id, { status: 'done', resultBlob: result.blob, resultUrl: result.url });
        done++;
      } catch (err: any) {
        console.error(`Convert failed for ${item.fileName}:`, err);
        updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
        done++;
      }
      setConvertProgress(Math.round((done / total) * 100));
    }
    setIsProcessing(false);
    toast.success(`${done} file${done > 1 ? 's' : ''} converted`);
  }, [items, outputFormat, jpgQuality, isProcessing, updateItem, setIsProcessing]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBlob);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      const item = doneItems[0];
      const ext = outputFormat;
      const baseName = item.fileName.replace(/\.[^.]+$/, '');
      downloadBlob(item.resultBlob!, `${baseName}.${ext}`);
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const baseName = item.fileName.replace(/\.[^.]+$/, '');
      const buf = await item.resultBlob!.arrayBuffer();
      zip.file(`${baseName}.${outputFormat}`, buf);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `converted-${outputFormat}-${Date.now()}.zip`);
    toast.success('ZIP downloaded');
  }, [items, outputFormat]);

  const panelContent = hasItems ? (
    <div className="space-y-5">
      {/* Add more */}
      <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/30 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all duration-200">
        <Upload size={12} />
        Add images / PDF
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif,image/bmp,application/pdf"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </label>

      {/* Thumbnail queue */}
      <div className="max-h-[32vh] overflow-y-auto space-y-1.5 pr-1">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.03 }}
            onClick={() => setPreviewId(item.id)}
            className={cn(
              'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all duration-200 group',
              previewItem?.id === item.id
                ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30'
                : 'hover:bg-neutral-900/60'
            )}
          >
            <img
              src={
                previewItem?.id === item.id && item.resultUrl ? item.resultUrl : item.sourceUrl
              }
              alt=""
              className="w-10 h-10 rounded object-cover bg-neutral-900 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-neutral-300 truncate">{item.fileName}</p>
              <div className="flex items-center gap-1">
                <FormatBadge from={item.inputFormat} to={outputFormat} />
                <span className="text-[10px] font-mono text-neutral-600 tabular-nums">
                  {formatBytes(item.originalSize)}
                </span>
                {item.status === 'done' && item.resultBlob && (
                  <AnimatePresence>
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1"
                    >
                      <ArrowRight size={7} className="text-neutral-600" />
                      <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
                        {formatBytes(item.resultBlob.size)}
                      </span>
                    </motion.span>
                  </AnimatePresence>
                )}
              </div>
              <StatusBadge status={item.status} />
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

      <div className="h-px bg-neutral-800" />

      {/* Controls */}
      <div className="space-y-4">
        {/* Format */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-neutral-500 uppercase">Format</span>
          <div className="flex gap-1 flex-wrap">
            {OUTPUT_FORMATS.map((f) => (
              <motion.button
                key={f}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOutputFormat(f)}
                disabled={isProcessing}
                className={cn(
                  'px-2.5 py-0.5 rounded text-xs font-mono transition-all duration-200',
                  outputFormat === f
                    ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                    : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600'
                )}
              >
                {f.toUpperCase()}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Quality slider — only for JPG */}
        {outputFormat === 'jpg' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Quality</span>
              <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
                {jpgQuality}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={jpgQuality}
              onChange={(e) => setJpgQuality(parseInt(e.target.value, 10))}
              disabled={isProcessing}
              className="w-full h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
            />
          </div>
        )}
      </div>

      <div className="h-px bg-neutral-800" />

      {/* Actions */}
      <div className="space-y-2">
        <AnimatePresence>
          {queuedOrErrorCount > 0 && (
            <motion.div {...fadeScale}>
              <Button
                onClick={handleConvertAll}
                disabled={isProcessing}
                className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
              >
                {isProcessing ? (
                  <GlitchLoader size={14} color="currentColor" />
                ) : (
                  <ArrowLeftRight size={14} />
                )}
                <span className="ml-2">
                  {isProcessing
                    ? 'Converting...'
                    : `Convert ${queuedOrErrorCount > 1 ? `${queuedOrErrorCount} files` : 'All'}`}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {doneCount > 0 && !isProcessing && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="converter"
                outputMime={`image/${outputFormat}`}
                summary={`${doneCount} file${
                  doneCount > 1 ? 's' : ''
                } converted to ${outputFormat.toUpperCase()}`}
                onDownloadAll={handleDownloadAll}
                assetData={
                  previewItem?.resultUrl
                    ? {
                        imageUrl: previewItem.resultUrl,
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
    <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest tabular-nums">
      <span className="text-neutral-400">
        {doneCount}/{items.length}
      </span>
    </div>
  ) : undefined;

  return (
    <MiniAppShell
      icon={ArrowLeftRight}
      title="File Converter"
      documentTitle="File Converter"
      onReset={hasItems ? reset : undefined}
      panel={panelContent}
      panelLabel="Queue & settings"
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
          /* ── Empty / Upload state ── */
          <motion.div key="upload" {...fadeUp} className="flex flex-col items-center gap-6 py-8">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-center justify-center"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <ArrowLeftRight size={28} className="text-neutral-500" />
            </motion.div>

            <motion.div
              className="text-center space-y-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.35 }}
            >
              <p className="text-sm text-neutral-300 font-medium">Convert image formats</p>
              <p className="text-xs text-neutral-600 font-mono">
                PNG, JPG, WebP, PDF, ICO — batch supported
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
                Drop images / PDF or click
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif,image/bmp,application/pdf"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </motion.label>
          </motion.div>
        ) : (
          /* ── Working state — preview centered ── */
          <motion.div
            key="workspace"
            {...fadeScale}
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950/40 min-h-[300px] flex items-center justify-center"
          >
            {previewItem ? (
              <>
                <img
                  src={previewItem.resultUrl || previewItem.sourceUrl}
                  alt={previewItem.fileName}
                  className="w-full h-auto max-h-[72vh] object-contain"
                />
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 backdrop-blur-sm"
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
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2, ease }}
                      className="absolute top-2 right-2 text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded"
                    >
                      {outputFormat.toUpperCase()}
                    </motion.span>
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

/* ── Sub-components ── */

function FormatBadge({ from, to }: { from: string; to: string }) {
  if (from === to) return null;
  return (
    <span className="text-[10px] font-mono uppercase bg-neutral-800 text-neutral-400 px-1 py-px rounded">
      {from} <ArrowRight size={7} className="inline text-brand-cyan" /> {to}
    </span>
  );
}

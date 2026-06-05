import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePdfCompressStore, type PdfItem } from '@/stores/pdfCompressStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { downloadBlob } from '@/utils/clipboard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { Button } from '@/components/ui/button';
import { QuickActions } from '@/components/shared/QuickActions';
import { useToolInput } from '@/hooks/useToolInput';
import { formatBytes } from '@/utils/formatUtils';
import { pdfApi, type CompressPreset } from '@/services/pdfApi';
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

const PRESET_OPTIONS: { value: CompressPreset; label: string; desc: string }[] = [
  { value: 'screen', label: 'Web', desc: '72dpi — smallest file' },
  { value: 'ebook', label: 'Ebook', desc: '150dpi — balanced' },
  { value: 'printer', label: 'Print', desc: '300dpi — high quality' },
  { value: 'prepress', label: 'Prepress', desc: '300dpi — color preserving' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processItem(
  item: PdfItem,
  preset: CompressPreset,
  updateItem: (id: string, patch: Partial<PdfItem>) => void
) {
  updateItem(item.id, { status: 'processing' });
  try {
    let base64: string;
    if (item.sourceUrl.startsWith('blob:')) {
      const resp = await fetch(item.sourceUrl);
      const buf = await resp.arrayBuffer();
      base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    } else {
      base64 = item.sourceUrl.replace(/^data:application\/pdf;base64,/, '');
    }

    const result = await pdfApi.compress(base64, preset);
    updateItem(item.id, {
      status: 'done',
      resultBase64: result.pdf,
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
    });
  } catch (err: any) {
    console.error(`PDF compress failed for ${item.fileName}:`, err);
    updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
  }
}

export const PdfCompressPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);

  const items = usePdfCompressStore((s) => s.items);
  const preset = usePdfCompressStore((s) => s.preset);
  const isProcessing = usePdfCompressStore((s) => s.isProcessing);
  const addFiles = usePdfCompressStore((s) => s.addFiles);
  const removeItem = usePdfCompressStore((s) => s.removeItem);
  const updateItem = usePdfCompressStore((s) => s.updateItem);
  const setPreset = usePdfCompressStore((s) => s.setPreset);
  const setIsProcessing = usePdfCompressStore((s) => s.setIsProcessing);
  const reset = usePdfCompressStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('pdf-compress');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const url = asset.imageUrl || asset.imageBase64 || '';
    if (url) addFiles([{ url, name: asset.label || 'pipeline.pdf', size: 0 }]);
  }, [pendingAsset, acceptAsset, addFiles]);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const totalOriginal = items
    .filter((i) => i.status === 'done')
    .reduce((s, i) => s + i.originalSize, 0);
  const totalCompressed = items
    .filter((i) => i.status === 'done')
    .reduce((s, i) => s + i.compressedSize, 0);
  const totalSavings =
    totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0;

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const valid: { url: string; name: string; size: number }[] = [];
      Array.from(fileList).forEach((file) => {
        if (file.type !== 'application/pdf') {
          toast.error(`${file.name}: Only PDF files accepted`);
          return;
        }
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name}: Max 50MB`);
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
    for (const item of toProcess) {
      await processItem(item, preset, updateItem);
      done++;
      setConvertProgress(Math.round((done / toProcess.length) * 100));
    }
    setIsProcessing(false);
    toast.success(`${done} PDF${done > 1 ? 's' : ''} compressed`);
  }, [items, preset, isProcessing, updateItem, setIsProcessing]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      const item = doneItems[0];
      const buf = Uint8Array.from(atob(item.resultBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([buf], { type: 'application/pdf' });
      const ext = item.fileName.replace(/\.pdf$/i, '');
      downloadBlob(blob, `${ext}-compressed.pdf`);
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const ext = item.fileName.replace(/\.pdf$/i, '');
      zip.file(`${ext}-compressed.pdf`, item.resultBase64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `pdf-compress-batch-${Date.now()}.zip`);
    toast.success('ZIP downloaded');
  }, [items]);

  const hasItems = items.length > 0;

  return (
    <MiniToolShell
      icon={FileDown}
      title="PDF Compress"
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
          <motion.div key="empty" {...fadeUp} className="flex flex-col items-center gap-6 py-16">
            <motion.div
              className={cn(
                'w-full max-w-md border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
                isDragOver
                  ? 'border-brand-cyan bg-brand-cyan/5'
                  : 'border-neutral-800 hover:border-neutral-600'
              )}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mx-auto mb-4 text-neutral-500" size={32} />
              <p className="text-sm text-neutral-400">
                Drop PDFs here or <span className="text-brand-cyan">browse</span>
              </p>
              <p className="text-[10px] text-neutral-600 mt-2 font-mono uppercase tracking-wider">
                PDF · Max 50MB per file
              </p>
            </motion.div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
          </motion.div>
        ) : (
          <motion.div key="workspace" {...fadeUp} className="space-y-6">
            {/* File list */}
            <div className="space-y-2">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  {...fadeScale}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-900/60 border border-neutral-800/50"
                >
                  <FileDown size={14} className="text-red-400 shrink-0" />
                  <span className="text-xs text-neutral-300 truncate flex-1 font-mono">
                    {item.fileName}
                  </span>
                  {item.originalSize > 0 && (
                    <span className="text-[10px] text-neutral-600 font-mono">
                      {formatBytes(item.originalSize)}
                    </span>
                  )}
                  <StatusBadge status={item.status} />
                  {item.status === 'done' && item.compressedSize > 0 && (
                    <span className="text-[10px] font-mono text-emerald-500">
                      -{Math.round((1 - item.compressedSize / item.originalSize) * 100)}%
                    </span>
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-neutral-600 hover:text-neutral-300 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Controls */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1, ease }}
              className="space-y-4"
            >
              {/* Preset selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                  Preset
                </span>
                <div className="flex gap-1">
                  {PRESET_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPreset(opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all',
                        preset === opt.value
                          ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30'
                          : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                      )}
                      title={opt.desc}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add more + Process */}
              <div className="flex gap-2">
                <Button
                  onClick={() => inputRef.current?.click()}
                  variant="outline"
                  className="font-mono text-xs uppercase tracking-widest border-neutral-700"
                >
                  <Upload size={14} />
                  <span className="ml-2">Add more</span>
                </Button>
                <Button
                  onClick={handleProcessAll}
                  disabled={isProcessing || items.every((i) => i.status === 'done')}
                  className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  {isProcessing ? (
                    <>
                      <GlitchLoader size={14} />
                      <span className="ml-2">{convertProgress}%</span>
                    </>
                  ) : (
                    `Compress${
                      items.filter((i) => i.status === 'queued' || i.status === 'error').length > 0
                        ? ` (${
                            items.filter((i) => i.status === 'queued' || i.status === 'error')
                              .length
                          })`
                        : ''
                    }`
                  )}
                </Button>
              </div>

              {/* QuickActions */}
              {doneCount > 0 && !isProcessing && (
                <motion.div {...fadeScale}>
                  <QuickActions
                    toolId="pdf-compress"
                    outputMime="application/pdf"
                    summary={`${doneCount} PDF${
                      doneCount > 1 ? 's' : ''
                    } compressed — saved ${formatBytes(
                      totalOriginal - totalCompressed
                    )} (${totalSavings}%)`}
                    onDownloadAll={handleDownloadAll}
                  />
                </motion.div>
              )}
            </motion.div>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <FlyingPaperLoader />
          </motion.div>
        )}
      </AnimatePresence>
    </MiniToolShell>
  );
};

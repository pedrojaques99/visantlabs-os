import React, { useCallback, useEffect, useState } from 'react';
import { FileDown, Upload, X } from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePdfCompressStore, type PdfItem } from '@/stores/pdfCompressStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
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
import { useTranslation } from '@/hooks/useTranslation';
import { glassSurface } from '@/lib/ui/glass';
import { fade, transitions } from '@/lib/ui/motion';

const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

/** Labelled by `miniTools.pdf.preset.<value>` / `miniTools.pdf.presetDesc.<value>`. */
const PRESET_OPTIONS: CompressPreset[] = ['screen', 'ebook', 'printer', 'prepress'];

function fileToBase64(file: Blob): Promise<string> {
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
      // FileReader, not String.fromCharCode(...bytes): spreading a multi-MB
      // array as arguments overflows the call stack.
      const resp = await fetch(item.sourceUrl);
      base64 = await fileToBase64(await resp.blob());
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
  const { t } = useTranslation();
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
          toast.error(t('miniTools.pdf.onlyPdf', { name: file.name }));
          return;
        }
        if (file.size > 50 * 1024 * 1024) {
          toast.error(t('miniTools.pdf.tooLarge', { name: file.name }));
          return;
        }
        valid.push({ url: URL.createObjectURL(file), name: file.name, size: file.size });
      });
      if (valid.length) addFiles(valid);
    },
    [addFiles, t]
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
      toast.info(t('miniTools.nothingToProcess'));
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
    toast.success(t('miniTools.pdf.done', { count: done }));
  }, [items, preset, isProcessing, updateItem, setIsProcessing, t]);

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
    toast.success(t('miniTools.zipDownloaded'));
  }, [items, t]);

  const hasItems = items.length > 0;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;

  /* ── Panel ─────────────────────────────────────────────── */
  const panelContent = hasItems ? (
    <div className="space-y-5">
      {/* Preset selector */}
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {t('miniTools.pdf.presetLabel')}
        </span>
        <div className="flex gap-1 flex-wrap">
          {PRESET_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreset(value)}
              className={cn(
                'px-3 py-1.5 rounded border text-xs font-medium transition-colors',
                preset === value
                  ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
              title={t(`miniTools.pdf.presetDesc.${value}`)}
            >
              {t(`miniTools.pdf.preset.${value}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t(`miniTools.pdf.presetDesc.${preset}`)}</p>
      </div>

      <div className="h-px bg-border" />

      {/* Add more */}
      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors duration-200 hover:border-ring hover:text-foreground">
        <Upload size={12} />
        {t('miniTools.pdf.addPdfs')}
        <input
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </label>

      <div className="h-px bg-border" />

      {/* Actions */}
      <div className="space-y-2">
        <AnimatePresence>
          {queuedOrErrorCount > 0 && (
            <motion.div {...fadeScale}>
              <Button
                onClick={handleProcessAll}
                disabled={isProcessing}
                className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-foreground border border-brand-cyan/30 text-xs font-medium"
              >
                {isProcessing ? (
                  <>
                    <GlitchLoader size={14} color="currentColor" />
                    <span className="ml-2">{convertProgress}%</span>
                  </>
                ) : (
                  <>
                    <FileDown size={14} />
                    <span className="ml-2">
                      {queuedOrErrorCount > 1
                        ? t('miniTools.pdf.runCount', { count: queuedOrErrorCount })
                        : t('miniTools.compress.run')}
                    </span>
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {doneCount > 0 && !isProcessing && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="pdf-compress"
                outputMime="application/pdf"
                summary={t('miniTools.pdf.summary', {
                  count: doneCount,
                  saved: formatBytes(totalOriginal - totalCompressed),
                  percent: totalSavings,
                })}
                onDownloadAll={handleDownloadAll}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  ) : undefined;

  /* ── Status bar ─────────────────────────────────────────── */
  const statusBarContent = hasItems ? (
    <div className="flex items-center gap-3 text-2xs tabular-nums text-muted-foreground">
      <span>
        {doneCount}/{items.length}
      </span>
      {doneCount > 0 && totalSavings > 0 && (
        <>
          <span>·</span>
          <span className="text-success">{t('miniTools.smaller', { percent: totalSavings })}</span>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <MiniAppShell
      icon={FileDown}
      title={t('apps.pdfCompress.name')}
      toolId="pdf-compress"
      documentTitle={t('apps.pdfCompress.name')}
      onReset={hasItems ? reset : undefined}
      panel={panelContent}
      panelLabel={t('miniTools.settings')}
      statusBar={statusBarContent}
      centerContent={!hasItems}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      <AnimatePresence mode="wait">
        {!hasItems ? (
          /* ── Empty state (centered drop zone) ─────────── */
          <motion.div key="empty" {...fade} className="flex w-full justify-center py-8">
            <label className="flex h-48 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-ring hover:text-foreground">
              <Upload size={20} />
              {t('miniTools.pdf.drop')}
              <span className="text-xs">{t('miniTools.pdf.limit')}</span>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleInputChange}
                className="hidden"
              />
            </label>
          </motion.div>
        ) : (
          /* ── Working state (file list, left-aligned) ───── */
          <div className="max-w-2xl mx-auto w-full py-8 px-4">
            <motion.div key="workspace" {...fade} className="space-y-2">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  {...fade}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg',
                    glassSurface.surface
                  )}
                >
                  <FileDown size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate flex-1 font-mono">
                    {item.fileName}
                  </span>
                  {item.originalSize > 0 && (
                    <span className="text-2xs text-muted-foreground font-mono tabular-nums">
                      {formatBytes(item.originalSize)}
                    </span>
                  )}
                  <StatusBadge status={item.status} />
                  {item.status === 'done' && item.compressedSize > 0 && item.originalSize > 0 && (
                    <span className="text-2xs font-mono tabular-nums text-success">
                      -{Math.round((1 - item.compressedSize / item.originalSize) * 100)}%
                    </span>
                  )}
                  {item.status === 'done' && item.resultBase64 && (
                    <button
                      type="button"
                      onClick={() => {
                        const buf = Uint8Array.from(atob(item.resultBase64), (c) =>
                          c.charCodeAt(0)
                        );
                        const blob = new Blob([buf], { type: 'application/pdf' });
                        const ext = item.fileName.replace(/\.pdf$/i, '');
                        downloadBlob(blob, `${ext}-compressed.pdf`);
                      }}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={t('common.download')}
                      aria-label={t('common.download')}
                    >
                      <FileDown size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('miniTools.remove')}
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Processing overlay — blocks the page while the server compresses */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            {...fade}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80"
          >
            <FlyingPaperLoader progress={convertProgress} />
          </motion.div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};

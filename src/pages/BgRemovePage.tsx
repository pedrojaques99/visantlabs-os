import React, { useCallback, useRef, useState } from 'react';
import { Eraser, Upload, Download, Copy, RotateCcw, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBgRemoveStore, type BgRemoveItem } from '@/stores/bgRemoveStore';
import { removeBackground } from '@/utils/bgRemoval';
import { downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import JSZip from 'jszip';

async function processItem(
  item: BgRemoveItem,
  threshold: number,
  feather: number,
  updateItem: (id: string, patch: Partial<BgRemoveItem>) => void,
) {
  updateItem(item.id, { status: 'processing' });
  try {
    const result = await removeBackground(item.sourceUrl, { threshold, feather });
    updateItem(item.id, { status: 'done', resultBase64: result });
  } catch (err: any) {
    console.error(`Bg removal failed for ${item.fileName}:`, err);
    updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
  }
}

export const BgRemovePage: React.FC = () => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const items = useBgRemoveStore((s) => s.items);
  const threshold = useBgRemoveStore((s) => s.threshold);
  const feather = useBgRemoveStore((s) => s.feather);
  const isProcessing = useBgRemoveStore((s) => s.isProcessing);
  const addFiles = useBgRemoveStore((s) => s.addFiles);
  const removeItem = useBgRemoveStore((s) => s.removeItem);
  const updateItem = useBgRemoveStore((s) => s.updateItem);
  const setThreshold = useBgRemoveStore((s) => s.setThreshold);
  const setFeather = useBgRemoveStore((s) => s.setFeather);
  const setIsProcessing = useBgRemoveStore((s) => s.setIsProcessing);
  const reset = useBgRemoveStore((s) => s.reset);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter((i) => i.status === 'queued' || i.status === 'error').length;
  const previewItem = items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  const handleFiles = useCallback((fileList: FileList) => {
    const valid: { url: string; name: string }[] = [];
    Array.from(fileList).forEach((file) => {
      const error = validateFile(file, 'image');
      if (error) { toast.error(`${file.name}: ${error}`); return; }
      valid.push({ url: URL.createObjectURL(file), name: file.name });
    });
    if (valid.length) addFiles(valid);
  }, [addFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    if (e.target) e.target.value = '';
  }, [handleFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleProcessAll = useCallback(async () => {
    if (isProcessing) return;
    const toProcess = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!toProcess.length) { toast.info('Nothing to process'); return; }

    setIsProcessing(true);
    let done = 0;
    for (const item of toProcess) {
      await processItem(item, threshold, feather, updateItem);
      done++;
    }
    setIsProcessing(false);
    toast.success(`${done} image${done > 1 ? 's' : ''} processed`);
  }, [items, threshold, feather, isProcessing, updateItem, setIsProcessing]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      await downloadImage(doneItems[0].resultBase64, 'bg-removed');
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const base64Data = item.resultBase64.includes(',') ? item.resultBase64.split(',')[1] : item.resultBase64;
      const ext = item.fileName.replace(/\.[^.]+$/, '');
      zip.file(`${ext}_no-bg.png`, base64Data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `bg-removed-batch-${Date.now()}.zip`);
    toast.success('ZIP downloaded');
  }, [items]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success('Copied to clipboard');
    else toast.error(result.error || 'Copy failed');
  }, [previewItem]);

  const toggleOriginal = useCallback(() => setShowOriginal((v) => !v), []);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Eraser size={16} className="text-brand-cyan" />
          <h1 className="text-sm font-mono font-bold uppercase tracking-widest text-neutral-200">
            Background Remover
          </h1>
          {items.length > 0 && (
            <span className="text-[10px] font-mono text-neutral-500 ml-2">
              {doneCount}/{items.length}
            </span>
          )}
          {items.length > 0 && (
            <button onClick={reset} className="ml-auto text-neutral-500 hover:text-neutral-300 transition-colors" title="Clear all">
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Upload zone */}
        {items.length === 0 ? (
          <label
            className={cn(
              'flex flex-col items-center justify-center gap-3 w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              isDragOver ? 'border-brand-cyan bg-brand-cyan/5' : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40',
            )}
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
          </label>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Preview */}
            <div
              className="relative rounded-xl overflow-hidden border border-neutral-800 min-h-[300px] flex items-center justify-center"
              style={{
                background: showOriginal || !previewItem?.resultBase64
                  ? 'rgb(10 10 10 / 0.4)'
                  : 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 16px 16px',
              }}
            >
              {previewItem ? (
                <>
                  <img
                    src={showOriginal ? previewItem.sourceUrl : (previewItem.resultBase64 || previewItem.sourceUrl)}
                    alt={previewItem.fileName}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                  {previewItem.status === 'processing' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm">
                      <GlitchLoader size={20} color="brand-cyan" />
                    </div>
                  )}
                  {previewItem.status === 'done' && (
                    <button
                      onClick={toggleOriginal}
                      className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded hover:bg-brand-cyan/30 transition-colors"
                      title={showOriginal ? 'Show result' : 'Show original'}
                    >
                      {showOriginal ? <EyeOff size={10} /> : <Eye size={10} />}
                      {showOriginal ? 'Original' : 'Result'}
                    </button>
                  )}
                </>
              ) : null}
            </div>

            {/* Queue panel */}
            <div className="space-y-3">
              {/* Add more */}
              <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all">
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
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setPreviewId(item.id)}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all group',
                      previewItem?.id === item.id ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30' : 'hover:bg-neutral-900/60',
                    )}
                  >
                    <img src={item.resultBase64 || item.sourceUrl} alt="" className="w-10 h-10 rounded object-cover bg-neutral-900 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-neutral-300 truncate">{item.fileName}</p>
                      <StatusBadge status={item.status} />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        {items.length > 0 && (
          <div className="space-y-4">
            {/* Threshold + Feather */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <Eraser size={10} className="text-brand-cyan flex-shrink-0" />
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Threshold</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                />
                <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">{threshold}%</span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Feather</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={feather}
                  onChange={(e) => setFeather(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                />
                <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">{feather}px</span>
              </div>
            </div>

            {/* Note */}
            <p className="text-[10px] font-mono text-neutral-600">
              Best for solid backgrounds. For complex scenes, use Canvas AI.
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              {queuedOrErrorCount > 0 && (
                <Button
                  onClick={handleProcessAll}
                  disabled={isProcessing}
                  className="flex-1 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  {isProcessing ? <GlitchLoader size={14} color="currentColor" /> : <Eraser size={14} />}
                  <span className="ml-2">
                    {isProcessing ? 'Processing...' : `Remove ${queuedOrErrorCount > 1 ? `${queuedOrErrorCount} images` : 'All'}`}
                  </span>
                </Button>
              )}
              {doneCount > 0 && (
                <>
                  <Button
                    onClick={handleDownloadAll}
                    className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                  >
                    <Download size={14} />
                    <span className="ml-2">{doneCount > 1 ? `Download ZIP (${doneCount})` : 'Download'}</span>
                  </Button>
                  <Button
                    onClick={handleCopyPreview}
                    variant="outline"
                    className="font-mono text-xs uppercase tracking-widest border-neutral-700"
                    title="Copy current preview"
                  >
                    <Copy size={14} />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

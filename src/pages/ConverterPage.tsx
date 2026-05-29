import React, { useCallback, useRef, useState } from 'react';
import { Upload, Download, ArrowLeftRight, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConverterStore, type ConvertItem, type OutputFormat } from '@/stores/converterStore';
import { loadImage } from '@/utils/imageUtils';
import { downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/formatUtils';
import JSZip from 'jszip';

/* ── Conversion logic (all client-side) ── */

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

async function convertItem(
  item: ConvertItem,
  outputFormat: OutputFormat,
  jpgQuality: number,
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

  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter((i) => i.status === 'queued' || i.status === 'error').length;
  const previewItem = items.find((i) => i.id === previewId) || items.find((i) => i.status === 'done') || items[0];

  const totalOriginal = items.filter((i) => i.status === 'done').reduce((acc, i) => acc + i.originalSize, 0);
  const totalConverted = items.filter((i) => i.status === 'done' && i.resultBlob).reduce((acc, i) => acc + (i.resultBlob?.size || 0), 0);

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const valid: File[] = [];
      Array.from(fileList).forEach((file) => {
        const error = validateFile(file, 'image');
        if (error) {
          toast.error(`${file.name}: ${error}`);
          return;
        }
        valid.push(file);
      });
      if (valid.length) addFiles(valid);
    },
    [addFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) handleFiles(e.target.files);
      if (e.target) e.target.value = '';
    },
    [handleFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
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
    let done = 0;
    for (const item of toProcess) {
      updateItem(item.id, { status: 'processing' });
      try {
        const result = await convertItem(item, outputFormat, jpgQuality);
        updateItem(item.id, { status: 'done', resultBlob: result.blob, resultUrl: result.url });
        done++;
      } catch (err: any) {
        console.error(`Convert failed for ${item.fileName}:`, err);
        updateItem(item.id, { status: 'error', error: err?.message || 'Failed' });
      }
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

  return (
    <MiniToolShell
      icon={ArrowLeftRight}
      title="File Converter"
      countLabel={items.length > 0 ? `${doneCount}/${items.length}` : undefined}
      onReset={reset}
      showReset={items.length > 0}
      dragDrop={{ onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: handleDragLeave, isDragOver }}
    >
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
              accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif,image/bmp"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
          </label>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Preview */}
            <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950/40 min-h-[300px] flex items-center justify-center">
              {previewItem ? (
                <>
                  <img
                    src={previewItem.resultUrl || previewItem.sourceUrl}
                    alt={previewItem.fileName}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                  {previewItem.status === 'processing' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/60 backdrop-blur-sm">
                      <GlitchLoader size={20} color="brand-cyan" />
                    </div>
                  )}
                  {previewItem.status === 'done' && (
                    <span className="absolute top-2 right-2 text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">
                      {outputFormat.toUpperCase()}
                    </span>
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
                  accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif,image/bmp"
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
                    <img src={previewItem?.id === item.id && item.resultUrl ? item.resultUrl : item.sourceUrl} alt="" className="w-10 h-10 rounded object-cover bg-neutral-900 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-neutral-300 truncate">{item.fileName}</p>
                      <div className="flex items-center gap-1">
                        <FormatBadge from={item.inputFormat} to={outputFormat} />
                        <span className="text-[9px] font-mono text-neutral-600">{formatBytes(item.originalSize)}</span>
                        {item.status === 'done' && item.resultBlob && (
                          <>
                            <ArrowRight size={7} className="text-neutral-600" />
                            <span className="text-[9px] font-mono text-neutral-500">{formatBytes(item.resultBlob.size)}</span>
                          </>
                        )}
                      </div>
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        {items.length > 0 && (
          <div className="space-y-4">
            {/* Format selector + Quality */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-neutral-500 uppercase">Format</span>
                <div className="flex gap-1">
                  {OUTPUT_FORMATS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setOutputFormat(f)}
                      disabled={isProcessing}
                      className={cn(
                        'px-2.5 py-0.5 rounded text-xs font-mono transition-all',
                        outputFormat === f
                          ? 'bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40'
                          : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-600',
                      )}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {outputFormat === 'jpg' && (
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">Quality</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={jpgQuality}
                    onChange={(e) => setJpgQuality(parseInt(e.target.value, 10))}
                    disabled={isProcessing}
                    className="flex-1 h-1 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-brand-cyan"
                  />
                  <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">{jpgQuality}%</span>
                </div>
              )}
            </div>

            {/* Size summary */}
            {doneCount > 0 && totalOriginal > 0 && (
              <div className="text-[10px] font-mono text-neutral-500">
                {formatBytes(totalOriginal)} <ArrowRight size={8} className="inline text-neutral-600" /> {formatBytes(totalConverted)}
                {totalConverted < totalOriginal && (
                  <span className="text-emerald-500 ml-1">
                    (-{Math.round((1 - totalConverted / totalOriginal) * 100)}%)
                  </span>
                )}
                {totalConverted > totalOriginal && (
                  <span className="text-amber-500 ml-1">
                    (+{Math.round((totalConverted / totalOriginal - 1) * 100)}%)
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {queuedOrErrorCount > 0 && (
                <Button
                  onClick={handleConvertAll}
                  disabled={isProcessing}
                  className="flex-1 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  {isProcessing ? <GlitchLoader size={14} color="currentColor" /> : <ArrowLeftRight size={14} />}
                  <span className="ml-2">
                    {isProcessing ? 'Converting...' : `Convert ${queuedOrErrorCount > 1 ? `${queuedOrErrorCount} files` : 'All'}`}
                  </span>
                </Button>
              )}
              {doneCount > 0 && (
                <Button
                  onClick={handleDownloadAll}
                  className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  <Download size={14} />
                  <span className="ml-2">{doneCount > 1 ? `Download ZIP (${doneCount})` : 'Download'}</span>
                </Button>
              )}
            </div>
          </div>
        )}
    </MiniToolShell>
  );
};

/* ── Sub-components ── */

function FormatBadge({ from, to }: { from: string; to: string }) {
  if (from === to) return null;
  return (
    <span className="text-[9px] font-mono uppercase bg-neutral-800 text-neutral-400 px-1 py-px rounded">
      {from} <ArrowRight size={7} className="inline text-brand-cyan" /> {to}
    </span>
  );
}

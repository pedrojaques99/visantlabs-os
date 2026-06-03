import React, { useCallback, useRef, useState } from 'react';
import { Eraser, Upload, Download, Copy, X, Eye, EyeOff, Cpu, Zap, Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBgRemoveStore, type BgRemoveItem } from '@/stores/bgRemoveStore';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { removeBackgroundSimple, removeBackgroundAI } from '@/utils/bgRemoval';
import type { BgRemovalMode, FocusRegion } from '@/utils/bgRemoval';
import { downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import JSZip from 'jszip';

// ─── Focus Region Selector ─────────────────────────────────────────────────

interface FocusSelectorProps {
  region: FocusRegion | null;
  onChange: (r: FocusRegion | null) => void;
  disabled?: boolean;
}

function FocusSelector({ region, onChange, disabled }: FocusSelectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [current, setCurrent] = useState<{ x: number; y: number } | null>(null);

  const toNorm = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleDown = (e: React.MouseEvent) => {
    if (disabled) return;
    const p = toNorm(e);
    setStart(p);
    setCurrent(p);
    setIsDragging(true);
    onChange(null);
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!isDragging || !start) return;
    setCurrent(toNorm(e));
  };

  const handleUp = () => {
    if (!isDragging || !start || !current) return;
    setIsDragging(false);
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const w = Math.abs(current.x - start.x);
    const h = Math.abs(current.y - start.y);
    if (w < 0.03 || h < 0.03) {
      setStart(null);
      setCurrent(null);
      return;
    }
    onChange({ x, y, w, h });
  };

  const sel =
    isDragging && start && current
      ? {
          x: Math.min(start.x, current.x),
          y: Math.min(start.y, current.y),
          w: Math.abs(current.x - start.x),
          h: Math.abs(current.y - start.y),
        }
      : region;

  return (
    <div
      className="absolute inset-0 z-10"
      style={{ cursor: disabled ? 'default' : 'crosshair' }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={() => {
        if (isDragging) handleUp();
      }}
    >
      {sel && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-black/50 transition-opacity duration-200"
            style={{
              clipPath: `polygon(
                0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                ${sel.x * 100}% ${sel.y * 100}%,
                ${sel.x * 100}% ${(sel.y + sel.h) * 100}%,
                ${(sel.x + sel.w) * 100}% ${(sel.y + sel.h) * 100}%,
                ${(sel.x + sel.w) * 100}% ${sel.y * 100}%,
                ${sel.x * 100}% ${sel.y * 100}%
              )`,
            }}
          />
          <div
            className="absolute border-2 border-brand-cyan rounded-sm shadow-[0_0_20px_rgba(0,229,255,0.15)]"
            style={{
              left: `${sel.x * 100}%`,
              top: `${sel.y * 100}%`,
              width: `${sel.w * 100}%`,
              height: `${sel.h * 100}%`,
            }}
          >
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
              <div
                key={pos}
                className="absolute w-2 h-2 bg-brand-cyan rounded-full border border-white shadow-lg"
                style={{
                  ...(pos.includes('top') ? { top: -4 } : { bottom: -4 }),
                  ...(pos.includes('left') ? { left: -4 } : { right: -4 }),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ──────────────────────────────────────────────────────────

function ProgressBar({ value, phase }: { value: number; phase?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider truncate">
          {phase || 'Processing'}
        </span>
        <span className="text-[10px] font-mono text-brand-cyan tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-cyan rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(2, value * 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Processing ────────────────────────────────────────────────────────────

async function processItem(
  item: BgRemoveItem,
  mode: BgRemovalMode,
  threshold: number,
  feather: number,
  focusRegion: FocusRegion | null,
  updateItem: (id: string, patch: Partial<BgRemoveItem>) => void
) {
  updateItem(item.id, { status: 'processing', progressPhase: 'Starting', progressValue: 0 });

  const onProgress = (phase: string, progress: number) => {
    updateItem(item.id, { progressPhase: phase, progressValue: progress });
  };

  try {
    let result: string;
    if (mode === 'ai') {
      result = await removeBackgroundAI(item.sourceUrl, onProgress, focusRegion);
    } else {
      result = await removeBackgroundSimple(item.sourceUrl, { threshold, feather }, onProgress);
    }
    updateItem(item.id, {
      status: 'done',
      resultBase64: result,
      progressPhase: 'Done',
      progressValue: 1,
    });
  } catch (err: any) {
    console.error(`Bg removal failed for ${item.fileName}:`, err);
    updateItem(item.id, {
      status: 'error',
      error: err?.message || 'Failed',
      progressPhase: undefined,
      progressValue: undefined,
    });
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────

export const BgRemovePage: React.FC = () => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [focusActive, setFocusActive] = useState(false);

  const items = useBgRemoveStore((s) => s.items);
  const mode = useBgRemoveStore((s) => s.mode);
  const threshold = useBgRemoveStore((s) => s.threshold);
  const feather = useBgRemoveStore((s) => s.feather);
  const isProcessing = useBgRemoveStore((s) => s.isProcessing);
  const focusRegion = useBgRemoveStore((s) => s.focusRegion);
  const addFiles = useBgRemoveStore((s) => s.addFiles);
  const removeItem = useBgRemoveStore((s) => s.removeItem);
  const updateItem = useBgRemoveStore((s) => s.updateItem);
  const setMode = useBgRemoveStore((s) => s.setMode);
  const setThreshold = useBgRemoveStore((s) => s.setThreshold);
  const setFeather = useBgRemoveStore((s) => s.setFeather);
  const setIsProcessing = useBgRemoveStore((s) => s.setIsProcessing);
  const setFocusRegion = useBgRemoveStore((s) => s.setFocusRegion);
  const reset = useBgRemoveStore((s) => s.reset);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const queuedOrErrorCount = items.filter(
    (i) => i.status === 'queued' || i.status === 'error'
  ).length;
  const processingItem = items.find((i) => i.status === 'processing');
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
      if (valid.length) {
        addFiles(valid);
        toast.success(`${valid.length} image${valid.length > 1 ? 's' : ''} added`);
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

  const handleProcessAll = useCallback(async () => {
    if (isProcessing) return;
    const toProcess = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!toProcess.length) {
      toast.info('Nothing to process');
      return;
    }

    setIsProcessing(true);
    toast.info(
      `Processing ${toProcess.length} image${toProcess.length > 1 ? 's' : ''} with ${
        mode === 'ai' ? 'AI' : 'simple'
      } mode…`
    );

    let done = 0;
    for (const item of toProcess) {
      await processItem(item, mode, threshold, feather, focusRegion, updateItem);
      done++;
      if (toProcess.length > 1) {
        toast.info(`${done}/${toProcess.length} complete`, { id: 'bg-progress' });
      }
    }
    setIsProcessing(false);
    setFocusRegion(null);
    setFocusActive(false);
    toast.success(`${done} image${done > 1 ? 's' : ''} processed`, { id: 'bg-progress' });
  }, [
    items,
    mode,
    threshold,
    feather,
    focusRegion,
    isProcessing,
    updateItem,
    setIsProcessing,
    setFocusRegion,
  ]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      await downloadImage(doneItems[0].resultBase64, 'bg-removed');
      toast.success('Image downloaded');
      return;
    }

    toast.info('Creating ZIP…');
    const zip = new JSZip();
    for (const item of doneItems) {
      const base64Data = item.resultBase64.includes(',')
        ? item.resultBase64.split(',')[1]
        : item.resultBase64;
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
    <MiniToolShell
      icon={Eraser}
      title="Background Remover"
      countLabel={items.length > 0 ? `${doneCount}/${items.length}` : undefined}
      onReset={reset}
      showReset={items.length > 0}
      dragDrop={{
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        isDragOver,
      }}
    >
      {/* Mode Toggle */}
      {items.length > 0 && (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-900/60 border border-neutral-800 w-fit">
          <button
            onClick={() => setMode('ai')}
            disabled={isProcessing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium uppercase tracking-wider transition-all',
              mode === 'ai'
                ? 'bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            <Zap size={12} /> AI
          </button>
          <button
            onClick={() => setMode('simple')}
            disabled={isProcessing}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium uppercase tracking-wider transition-all',
              mode === 'simple'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-neutral-500 hover:text-neutral-300'
            )}
          >
            <Cpu size={12} /> Simple
          </button>
        </div>
      )}

      {/* Upload zone */}
      {items.length === 0 ? (
        <label
          className={cn(
            'flex flex-col items-center justify-center gap-3 w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all',
            isDragOver
              ? 'border-brand-cyan bg-brand-cyan/5'
              : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40'
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
              background:
                showOriginal || !previewItem?.resultBase64
                  ? 'rgb(10 10 10 / 0.4)'
                  : 'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 0 0 / 16px 16px',
            }}
          >
            {previewItem ? (
              <>
                <img
                  src={
                    showOriginal
                      ? previewItem.sourceUrl
                      : previewItem.resultBase64 || previewItem.sourceUrl
                  }
                  alt={previewItem.fileName}
                  className="w-full h-auto max-h-[60vh] object-contain"
                />

                {/* Focus selector overlay */}
                {focusActive && !previewItem.resultBase64 && (
                  <FocusSelector
                    region={focusRegion}
                    onChange={setFocusRegion}
                    disabled={isProcessing}
                  />
                )}

                {previewItem.status === 'processing' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/60 backdrop-blur-sm">
                    <GlitchLoader size={20} color="brand-cyan" />
                    {previewItem.progressValue != null && (
                      <div className="w-48">
                        <ProgressBar
                          value={previewItem.progressValue}
                          phase={previewItem.progressPhase}
                        />
                      </div>
                    )}
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

                {previewItem.status === 'error' && (
                  <div className="absolute bottom-2 left-2 right-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] font-mono text-red-400">
                    {previewItem.error || 'Processing failed'}
                  </div>
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

            {/* Global progress */}
            {processingItem && (
              <div className="px-3 py-2 rounded-lg bg-neutral-900/60 border border-neutral-800">
                <ProgressBar
                  value={processingItem.progressValue ?? 0}
                  phase={processingItem.progressPhase}
                />
              </div>
            )}

            {/* Thumbnail queue */}
            <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setPreviewId(item.id)}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all group',
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
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status} />
                      {item.status === 'processing' && item.progressValue != null && (
                        <span className="text-[9px] font-mono text-brand-cyan tabular-nums">
                          {Math.round(item.progressValue * 100)}%
                        </span>
                      )}
                    </div>
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
          {/* AI mode: Focus selector toggle */}
          {mode === 'ai' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setFocusActive(!focusActive);
                  if (focusActive) setFocusRegion(null);
                }}
                disabled={isProcessing}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-mono font-medium uppercase tracking-wider transition-all border',
                  focusActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                    : 'text-neutral-500 border-neutral-800 hover:border-neutral-600 hover:text-neutral-300'
                )}
              >
                <Crosshair size={12} />
                Focus selection
              </button>
              {focusRegion && (
                <span className="text-[10px] font-mono text-brand-cyan flex items-center gap-1">
                  Region selected — AI will focus on this area
                  <button
                    onClick={() => setFocusRegion(null)}
                    className="ml-1 p-0.5 rounded hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}
              {focusActive && !focusRegion && (
                <span className="text-[10px] font-mono text-neutral-600">
                  Draw a rectangle around the subject on the preview
                </span>
              )}
            </div>
          )}

          {/* Simple mode: Threshold + Feather */}
          {mode === 'simple' && (
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
                <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">
                  {threshold}%
                </span>
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
                <span className="text-[10px] font-mono text-neutral-500 w-8 text-right">
                  {feather}px
                </span>
              </div>
            </div>
          )}

          {/* Note */}
          <p className="text-[10px] font-mono text-neutral-600">
            {mode === 'ai'
              ? 'AI mode uses a neural network to detect subjects — works on complex scenes, hair, and transparent objects. First run downloads the model (~30 MB).'
              : 'Simple mode works best for solid-color backgrounds. For complex scenes, switch to AI mode.'}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            {queuedOrErrorCount > 0 && (
              <Button
                onClick={handleProcessAll}
                disabled={isProcessing}
                className="flex-1 bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
              >
                {isProcessing ? (
                  <GlitchLoader size={14} color="currentColor" />
                ) : mode === 'ai' ? (
                  <Zap size={14} />
                ) : (
                  <Eraser size={14} />
                )}
                <span className="ml-2">
                  {isProcessing
                    ? 'Processing...'
                    : `Remove ${
                        queuedOrErrorCount > 1 ? `${queuedOrErrorCount} images` : 'background'
                      }`}
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
                  <span className="ml-2">
                    {doneCount > 1 ? `Download ZIP (${doneCount})` : 'Download'}
                  </span>
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
    </MiniToolShell>
  );
};

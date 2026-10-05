import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Upload, X, Eye, EyeOff, Cpu, Zap, Crosshair } from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBgRemoveStore, type BgRemoveItem } from '@/stores/bgRemoveStore';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { removeBackgroundSimple, removeBackgroundAI } from '@/utils/bgRemoval';
import type { BgRemovalMode, FocusRegion } from '@/utils/bgRemoval';
import { downloadImage } from '@/utils/imageUtils';
import { copyImageAsPng, downloadBlob } from '@/utils/clipboard';
import { validateFile } from '@/utils/fileUtils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { useToolInput } from '@/hooks/useToolInput';
import { QuickActions } from '@/components/shared/QuickActions';
import JSZip from 'jszip';
import { glassSurface } from '@/lib/ui/glass';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { Thumb } from '@/components/ui/Thumb';
import { fade, transitions } from '@/lib/ui/motion';

/**
 * Local scale-fade — the module has no scale preset, but the tokens do the work.
 * Starts at .96 (never scale(0)) and rides the shared enter ease/duration.
 */
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

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
            className="absolute inset-0 bg-background/60 transition-opacity duration-200"
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
            className="absolute border-2 border-ring rounded-sm"
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
                className="absolute w-2 h-2 bg-ring rounded-full border border-background"
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

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-medium text-muted-foreground truncate">{label}</span>
        <span className="text-2xs font-mono text-muted-foreground tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>
      {/* width is non-GPU, but a progress fill has no transform equivalent
          (scaleX would distort the rounded cap). Scoped off `transition-colors`. */}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-muted-foreground rounded-full transition-[width] duration-200 ease-out"
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
  updateItem(item.id, { status: 'processing', progressValue: 0 });

  const onProgress = (progress: number) => {
    updateItem(item.id, { progressValue: progress });
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
      progressValue: 1,
    });
  } catch (err: any) {
    console.error(`Bg removal failed for ${item.fileName}:`, err);
    updateItem(item.id, {
      status: 'error',
      error: err?.message,
      progressValue: undefined,
    });
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────

export const BgRemovePage: React.FC = () => {
  const { t } = useTranslation();
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

  const { pendingAsset, acceptAsset } = useToolInput('remove-bg');
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
      toast.info(t('miniTools.nothingToProcess'));
      return;
    }

    setIsProcessing(true);
    let done = 0;
    for (const item of toProcess) {
      await processItem(item, mode, threshold, feather, focusRegion, updateItem);
      done++;
    }
    setIsProcessing(false);
    setFocusRegion(null);
    setFocusActive(false);
    toast.success(t('miniTools.bgRemove.done', { count: done }));
  }, [
    t,
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevSliderRef = useRef({ threshold, feather });

  useEffect(() => {
    if (mode !== 'simple' || isProcessing) return;
    const hadResult = items.some((i) => i.status === 'done');
    if (!hadResult) return;
    if (prevSliderRef.current.threshold === threshold && prevSliderRef.current.feather === feather)
      return;
    prevSliderRef.current = { threshold, feather };

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const toReprocess = items.filter((i) => i.status === 'done');
      if (!toReprocess.length) return;
      setIsProcessing(true);
      for (const item of toReprocess) {
        await processItem(item, 'simple', threshold, feather, null, updateItem);
      }
      setIsProcessing(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [threshold, feather, mode, isProcessing, items, updateItem, setIsProcessing]);

  const handleDownloadAll = useCallback(async () => {
    const doneItems = items.filter((i) => i.status === 'done' && i.resultBase64);
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      await downloadImage(doneItems[0].resultBase64, 'bg-removed');
      return;
    }

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
    toast.success(t('miniTools.zipDownloaded'));
  }, [items, t]);

  const handleCopyPreview = useCallback(async () => {
    const src = previewItem?.resultBase64 || previewItem?.sourceUrl;
    if (!src) return;
    const result = await copyImageAsPng(src);
    if (result.success) toast.success(t('miniTools.copied'));
    else toast.error(result.error || t('miniTools.copyFailed'));
  }, [previewItem, t]);

  const toggleOriginal = useCallback(() => setShowOriginal((v) => !v), []);

  const hasItems = items.length > 0;

  // ─── Panel ────────────────────────────────────────────────────────────────

  const modeClass = (selected: boolean) =>
    cn(
      'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-200',
      selected
        ? 'border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    );

  const panelContent = hasItems ? (
    <div className="space-y-5">
      {/* Mode toggle — top of panel */}
      <div className={cn('flex items-center gap-1 p-1 rounded-xl', glassSurface.surface)}>
        <button
          type="button"
          onClick={() => setMode('ai')}
          disabled={isProcessing}
          className={modeClass(mode === 'ai')}
        >
          <Zap size={12} /> {t('miniTools.bgRemove.modeAi')}
        </button>
        <button
          type="button"
          onClick={() => setMode('simple')}
          disabled={isProcessing}
          className={modeClass(mode === 'simple')}
        >
          <Cpu size={12} /> {t('miniTools.bgRemove.modeSimple')}
        </button>
      </div>

      {/* Add more + thumbnail queue */}
      <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors duration-200 hover:border-ring hover:text-foreground">
        <Upload size={12} />
        {t('miniTools.addImages')}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </label>

      <AnimatePresence>
        {processingItem && (
          <motion.div
            className={cn('px-3 py-2 rounded-lg', glassSurface.surface)}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.base}
          >
            <ProgressBar value={processingItem.progressValue ?? 0} label={t('common.processing')} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-h-[32vh] overflow-y-auto space-y-1.5 pr-1">
        {items.map((item) => (
          <motion.div
            key={item.id}
            onClick={() => setPreviewId(item.id)}
            {...fade}
            layout
            className={cn(
              'group flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors duration-200',
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
              <div className="flex items-center gap-2">
                <StatusBadge status={item.status} />
                {item.status === 'processing' && item.progressValue != null && (
                  <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                    {Math.round(item.progressValue * 100)}%
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
        <AnimatePresence mode="wait">
          {mode === 'ai' ? (
            <motion.div key="ai-controls" {...fade} className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setFocusActive(!focusActive);
                  if (focusActive) setFocusRegion(null);
                }}
                disabled={isProcessing}
                className={cn(
                  'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors duration-200',
                  focusActive
                    ? 'bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30'
                    : 'text-muted-foreground border-border hover:border-ring hover:text-foreground'
                )}
              >
                <Crosshair size={12} />
                {t('miniTools.bgRemove.focusSelection')}
              </button>
              <AnimatePresence>
                {focusRegion && (
                  <motion.div
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    {...fade}
                  >
                    <span className="flex-1">{t('miniTools.bgRemove.regionSelected')}</span>
                    <button
                      type="button"
                      aria-label={t('miniTools.bgRemove.clearRegion')}
                      onClick={() => setFocusRegion(null)}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </motion.div>
                )}
                {focusActive && !focusRegion && (
                  <motion.span className="block text-xs text-muted-foreground" {...fade}>
                    {t('miniTools.bgRemove.drawHint')}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="simple-controls" {...fade} className="space-y-3">
              {/* Threshold */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('miniTools.bgRemove.threshold')}
                  </span>
                  <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                    {threshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
                />
              </div>
              {/* Feather */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('miniTools.bgRemove.feather')}
                  </span>
                  <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                    {feather}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={feather}
                  onChange={(e) => setFeather(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-brand-cyan"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground">
          {mode === 'ai' ? t('miniTools.bgRemove.aiHint') : t('miniTools.bgRemove.simpleHint')}
        </p>
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
                className="w-full bg-brand-cyan/10 hover:bg-brand-cyan/20 text-foreground border border-brand-cyan/30 text-xs font-medium transition-colors duration-200"
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
                    ? t('common.processing')
                    : queuedOrErrorCount > 1
                      ? t('miniTools.bgRemove.runCount', { count: queuedOrErrorCount })
                      : t('miniTools.bgRemove.run')}
                </span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {doneCount > 0 && !isProcessing && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="remove-bg"
                outputMime="image/png"
                summary={t('miniTools.bgRemove.done', { count: doneCount })}
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

  // ─── Status bar ───────────────────────────────────────────────────────────

  const statusBarContent = hasItems ? (
    <div className="flex items-center gap-3 text-2xs tabular-nums text-muted-foreground">
      <span>
        {doneCount}/{items.length}
      </span>
    </div>
  ) : undefined;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <MiniAppShell
      icon={Eraser}
      title={t('apps.backgroundRemover.name')}
      toolId="remove-bg"
      documentTitle={t('apps.backgroundRemover.name')}
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
            <label className="flex h-48 w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 text-center text-sm text-muted-foreground transition-colors duration-200 hover:border-ring hover:text-foreground">
              <Upload size={20} />
              {t('miniTools.dropImages')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </label>
          </motion.div>
        ) : (
          /* ─── Working state — preview centered in children ─── */
          <motion.div
            key="workspace"
            {...fadeScale}
            className="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-border min-h-[300px] flex items-center justify-center"
            style={{
              background:
                showOriginal || !previewItem?.resultBase64
                  ? 'var(--muted)'
                  : 'repeating-conic-gradient(var(--muted) 0% 25%, var(--card) 0% 50%) 0 0 / 16px 16px',
            }}
          >
            {previewItem ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={showOriginal ? 'original' : previewItem.resultBase64 || 'source'}
                    src={
                      showOriginal
                        ? previewItem.sourceUrl
                        : previewItem.resultBase64 || previewItem.sourceUrl
                    }
                    alt={previewItem.fileName}
                    className="w-full h-auto max-h-[60vh] object-contain"
                    {...fade}
                  />
                </AnimatePresence>

                {/* Focus region selector — co-located with preview so coordinate math works */}
                {focusActive && !previewItem.resultBase64 && (
                  <FocusSelector
                    region={focusRegion}
                    onChange={setFocusRegion}
                    disabled={isProcessing}
                  />
                )}

                {/* Processing overlay */}
                <AnimatePresence>
                  {previewItem.status === 'processing' && (
                    <motion.div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80"
                      {...fade}
                    >
                      <GlitchLoader size={20} color="currentColor" />
                      {previewItem.progressValue != null && (
                        <div className="w-48">
                          <ProgressBar
                            value={previewItem.progressValue}
                            label={t('common.processing')}
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Original/Result toggle */}
                <AnimatePresence>
                  {previewItem.status === 'done' && (
                    <motion.button
                      type="button"
                      onClick={toggleOriginal}
                      className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-background"
                      title={
                        showOriginal
                          ? t('miniTools.bgRemove.showResult')
                          : t('miniTools.bgRemove.showOriginal')
                      }
                      {...fade}
                    >
                      {showOriginal ? <EyeOff size={10} /> : <Eye size={10} />}
                      {showOriginal
                        ? t('miniTools.bgRemove.original')
                        : t('miniTools.bgRemove.result')}
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Error badge */}
                <AnimatePresence>
                  {previewItem.status === 'error' && (
                    <motion.div
                      className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive"
                      {...fade}
                    >
                      {previewItem.error || t('miniTools.processFailed')}
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

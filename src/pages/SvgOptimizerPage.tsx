import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  FileCode,
  Eye,
  Code,
  X,
  Settings2,
  Image,
  RefreshCw,
  AlertCircle,
  PenTool,
  ArrowRight,
} from '@/lib/ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSvgOptimizerStore } from '@/stores/svgOptimizerStore';
import { TRACE_PRESETS, type TracePreset } from '@/services/svgPipeline';
import { sanitizeSvgForRender } from '@/utils/svgOptimizer';
import { downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { MiniAppShell } from '@/components/shared/MiniAppShell';
import { QuickActions } from '@/components/shared/QuickActions';
import { Button } from '@/components/ui/button';
import { Dropzone } from '@/components/ui/Dropzone';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { FlyingPaperLoader } from '@/components/ui/FlyingPaperLoader';
import { formatBytes } from '@/utils/formatUtils';
import { useToolInput } from '@/hooks/useToolInput';
import JSZip from 'jszip';
import { glassSurface } from '@/lib/ui/glass';
import { useTranslation } from '@/hooks/useTranslation';
import { hoverReveal } from '@/lib/ui/hoverReveal';
import { fade, transitions } from '@/lib/ui/motion';

/** Local scale-fade — no scale preset in the module; tokens supply ease/duration. */
const fadeScale = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: transitions.base,
};

const SvgVectorEditor = lazy(() =>
  import('@/components/svg-optimizer/SvgVectorEditor').then((m) => ({ default: m.SvgVectorEditor }))
);

/** Option keys, labelled by `miniTools.svg.opt.<key>`. */
const OPTION_KEYS = [
  'removeComments',
  'removeMetadata',
  'removeEditorData',
  'removeEmptyGroups',
  'minifyPaths',
  'removeHiddenElements',
  'prettify',
] as const;

const ACCEPTED_TYPES =
  '.svg,.png,.jpg,.jpeg,.webp,.bmp,image/svg+xml,image/png,image/jpeg,image/webp,image/bmp';

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith('image/') &&
    file.type !== 'image/svg+xml' &&
    !file.name.toLowerCase().endsWith('.svg')
  );
}

function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

export const SvgOptimizerPage: React.FC = () => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteValue, setPasteValue] = useState('');

  const items = useSvgOptimizerStore((s) => s.items);
  const options = useSvgOptimizerStore((s) => s.options);
  const viewMode = useSvgOptimizerStore((s) => s.viewMode);
  const selectedId = useSvgOptimizerStore((s) => s.selectedId);
  const addSvgFiles = useSvgOptimizerStore((s) => s.addSvgFiles);
  const addPngFiles = useSvgOptimizerStore((s) => s.addPngFiles);
  const retraceItem = useSvgOptimizerStore((s) => s.retraceItem);
  const updateItemSvg = useSvgOptimizerStore((s) => s.updateItemSvg);
  const removeItem = useSvgOptimizerStore((s) => s.removeItem);
  const setOption = useSvgOptimizerStore((s) => s.setOption);
  const setViewMode = useSvgOptimizerStore((s) => s.setViewMode);
  const setSelectedId = useSvgOptimizerStore((s) => s.setSelectedId);
  const reset = useSvgOptimizerStore((s) => s.reset);

  const { pendingAsset, acceptAsset } = useToolInput('svg-optimizer');
  useEffect(() => {
    if (!pendingAsset) return;
    const asset = acceptAsset();
    if (!asset) return;
    const b64 = asset.imageBase64 || '';
    // SVG data URL: decode the base64 SVG content
    if (b64.startsWith('data:image/svg+xml;base64,')) {
      const svgContent = atob(b64.replace('data:image/svg+xml;base64,', ''));
      addSvgFiles([{ name: asset.label || 'pipeline-asset.svg', content: svgContent }]);
    } else if (b64.includes('<svg')) {
      // Raw SVG string passed as base64 field
      addSvgFiles([{ name: asset.label || 'pipeline-asset.svg', content: b64 }]);
    } else if (asset.imageUrl) {
      // Fetch the URL — could be SVG or raster
      fetch(asset.imageUrl)
        .then((r) => r.text())
        .then((text) => {
          if (text.includes('<svg')) {
            addSvgFiles([{ name: asset.label || 'pipeline-asset.svg', content: text }]);
          } else {
            toast.error(t('miniTools.processFailed'));
          }
        })
        .catch(() => toast.error(t('miniTools.processFailed')));
    }
  }, [pendingAsset, acceptAsset, addSvgFiles, t]);

  const hasItems = items.length > 0;
  const selectedItem = items.find((i) => i.id === selectedId) || items[0];

  const doneItems = items.filter((i) => i.status === 'done');
  const totalOriginal = doneItems.reduce((sum, i) => sum + i.originalSize, 0);
  const totalOptimized = doneItems.reduce((sum, i) => sum + i.optimizedSize, 0);
  const totalSavings =
    totalOriginal > 0 ? Math.round((1 - totalOptimized / totalOriginal) * 100) : 0;

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const svgPending: Promise<{ name: string; content: string } | null>[] = [];
      const pngFiles: File[] = [];

      Array.from(fileList).forEach((file) => {
        if (isSvgFile(file)) {
          svgPending.push(
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ name: file.name, content: reader.result as string });
              reader.onerror = () => {
                toast.error(t('miniTools.svg.readFailed', { name: file.name }));
                resolve(null);
              };
              reader.readAsText(file);
            })
          );
        } else if (isImageFile(file)) {
          pngFiles.push(file);
        } else {
          toast.error(t('miniTools.svg.unsupported', { name: file.name }));
        }
      });

      if (pngFiles.length) {
        addPngFiles(pngFiles);
      }

      if (svgPending.length) {
        Promise.all(svgPending).then((results) => {
          const valid = results.filter(Boolean) as { name: string; content: string }[];
          if (valid.length) addSvgFiles(valid);
        });
      }
    },
    [addSvgFiles, addPngFiles, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteValue.trim();
    if (!trimmed || !trimmed.includes('<svg')) {
      toast.error(t('miniTools.svg.invalidPaste'));
      return;
    }
    addSvgFiles([{ name: `pasted-${Date.now()}.svg`, content: trimmed }]);
    setPasteValue('');
    setPasteMode(false);
  }, [pasteValue, addSvgFiles, t]);

  const handleDownloadAll = useCallback(async () => {
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      const item = doneItems[0];
      const blob = new Blob([item.optimizedSvg], { type: 'image/svg+xml' });
      downloadBlob(blob, item.fileName.replace(/\.\w+$/i, '') + '-optimized.svg');
      toast.success(t('miniTools.downloaded'));
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const name = item.fileName.replace(/\.\w+$/i, '') + '-optimized.svg';
      zip.file(name, item.optimizedSvg);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `svg-optimized-${Date.now()}.zip`);
    toast.success(t('miniTools.zipDownloaded'));
  }, [doneItems, t]);

  const handleCopy = useCallback(async () => {
    if (!selectedItem || selectedItem.status !== 'done') return;
    const ok = await copyToClipboard(selectedItem.optimizedSvg);
    if (ok) toast.success(t('miniTools.svg.copied'));
    else toast.error(t('miniTools.copyFailed'));
  }, [selectedItem, t]);

  // Local trace slider state for selected PNG item
  const [localTurd, setLocalTurd] = useState(3);
  const [localOpt, setLocalOpt] = useState(0.3);
  const [localThresh, setLocalThresh] = useState<number | 'auto'>('auto');
  const [localAlphaMax, setLocalAlphaMax] = useState(0.8);
  const [localPreset, setLocalPreset] = useState<TracePreset>('logo');

  const syncLocalTrace = useCallback((item: typeof selectedItem) => {
    if (item?.source === 'png') {
      setLocalTurd(item.traceOptions.turdSize ?? 3);
      setLocalOpt(item.traceOptions.optTolerance ?? 0.3);
      setLocalThresh(item.traceOptions.threshold ?? 'auto');
      setLocalAlphaMax(item.traceOptions.alphaMax ?? 0.8);
      setLocalPreset(item.traceOptions.preset ?? 'logo');
    }
  }, []);

  const prevSelectedRef = useRef<string | null>(null);
  if (selectedItem && selectedItem.id !== prevSelectedRef.current) {
    prevSelectedRef.current = selectedItem.id;
    if (selectedItem.source === 'png') {
      syncLocalTrace(selectedItem);
    }
  }

  const handlePresetChange = useCallback((preset: TracePreset) => {
    setLocalPreset(preset);
    if (preset !== 'custom') {
      const p = TRACE_PRESETS[preset as keyof typeof TRACE_PRESETS];
      if (p) {
        setLocalTurd(p.defaults.turdSize);
        setLocalOpt(p.defaults.optTolerance);
        setLocalThresh(p.defaults.threshold);
        setLocalAlphaMax(p.defaults.alphaMax);
      }
    }
  }, []);

  const handleRetrace = useCallback(() => {
    if (!selectedItem || selectedItem.source !== 'png') return;
    retraceItem(selectedItem.id, {
      turdSize: localTurd,
      optTolerance: localOpt,
      threshold: localThresh,
      alphaMax: localAlphaMax,
      preset: localPreset,
    });
  }, [selectedItem, retraceItem, localTurd, localOpt, localThresh, localAlphaMax, localPreset]);

  // ── Panel content (queue + controls + actions) ──────────────────────────
  const panelContent = hasItems ? (
    <div className="space-y-5">
      {/* Queue: Add more */}
      <Dropzone
        onFiles={processFiles}
        accept={ACCEPTED_TYPES}
        multiple
        label={t('miniTools.addFiles')}
        size="sm"
        dropTarget={false}
      />

      {/* Queue: Item list */}
      <div className="max-h-[32vh] overflow-y-auto space-y-1.5 pr-1">
        {items.map((item) => (
          <motion.div
            key={item.id}
            layout
            {...fade}
            onClick={() => setSelectedId(item.id)}
            className={cn(
              'group flex items-center gap-2 p-1.5 rounded-xl cursor-pointer transition-colors duration-200',
              selectedItem?.id === item.id ? 'bg-muted ring-1 ring-border' : 'hover:bg-muted/60'
            )}
          >
            {item.source === 'png' ? (
              <Image size={14} className="text-muted-foreground flex-shrink-0" />
            ) : (
              <FileCode size={14} className="text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-2xs font-mono text-foreground truncate">{item.fileName}</p>
              {item.status === 'done' && (
                <span className="flex items-center gap-1 text-2xs font-mono text-muted-foreground">
                  {item.source === 'png'
                    ? formatBytes(item.originalSize) + ' png'
                    : formatBytes(item.originalSize)}
                  <ArrowRight size={8} />
                  {formatBytes(item.optimizedSize)}
                </span>
              )}
              {item.status === 'tracing' && (
                <span className="text-2xs text-muted-foreground">{t('miniTools.svg.tracing')}</span>
              )}
              {item.status === 'error' && (
                <span className="text-2xs text-destructive">{t('common.error')}</span>
              )}
            </div>
            {item.status === 'done' && (
              <span
                className={cn(
                  'text-2xs font-mono flex-shrink-0',
                  item.savings > 0 ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {item.savings > 0 ? `-${item.savings}%` : '0%'}
              </span>
            )}
            {item.status === 'tracing' && <GlitchLoader size={10} />}
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

      {/* Controls: Optimization options */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings2 size={12} className="text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            {t('miniTools.svg.options')}
          </span>
        </div>
        <div className="space-y-1.5">
          {OPTION_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options[key as keyof typeof options]}
                onChange={(e) => setOption(key as keyof typeof options, e.target.checked)}
                className="w-3 h-3 rounded accent-brand-cyan"
              />
              <span className="text-xs font-medium text-muted-foreground">
                {t(`miniTools.svg.opt.${key}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Controls: PNG trace (only for selected PNG item) */}
      {selectedItem && selectedItem.source === 'png' && selectedItem.status !== 'tracing' && (
        <>
          <div className="h-px bg-border" />
          <motion.div {...fade} className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t('miniTools.svg.tracePreset')}
            </span>
            <SegmentedControl
              aria-label={t('miniTools.svg.tracePreset')}
              size="sm"
              fullWidth
              className="flex-wrap"
              value={localPreset}
              onChange={handlePresetChange}
              options={(['logo', 'lettering', 'lineArt', 'stamp', 'custom'] as const).map((p) => ({
                value: p,
                label: t(`miniTools.svg.preset.${p}`),
              }))}
            />
            {localPreset === 'custom' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label={t('miniTools.svg.noise')}
                    value={localTurd}
                    min={0}
                    max={20}
                    step={1}
                    onChange={setLocalTurd}
                  />
                  <ScrubInput
                    label={t('miniTools.svg.simplify')}
                    value={localOpt}
                    min={0}
                    max={2}
                    step={0.05}
                    onChange={setLocalOpt}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubInput
                    label={t('miniTools.svg.threshold')}
                    value={typeof localThresh === 'number' ? localThresh : 128}
                    min={0}
                    max={255}
                    step={1}
                    onChange={setLocalThresh}
                  />
                  <ScrubInput
                    label={t('miniTools.svg.corners')}
                    value={localAlphaMax}
                    min={0}
                    max={1.334}
                    step={0.05}
                    onChange={setLocalAlphaMax}
                  />
                </div>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full text-xs font-medium h-8"
              onClick={handleRetrace}
            >
              <RefreshCw size={12} className="mr-1.5" /> {t('miniTools.svg.retrace')}
            </Button>
          </motion.div>
        </>
      )}

      <div className="h-px bg-border" />

      {/* Actions */}
      <div className="space-y-2">
        <AnimatePresence>
          {doneItems.length > 0 && (
            <motion.div {...fadeScale}>
              <QuickActions
                toolId="svg-optimizer"
                outputMime="image/svg+xml"
                summary={t('miniTools.svg.summary', {
                  count: doneItems.length,
                  saved: formatBytes(totalOriginal - totalOptimized),
                  percent: totalSavings,
                })}
                onDownloadAll={handleDownloadAll}
                onCopy={handleCopy}
                assetData={
                  selectedItem && selectedItem.status === 'done'
                    ? {
                        imageBase64: btoa(unescape(encodeURIComponent(selectedItem.optimizedSvg))),
                        mimeType: 'image/svg+xml',
                        label: selectedItem.fileName,
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

  // ── Status bar ───────────────────────────────────────────────────────────
  const statusBarContent = hasItems ? (
    <div className="flex items-center gap-3 text-2xs tabular-nums text-muted-foreground">
      <span>
        {doneItems.length}/{items.length}
      </span>
      {doneItems.length > 0 && totalSavings > 0 && (
        <>
          <span>·</span>
          <span className="text-success">{t('miniTools.smaller', { percent: totalSavings })}</span>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <MiniAppShell
      icon={FileCode}
      title={t('apps.svgOptimizer.name')}
      toolId="svg-optimizer"
      documentTitle={t('apps.svgOptimizer.name')}
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
          /* ── Empty / Upload state ── */
          <motion.div
            key="upload"
            {...fade}
            className="flex w-full flex-col items-center gap-4 py-8"
          >
            <Dropzone
              onFiles={processFiles}
              accept={ACCEPTED_TYPES}
              multiple
              label={t('miniTools.svg.drop')}
              hint={t('miniTools.svg.pngHint')}
              dropTarget={false}
              className="max-w-md"
            />

            <AnimatePresence mode="wait">
              {!pasteMode ? (
                <motion.button
                  key="paste-toggle"
                  type="button"
                  {...fade}
                  onClick={() => setPasteMode(true)}
                  className="w-full max-w-md text-center text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {t('miniTools.svg.pasteCode')}
                </motion.button>
              ) : (
                <motion.div key="paste-area" {...fade} className="w-full max-w-md space-y-2">
                  <textarea
                    value={pasteValue}
                    onChange={(e) => setPasteValue(e.target.value)}
                    placeholder="<svg ...>...</svg>"
                    className="w-full h-32 bg-background border border-border rounded-xl p-3 text-xs font-mono text-foreground resize-none focus:outline-none focus:border-ring"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePasteSubmit}
                      variant="primary"
                      size="sm"
                      className="text-xs"
                    >
                      {t('miniTools.svg.optimize')}
                    </Button>
                    <Button
                      onClick={() => {
                        setPasteMode(false);
                        setPasteValue('');
                      }}
                      variant="outline"
                      className="text-xs font-medium"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* ── Working state: preview centered in children ── */
          <motion.div
            key="workspace"
            {...fadeScale}
            className={cn(
              'relative w-full max-w-3xl rounded-xl overflow-hidden min-h-[300px] flex flex-col',
              glassSurface.surface
            )}
          >
            {/* View mode toggle */}
            <div className="flex items-center gap-1 p-2 border-b border-border">
              <SegmentedControl
                aria-label={t('miniTools.svg.viewMode')}
                size="sm"
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: 'preview', label: t('miniTools.svg.preview'), icon: Eye },
                  { value: 'edit', label: t('common.edit'), icon: PenTool },
                  { value: 'code', label: t('miniTools.svg.code'), icon: Code },
                ]}
              />
            </div>

            {/* Content area */}
            <AnimatePresence mode="wait">
              {selectedItem && selectedItem.status === 'tracing' && (
                <motion.div
                  key="tracing"
                  {...fade}
                  className="flex-1 flex items-center justify-center p-4"
                >
                  <FlyingPaperLoader
                    label={t('miniTools.svg.tracingFile', { name: selectedItem.fileName })}
                  />
                </motion.div>
              )}

              {selectedItem && selectedItem.status === 'error' && (
                <motion.div
                  key="error"
                  {...fade}
                  className="flex-1 flex flex-col items-center justify-center gap-3 p-4"
                >
                  <AlertCircle size={24} className="text-destructive" />
                  <span className="text-xs font-medium text-destructive text-center">
                    {selectedItem.error || t('miniTools.svg.traceFailed')}
                  </span>
                  {selectedItem.source === 'png' && (
                    <Button
                      onClick={() => retraceItem(selectedItem.id)}
                      variant="outline"
                      className="text-xs font-medium mt-1"
                    >
                      <RefreshCw size={12} className="mr-1.5" /> {t('common.retry')}
                    </Button>
                  )}
                </motion.div>
              )}

              {selectedItem && selectedItem.status === 'done' && viewMode === 'preview' && (
                <motion.div
                  key="preview"
                  {...fade}
                  className="flex-1 flex items-center justify-center p-4 overflow-hidden pointer-events-none"
                  style={{ maxHeight: '60vh' }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeSvgForRender(selectedItem.optimizedSvg),
                  }}
                />
              )}

              {selectedItem && selectedItem.status === 'done' && viewMode === 'edit' && (
                <motion.div key="edit" {...fade} className="flex-1 flex flex-col">
                  <Suspense
                    fallback={
                      <div className="flex-1 flex items-center justify-center">
                        <GlitchLoader size={20} />
                      </div>
                    }
                  >
                    <SvgVectorEditor
                      svgString={selectedItem.optimizedSvg}
                      onSvgChange={(newSvg) => {
                        updateItemSvg(selectedItem.id, newSvg);
                        toast.success(t('miniTools.svg.updated'));
                      }}
                      className="flex-1"
                    />
                  </Suspense>
                </motion.div>
              )}

              {selectedItem && selectedItem.status === 'done' && viewMode === 'code' && (
                <motion.pre
                  key="code"
                  {...fade}
                  className="flex-1 p-4 text-xs font-mono text-muted-foreground overflow-auto whitespace-pre-wrap break-all"
                  style={{ maxHeight: '60vh' }}
                >
                  {selectedItem.optimizedSvg}
                </motion.pre>
              )}
            </AnimatePresence>

            {selectedItem && selectedItem.status === 'done' && (
              <div className="absolute top-2 right-2 flex items-center gap-1 text-2xs">
                {selectedItem.source === 'png' && (
                  <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                    {t('miniTools.svg.traced')}
                  </span>
                )}
                <span className="rounded bg-muted px-2 py-0.5 font-mono tabular-nums text-foreground">
                  {selectedItem.savings > 0 ? `-${selectedItem.savings}%` : '0%'}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </MiniAppShell>
  );
};

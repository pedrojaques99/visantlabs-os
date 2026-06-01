import React, { useCallback, useRef, useState, lazy, Suspense } from 'react';
import { FileCode, Upload, Download, Copy, Eye, Code, X, Settings2, Image, RefreshCw, AlertCircle, PenTool } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSvgOptimizerStore } from '@/stores/svgOptimizerStore';
import { TRACE_PRESETS, type TracePreset } from '@/services/svgPipeline';
import { sanitizeSvgForRender } from '@/utils/svgOptimizer';
import { downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { Button } from '@/components/ui/button';
import { ScrubInput } from '@/components/ui/ScrubInput';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { formatBytes } from '@/utils/formatUtils';
import JSZip from 'jszip';

const SvgVectorEditor = lazy(() =>
  import('@/components/svg-optimizer/SvgVectorEditor').then(m => ({ default: m.SvgVectorEditor })),
);

const OPTION_LABELS: Record<string, string> = {
  removeComments: 'Comments',
  removeMetadata: 'Metadata',
  removeEditorData: 'Editor data',
  removeEmptyGroups: 'Empty groups',
  minifyPaths: 'Minify numbers',
  removeHiddenElements: 'Hidden elements',
  prettify: 'Prettify',
};

const ACCEPTED_TYPES = '.svg,.png,.jpg,.jpeg,.webp,.bmp,image/svg+xml,image/png,image/jpeg,image/webp,image/bmp';

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/svg+xml' && !file.name.toLowerCase().endsWith('.svg');
}

function isSvgFile(file: File): boolean {
  return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
}

export const SvgOptimizerPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
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

  const selectedItem = items.find((i) => i.id === selectedId) || items[0];

  const doneItems = items.filter((i) => i.status === 'done');
  const totalOriginal = doneItems.reduce((sum, i) => sum + i.originalSize, 0);
  const totalOptimized = doneItems.reduce((sum, i) => sum + i.optimizedSize, 0);
  const totalSavings = totalOriginal > 0 ? Math.round((1 - totalOptimized / totalOriginal) * 100) : 0;

  const processFiles = useCallback((fileList: FileList) => {
    const svgPending: Promise<{ name: string; content: string } | null>[] = [];
    const pngFiles: File[] = [];

    Array.from(fileList).forEach((file) => {
      if (isSvgFile(file)) {
        svgPending.push(
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, content: reader.result as string });
            reader.onerror = () => { toast.error(`${file.name}: read failed`); resolve(null); };
            reader.readAsText(file);
          }),
        );
      } else if (isImageFile(file)) {
        pngFiles.push(file);
      } else {
        toast.error(`${file.name}: unsupported format`);
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
  }, [addSvgFiles, addPngFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (e.target) e.target.value = '';
  }, [processFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteValue.trim();
    if (!trimmed || !trimmed.includes('<svg')) {
      toast.error('No valid SVG found in pasted content');
      return;
    }
    addSvgFiles([{ name: `pasted-${Date.now()}.svg`, content: trimmed }]);
    setPasteValue('');
    setPasteMode(false);
  }, [pasteValue, addSvgFiles]);

  const handleDownloadAll = useCallback(async () => {
    if (!doneItems.length) return;

    if (doneItems.length === 1) {
      const item = doneItems[0];
      const blob = new Blob([item.optimizedSvg], { type: 'image/svg+xml' });
      downloadBlob(blob, item.fileName.replace(/\.\w+$/i, '') + '-optimized.svg');
      toast.success('Downloaded');
      return;
    }

    const zip = new JSZip();
    for (const item of doneItems) {
      const name = item.fileName.replace(/\.\w+$/i, '') + '-optimized.svg';
      zip.file(name, item.optimizedSvg);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `svg-optimized-${Date.now()}.zip`);
    toast.success('ZIP downloaded');
  }, [doneItems]);

  const handleCopy = useCallback(async () => {
    if (!selectedItem || selectedItem.status !== 'done') return;
    const ok = await copyToClipboard(selectedItem.optimizedSvg);
    if (ok) toast.success('SVG copied');
    else toast.error('Copy failed');
  }, [selectedItem]);

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

  return (
    <MiniToolShell
      icon={FileCode}
      title="SVG Optimizer"
      countLabel={items.length > 0 ? `${items.length} file${items.length > 1 ? 's' : ''}` : undefined}
      onReset={reset}
      showReset={items.length > 0}
      dragDrop={{ onDrop: handleDrop, onDragOver: handleDragOver, onDragLeave: handleDragLeave, isDragOver }}
    >
      {/* Upload zone */}
      {items.length === 0 ? (
        <div className="space-y-3">
          <label
            className={cn(
              'flex flex-col items-center justify-center gap-3 w-full h-48 rounded-xl border-2 border-dashed cursor-pointer transition-all',
              isDragOver ? 'border-brand-cyan bg-brand-cyan/5' : 'border-neutral-800 hover:border-neutral-600 bg-neutral-950/40',
            )}
          >
            <Upload size={24} className="text-neutral-500" />
            <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider text-center px-4">
              Drop PNG or SVG files — batch supported
            </span>
            <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-wider">
              PNG will be traced to vector automatically
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
          </label>
          {!pasteMode ? (
            <button
              onClick={() => setPasteMode(true)}
              className="w-full text-center text-[10px] font-mono text-neutral-600 hover:text-neutral-400 uppercase tracking-wider transition-colors"
            >
              or paste SVG code
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                placeholder="<svg ...>...</svg>"
                className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-300 resize-none focus:outline-none focus:border-brand-cyan/50"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handlePasteSubmit}
                  className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  Optimize
                </Button>
                <Button
                  onClick={() => { setPasteMode(false); setPasteValue(''); }}
                  variant="outline"
                  className="font-mono text-xs uppercase tracking-widest border-neutral-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          {/* Preview / Code */}
          <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950/40 min-h-[300px] flex flex-col">
            {/* View toggle */}
            <div className="flex items-center gap-1 p-2 border-b border-neutral-800">
              <button
                onClick={() => setViewMode('preview')}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all',
                  viewMode === 'preview' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-500 hover:text-neutral-300',
                )}
              >
                <Eye size={10} /> Preview
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all',
                  viewMode === 'edit' ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-500 hover:text-neutral-300',
                )}
              >
                <PenTool size={10} /> Edit
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all',
                  viewMode === 'code' ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-500 hover:text-neutral-300',
                )}
              >
                <Code size={10} /> Code
              </button>
            </div>

            {/* Content area */}
            {selectedItem && selectedItem.status === 'tracing' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                <GlitchLoader size={24} />
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                  Tracing {selectedItem.fileName}...
                </span>
              </div>
            )}

            {selectedItem && selectedItem.status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                <AlertCircle size={24} className="text-red-400" />
                <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider text-center">
                  {selectedItem.error || 'Trace failed'}
                </span>
                {selectedItem.source === 'png' && (
                  <Button
                    onClick={() => retraceItem(selectedItem.id)}
                    variant="outline"
                    className="font-mono text-xs uppercase tracking-widest border-neutral-700 mt-1"
                  >
                    <RefreshCw size={12} className="mr-1.5" /> Retry
                  </Button>
                )}
              </div>
            )}

            {selectedItem && selectedItem.status === 'done' && viewMode === 'preview' && (
              <div
                className="flex-1 flex items-center justify-center p-4 overflow-hidden pointer-events-none"
                style={{ maxHeight: '60vh' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgForRender(selectedItem.optimizedSvg) }}
              />
            )}

            {selectedItem && selectedItem.status === 'done' && viewMode === 'edit' && (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center"><GlitchLoader size={20} /></div>}>
                <SvgVectorEditor
                  svgString={selectedItem.optimizedSvg}
                  onSvgChange={(newSvg) => {
                    updateItemSvg(selectedItem.id, newSvg);
                    toast.success('SVG updated');
                  }}
                  className="flex-1"
                />
              </Suspense>
            )}

            {selectedItem && selectedItem.status === 'done' && viewMode === 'code' && (
              <pre className="flex-1 p-4 text-xs font-mono text-neutral-400 overflow-auto whitespace-pre-wrap break-all" style={{ maxHeight: '60vh' }}>
                {selectedItem.optimizedSvg}
              </pre>
            )}

            {selectedItem && selectedItem.status === 'done' && (
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {selectedItem.source === 'png' && (
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded">
                    traced
                  </span>
                )}
                <span className="text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">
                  {selectedItem.savings > 0 ? `-${selectedItem.savings}%` : '0%'}
                </span>
              </div>
            )}
          </div>

          {/* Right panel: queue + trace controls */}
          <div className="space-y-3">
            {/* Add more */}
            <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all">
              <Upload size={12} />
              Add files
              <input
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
            </label>

            {/* Item list */}
            <div className="max-h-[30vh] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all group',
                    selectedItem?.id === item.id ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30' : 'hover:bg-neutral-900/60',
                  )}
                >
                  {item.source === 'png' ? (
                    <Image size={14} className="text-amber-500/60 flex-shrink-0" />
                  ) : (
                    <FileCode size={14} className="text-neutral-600 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-neutral-300 truncate">{item.fileName}</p>
                    {item.status === 'done' && (
                      <span className="text-[9px] font-mono text-neutral-500">
                        {item.source === 'png' ? formatBytes(item.originalSize) + ' png' : formatBytes(item.originalSize)} &rarr; {formatBytes(item.optimizedSize)}
                      </span>
                    )}
                    {item.status === 'tracing' && (
                      <span className="text-[9px] font-mono text-amber-400">tracing...</span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-[9px] font-mono text-red-400">error</span>
                    )}
                  </div>
                  {item.status === 'done' && (
                    <span className={cn(
                      'text-[9px] font-mono flex-shrink-0',
                      item.savings > 0 ? 'text-emerald-500' : 'text-neutral-600',
                    )}>
                      {item.savings > 0 ? `-${item.savings}%` : '0%'}
                    </span>
                  )}
                  {item.status === 'tracing' && (
                    <GlitchLoader size={10} />
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                    className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-neutral-300 transition-all flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Trace refinement — only for selected PNG item */}
            {selectedItem && selectedItem.source === 'png' && selectedItem.status !== 'tracing' && (
              <div className="space-y-2 p-3 rounded-lg border border-neutral-800 bg-neutral-950/60">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">Trace preset</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['logo', 'lettering', 'lineArt', 'stamp', 'custom'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePresetChange(p)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all',
                        localPreset === p
                          ? 'bg-brand-cyan/20 text-brand-cyan ring-1 ring-brand-cyan/30'
                          : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300',
                      )}
                    >
                      {p === 'lineArt' ? 'Line Art' : p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                {localPreset === 'custom' && (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      <ScrubInput label="Noise" value={localTurd} min={0} max={20} step={1} onChange={setLocalTurd} />
                      <ScrubInput label="Simplify" value={localOpt} min={0} max={2} step={0.05} onChange={setLocalOpt} />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <ScrubInput label="Threshold" value={typeof localThresh === 'number' ? localThresh : 128} min={0} max={255} step={1} onChange={setLocalThresh} />
                      <ScrubInput label="Corners" value={localAlphaMax} min={0} max={1.334} step={0.05} onChange={setLocalAlphaMax} />
                    </div>
                  </>
                )}
                <Button
                  variant="outline"
                  className="w-full text-[10px] font-mono uppercase tracking-widest h-8 border-neutral-700"
                  onClick={handleRetrace}
                >
                  <RefreshCw size={12} className="mr-1.5" /> Re-trace
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Options + Actions */}
      {items.length > 0 && (
        <div className="space-y-4">
          {/* Options */}
          <div className="flex flex-wrap items-center gap-3">
            <Settings2 size={12} className="text-neutral-500" />
            {(Object.keys(OPTION_LABELS) as (keyof typeof OPTION_LABELS)[]).map((key) => (
              <label
                key={key}
                className="flex items-center gap-1.5 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={options[key as keyof typeof options]}
                  onChange={(e) => setOption(key as keyof typeof options, e.target.checked)}
                  className="w-3 h-3 rounded border-neutral-700 bg-neutral-900 text-brand-cyan accent-brand-cyan"
                />
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                  {OPTION_LABELS[key]}
                </span>
              </label>
            ))}
          </div>

          {/* Summary + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono text-neutral-500">
              {doneItems.length} file{doneItems.length !== 1 ? 's' : ''} ready
              {items.length > doneItems.length && ` · ${items.length - doneItems.length} processing`}
              {doneItems.length > 0 && ` · saved ${formatBytes(totalOriginal - totalOptimized)} (${totalSavings}%)`}
            </span>
            <div className="flex gap-2 ml-auto">
              <Button
                onClick={handleDownloadAll}
                disabled={doneItems.length === 0}
                className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
              >
                <Download size={14} />
                <span className="ml-2">{doneItems.length > 1 ? `Download ZIP (${doneItems.length})` : 'Download'}</span>
              </Button>
              <Button
                onClick={handleCopy}
                disabled={!selectedItem || selectedItem.status !== 'done'}
                variant="outline"
                className="font-mono text-xs uppercase tracking-widest border-neutral-700"
                title="Copy selected SVG"
              >
                <Copy size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </MiniToolShell>
  );
};

import React, { useCallback, useRef, useState } from 'react';
import { FileCode, Upload, Download, Copy, Eye, Code, X, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSvgOptimizerStore } from '@/stores/svgOptimizerStore';
import { sanitizeSvgForRender } from '@/utils/svgOptimizer';
import { downloadBlob, copyToClipboard } from '@/utils/clipboard';
import { MiniToolShell } from '@/components/shared/MiniToolShell';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/formatUtils';
import JSZip from 'jszip';

const OPTION_LABELS: Record<string, string> = {
  removeComments: 'Comments',
  removeMetadata: 'Metadata',
  removeEditorData: 'Editor data',
  removeEmptyGroups: 'Empty groups',
  minifyPaths: 'Minify numbers',
  removeHiddenElements: 'Hidden elements',
  prettify: 'Prettify',
};

export const SvgOptimizerPage: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteValue, setPasteValue] = useState('');

  const items = useSvgOptimizerStore((s) => s.items);
  const options = useSvgOptimizerStore((s) => s.options);
  const showCode = useSvgOptimizerStore((s) => s.showCode);
  const selectedId = useSvgOptimizerStore((s) => s.selectedId);
  const addFiles = useSvgOptimizerStore((s) => s.addFiles);
  const removeItem = useSvgOptimizerStore((s) => s.removeItem);
  const setOption = useSvgOptimizerStore((s) => s.setOption);
  const setShowCode = useSvgOptimizerStore((s) => s.setShowCode);
  const setSelectedId = useSvgOptimizerStore((s) => s.setSelectedId);
  const reset = useSvgOptimizerStore((s) => s.reset);

  const selectedItem = items.find((i) => i.id === selectedId) || items[0];

  const totalOriginal = items.reduce((sum, i) => sum + i.originalSize, 0);
  const totalOptimized = items.reduce((sum, i) => sum + i.optimizedSize, 0);
  const totalSavings = totalOriginal > 0 ? Math.round((1 - totalOptimized / totalOriginal) * 100) : 0;

  const readSvgFiles = useCallback((fileList: FileList) => {
    const pending: Promise<{ name: string; content: string } | null>[] = [];
    Array.from(fileList).forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
        toast.error(`${file.name}: not an SVG file`);
        return;
      }
      pending.push(
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, content: reader.result as string });
          reader.onerror = () => { toast.error(`${file.name}: read failed`); resolve(null); };
          reader.readAsText(file);
        }),
      );
    });
    Promise.all(pending).then((results) => {
      const valid = results.filter(Boolean) as { name: string; content: string }[];
      if (valid.length) addFiles(valid);
    });
  }, [addFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) readSvgFiles(e.target.files);
    if (e.target) e.target.value = '';
  }, [readSvgFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) readSvgFiles(e.dataTransfer.files);
  }, [readSvgFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteValue.trim();
    if (!trimmed || !trimmed.includes('<svg')) {
      toast.error('No valid SVG found in pasted content');
      return;
    }
    addFiles([{ name: `pasted-${Date.now()}.svg`, content: trimmed }]);
    setPasteValue('');
    setPasteMode(false);
  }, [pasteValue, addFiles]);

  const handleDownloadAll = useCallback(async () => {
    if (!items.length) return;

    if (items.length === 1) {
      const item = items[0];
      const blob = new Blob([item.optimizedSvg], { type: 'image/svg+xml' });
      downloadBlob(blob, item.fileName.replace(/\.svg$/i, '') + '-optimized.svg');
      toast.success('Downloaded');
      return;
    }

    const zip = new JSZip();
    for (const item of items) {
      const name = item.fileName.replace(/\.svg$/i, '') + '-optimized.svg';
      zip.file(name, item.optimizedSvg);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `svg-optimized-${Date.now()}.zip`);
    toast.success('ZIP downloaded');
  }, [items]);

  const handleCopy = useCallback(async () => {
    if (!selectedItem) return;
    const ok = await copyToClipboard(selectedItem.optimizedSvg);
    if (ok) toast.success('SVG copied');
    else toast.error('Copy failed');
  }, [selectedItem]);

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
              <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                Drop SVG files or click — batch supported
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".svg,image/svg+xml"
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
                  onClick={() => setShowCode(false)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all',
                    !showCode ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-500 hover:text-neutral-300',
                  )}
                >
                  <Eye size={10} /> Preview
                </button>
                <button
                  onClick={() => setShowCode(true)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-all',
                    showCode ? 'bg-brand-cyan/20 text-brand-cyan' : 'text-neutral-500 hover:text-neutral-300',
                  )}
                >
                  <Code size={10} /> Code
                </button>
              </div>

              {selectedItem && !showCode && (
                <div
                  className="flex-1 flex items-center justify-center p-4 overflow-hidden pointer-events-none"
                  style={{ maxHeight: '60vh' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeSvgForRender(selectedItem.optimizedSvg) }}
                />
              )}

              {selectedItem && showCode && (
                <pre className="flex-1 p-4 text-xs font-mono text-neutral-400 overflow-auto whitespace-pre-wrap break-all" style={{ maxHeight: '60vh' }}>
                  {selectedItem.optimizedSvg}
                </pre>
              )}

              {selectedItem && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-brand-cyan/20 text-brand-cyan px-2 py-0.5 rounded">
                    {selectedItem.savings > 0 ? `-${selectedItem.savings}%` : '0%'}
                  </span>
                </div>
              )}
            </div>

            {/* Queue panel */}
            <div className="space-y-3">
              {/* Add more */}
              <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-wider cursor-pointer transition-all">
                <Upload size={12} />
                Add SVGs
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  multiple
                  className="hidden"
                  onChange={handleInputChange}
                />
              </label>

              {/* Item list */}
              <div className="max-h-[40vh] overflow-y-auto space-y-1.5 pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-all group',
                      selectedItem?.id === item.id ? 'bg-neutral-800/60 ring-1 ring-brand-cyan/30' : 'hover:bg-neutral-900/60',
                    )}
                  >
                    <FileCode size={16} className="text-neutral-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-mono text-neutral-300 truncate">{item.fileName}</p>
                      <span className="text-[9px] font-mono text-neutral-500">
                        {formatBytes(item.originalSize)} &rarr; {formatBytes(item.optimizedSize)}
                      </span>
                    </div>
                    <span className={cn(
                      'text-[9px] font-mono flex-shrink-0',
                      item.savings > 0 ? 'text-emerald-500' : 'text-neutral-600',
                    )}>
                      {item.savings > 0 ? `-${item.savings}%` : '0%'}
                    </span>
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
                {items.length} file{items.length > 1 ? 's' : ''} &middot; saved {formatBytes(totalOriginal - totalOptimized)} ({totalSavings}%)
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  onClick={handleDownloadAll}
                  className="bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/30 font-mono text-xs uppercase tracking-widest"
                >
                  <Download size={14} />
                  <span className="ml-2">{items.length > 1 ? `Download ZIP (${items.length})` : 'Download'}</span>
                </Button>
                <Button
                  onClick={handleCopy}
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

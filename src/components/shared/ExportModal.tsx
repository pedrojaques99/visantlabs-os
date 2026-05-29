import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Download, X, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { downloadBlob } from '@/utils/clipboard';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg' | 'mp4' | 'gif' | 'webm';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  filenamePrefix: string;
  getShaderSettings?: () => ShaderSettings | undefined;
  onExportSvg?: () => string | Promise<string | undefined> | undefined;
  onExportScaled?: (scale: number) => HTMLCanvasElement | undefined;
  isVideo?: boolean;
  videoDuration?: number;
  onExportVideo?: (format: 'mp4' | 'gif' | 'webm', onProgress: (pct: number) => void) => Promise<Blob>;
}

const RASTER_FORMATS: { id: ExportFormat; label: string; ext: string; mime: string }[] = [
  { id: 'png', label: 'PNG', ext: 'png', mime: 'image/png' },
  { id: 'jpeg', label: 'JPEG', ext: 'jpg', mime: 'image/jpeg' },
  { id: 'webp', label: 'WebP', ext: 'webp', mime: 'image/webp' },
];

const SVG_FORMAT = { id: 'svg' as ExportFormat, label: 'SVG', ext: 'svg', mime: 'image/svg+xml' };

const SCALE_OPTIONS = [
  { id: 1, label: '1×' },
  { id: 1.5, label: '1.5×' },
  { id: 2, label: '2×' },
  { id: 3, label: '3×' },
];

const VIDEO_FORMATS: { id: ExportFormat; label: string; ext: string; mime: string }[] = [
  { id: 'mp4', label: 'MP4', ext: 'mp4', mime: 'video/mp4' },
  { id: 'gif', label: 'GIF', ext: 'gif', mime: 'image/gif' },
  { id: 'webm', label: 'WebM', ext: 'webm', mime: 'video/webm' },
];

const IS_VIDEO_FORMAT = (f: ExportFormat) => f === 'mp4' || f === 'gif' || f === 'webm';
const IS_LOSSY_IMAGE = (f: ExportFormat) => f === 'jpeg' || f === 'webp';

function estimateFileSize(w: number, h: number, format: ExportFormat, quality: number): string {
  const pixels = w * h;
  let bytes: number;
  switch (format) {
    case 'png': bytes = pixels * 1.5; break;
    case 'jpeg': bytes = pixels * quality * 0.8; break;
    case 'webp': bytes = pixels * quality * 0.5; break;
    case 'svg': bytes = pixels * 0.3; break;
    default: return '';
  }
  if (bytes > 1024 * 1024) return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `~${Math.round(bytes / 1024)} KB`;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  filenamePrefix,
  getShaderSettings,
  onExportSvg,
  onExportScaled,
  isVideo,
  videoDuration,
  onExportVideo,
}) => {
  const baseFormats = onExportSvg
    ? [...RASTER_FORMATS, SVG_FORMAT]
    : RASTER_FORMATS;
  const FORMAT_OPTIONS = isVideo && onExportVideo
    ? [...baseFormats, ...VIDEO_FORMATS]
    : baseFormats;
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Generate preview thumbnail
  useEffect(() => {
    if (!isOpen) return;
    const source = canvasRef.current;
    if (!source) return;

    const maxPreviewSize = 200;
    const ratio = Math.min(maxPreviewSize / source.width, maxPreviewSize / source.height, 1);
    const pw = Math.round(source.width * ratio);
    const ph = Math.round(source.height * ratio);
    const preview = document.createElement('canvas');
    preview.width = pw;
    preview.height = ph;
    const ctx = preview.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(source, 0, 0, pw, ph);
    setPreviewUrl(preview.toDataURL('image/png'));

    return () => setPreviewUrl(null);
  }, [isOpen, canvasRef]);

  // Entrance animation
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Keyboard shortcuts: ESC to close, Enter to export
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Enter' && !e.shiftKey && !isExporting) { e.preventDefault(); handleExport(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, isExporting]);

  const handleCopyToClipboard = useCallback(async () => {
    const source = canvasRef.current;
    if (!source || IS_VIDEO_FORMAT(format) || format === 'svg') return;

    try {
      let exportCanvas: HTMLCanvasElement = source;

      const shader = getShaderSettings?.();
      if (shader) exportCanvas = await applyShaderToCanvas(exportCanvas, shader);

      if (scale !== 1) {
        const hiRes = onExportScaled?.(scale);
        if (hiRes) {
          exportCanvas = hiRes;
        } else {
          const scaled = document.createElement('canvas');
          scaled.width = exportCanvas.width * scale;
          scaled.height = exportCanvas.height * scale;
          const ctx = scaled.getContext('2d')!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(exportCanvas, 0, 0, scaled.width, scaled.height);
          exportCanvas = scaled;
        }
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed')), 'image/png');
      });

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy — try downloading instead');
    }
  }, [canvasRef, format, scale, getShaderSettings, onExportScaled]);

  const handleExport = useCallback(async () => {
    const source = canvasRef.current;
    if (!source) return;
    setIsExporting(true);
    setExportProgress(0);

    try {
      if (IS_VIDEO_FORMAT(format)) {
        if (!onExportVideo) throw new Error('Video export not available');
        const blob = await onExportVideo(format as 'mp4' | 'gif' | 'webm', setExportProgress);
        downloadBlob(blob, `${filenamePrefix}_${Date.now()}.${format}`);
        toast.success(`Exported ${format.toUpperCase()}`);
        onClose();
        return;
      }

      if (format === 'svg') {
        const svgStr = await onExportSvg?.();
        if (!svgStr) throw new Error('SVG export not available');
        const blob = new Blob([svgStr], { type: 'image/svg+xml' });
        downloadBlob(blob, `${filenamePrefix}_vector_${Date.now()}.svg`);
        toast.success('Exported SVG (vector)');
        onClose();
        return;
      }

      let exportCanvas: HTMLCanvasElement = source;

      const shader = getShaderSettings?.();
      if (shader) {
        exportCanvas = await applyShaderToCanvas(exportCanvas, shader);
      }

      if (scale !== 1) {
        const hiRes = onExportScaled?.(scale);
        if (hiRes) {
          exportCanvas = hiRes;
        } else {
          const scaled = document.createElement('canvas');
          scaled.width = exportCanvas.width * scale;
          scaled.height = exportCanvas.height * scale;
          const ctx = scaled.getContext('2d')!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(exportCanvas, 0, 0, scaled.width, scaled.height);
          exportCanvas = scaled;
        }
      }

      const fmt = FORMAT_OPTIONS.find((f) => f.id === format)!;
      const qualityArg = format === 'png' ? undefined : quality;

      const blob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
          fmt.mime,
          qualityArg
        );
      });

      const dims = `${exportCanvas.width}x${exportCanvas.height}`;
      downloadBlob(blob, `${filenamePrefix}_${dims}_${Date.now()}.${fmt.ext}`);
      toast.success(`Exported ${fmt.label} (${dims})`);
      onClose();
    } catch {
      toast.error('Export failed — try again');
    } finally {
      setIsExporting(false);
    }
  }, [canvasRef, format, quality, scale, filenamePrefix, getShaderSettings, onExportSvg, onExportScaled, onClose, FORMAT_OPTIONS, onExportVideo]);

  if (!isOpen) return null;

  const source = canvasRef.current;
  const sourceW = source?.width || 0;
  const sourceH = source?.height || 0;
  const outputW = Math.round(sourceW * scale);
  const outputH = Math.round(sourceH * scale);
  const isVideoFormat = IS_VIDEO_FORMAT(format);
  const sizeEstimate = !isVideoFormat ? estimateFileSize(outputW, outputH, format, quality) : null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-all duration-200",
        isVisible ? "backdrop-blur-sm opacity-100" : "backdrop-blur-none opacity-0"
      )}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className={cn(
          "w-[400px] bg-neutral-950 border border-neutral-800/50 rounded-xl shadow-2xl transition-all duration-200",
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-300">Export Settings</span>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors p-1" title="Close (Esc)">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Preview */}
          {previewUrl && (
            <div className="flex justify-center">
              <div className="relative rounded-lg overflow-hidden border border-neutral-800/50 bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#111_0%_50%)] bg-[length:12px_12px]">
                <img
                  src={previewUrl}
                  alt="Export preview"
                  className="block max-h-[140px] max-w-full object-contain"
                  draggable={false}
                />
              </div>
            </div>
          )}

          {/* Format */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Format</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'flex-1 min-w-[52px] py-2 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 border',
                    format === f.id
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-neutral-900/50 text-neutral-400 border-neutral-800/50 hover:bg-neutral-800/30'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality (lossy image only) */}
          {IS_LOSSY_IMAGE(format) && (
            <div className="space-y-2">
              <NodeSlider
                label="Quality"
                value={quality}
                min={0.1}
                max={1}
                step={0.01}
                onChange={setQuality}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          )}

          {/* Scale (raster image only) */}
          {!isVideoFormat && format !== 'svg' && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Scale</span>
              <div className="flex gap-1.5">
                {SCALE_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScale(s.id)}
                    className={cn(
                      'flex-1 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 border',
                      scale === s.id
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-neutral-900/50 text-neutral-400 border-neutral-800/50 hover:bg-neutral-800/30'
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Output info */}
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 bg-neutral-900/40 rounded-md px-3 py-2">
            <span>Output</span>
            <div className="flex items-center gap-3">
              {isVideoFormat && videoDuration ? (
                <span>{videoDuration.toFixed(1)}s</span>
              ) : null}
              <span>
                {format === 'svg'
                  ? `${sourceW} × ${sourceH} vector`
                  : isVideoFormat
                    ? `${sourceW} × ${sourceH}px`
                    : `${outputW} × ${outputH}px`}
              </span>
              {sizeEstimate && <span className="text-neutral-600">{sizeEstimate}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          {/* Copy to clipboard (image only) */}
          {!isVideoFormat && format !== 'svg' && (
            <Button
              onClick={handleCopyToClipboard}
              disabled={isExporting || !source}
              variant="outline"
              className="h-10 px-3 border-neutral-800 bg-transparent hover:bg-neutral-800/50 text-neutral-400 hover:text-neutral-200"
              title="Copy to clipboard"
            >
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </Button>
          )}

          {/* Export / Download */}
          <Button
            onClick={handleExport}
            disabled={isExporting || !source}
            className="flex-1 bg-white hover:bg-neutral-200 text-black font-medium h-10 text-xs gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {exportProgress > 0 ? `${Math.round(exportProgress)}%` : 'Exporting...'}
              </>
            ) : (
              <>
                <Download size={14} />
                Export {FORMAT_OPTIONS.find((f) => f.id === format)?.label}
                <kbd className="ml-1 text-[9px] opacity-40">⏎</kbd>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

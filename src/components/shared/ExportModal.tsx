import React, { useState, useCallback } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NodeSlider } from '@/components/ui/NodeSlider';
import { downloadBlob } from '@/utils/clipboard';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  filenamePrefix: string;
  getShaderSettings?: () => ShaderSettings | undefined;
  onExportSvg?: () => string | Promise<string | undefined> | undefined;
  onExportScaled?: (scale: number) => HTMLCanvasElement | undefined;
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

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  filenamePrefix,
  getShaderSettings,
  onExportSvg,
  onExportScaled,
}) => {
  const FORMAT_OPTIONS = onExportSvg
    ? [...RASTER_FORMATS, SVG_FORMAT]
    : RASTER_FORMATS;
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    const source = canvasRef.current;
    if (!source) return;
    setIsExporting(true);

    try {
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
  }, [canvasRef, format, quality, scale, filenamePrefix, getShaderSettings, onExportSvg, onExportScaled, onClose, FORMAT_OPTIONS]);

  if (!isOpen) return null;

  const source = canvasRef.current;
  const sourceW = source?.width || 0;
  const sourceH = source?.height || 0;
  const outputW = Math.round(sourceW * scale);
  const outputH = Math.round(sourceH * scale);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[380px] bg-neutral-950 border border-neutral-800/50 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800/50">
          <span className="text-[11px] font-mono uppercase tracking-widest text-neutral-300">Export Settings</span>
          <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors p-1">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Format */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Format</span>
            <div className="flex gap-1.5">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    'flex-1 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all duration-200 border',
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

          {/* Quality (lossy only) */}
          {format !== 'png' && format !== 'svg' && (
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

          {/* Scale (raster only) */}
          {format !== 'svg' && <div className="space-y-2">
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
          </div>}

          {/* Output info */}
          <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 bg-neutral-900/40 rounded-md px-3 py-2">
            <span>Output</span>
            <span>{format === 'svg' ? `${sourceW} × ${sourceH} vector` : `${outputW} × ${outputH}px`}</span>
          </div>
        </div>

        <div className="px-5 pb-5">
          <Button
            onClick={handleExport}
            disabled={isExporting || !source}
            className="w-full bg-white hover:bg-neutral-200 text-black font-medium h-10 text-xs gap-2"
          >
            {isExporting ? (
              <><Loader2 size={14} className="animate-spin" /> Exporting...</>
            ) : (
              <><Download size={14} /> Export {FORMAT_OPTIONS.find((f) => f.id === format)?.label}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

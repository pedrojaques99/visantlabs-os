import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, MoreHorizontal, Minus, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { exportImageWithScale } from '../../utils/exportUtils';
import { toast } from 'sonner';

interface ExportPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeName: string;
  imageUrl: string | null;
  nodeType: string;
  embedded?: boolean;
}

const SCALE_OPTIONS = [0.5, 1, 1.5, 2];
const FORMAT_OPTIONS = ['PNG', 'JPG', 'SVG'] as const;
type ExportFormat = typeof FORMAT_OPTIONS[number];

export const ExportPanel: React.FC<ExportPanelProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeName,
  imageUrl,
  embedded = false,
}) => {
  const [selectedScale, setSelectedScale] = useState<number>(1.5);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('PNG');
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);

  // Reset to defaults when panel opens
  useEffect(() => {
    if (isOpen) {
      setSelectedScale(1.5);
      setSelectedFormat('PNG');
      setIsPreviewExpanded(true);
    }
  }, [isOpen]);

  // Handle ESC key to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleExport = async () => {
    if (!imageUrl || isExporting) return;

    setIsExporting(true);
    try {
      await exportImageWithScale(
        imageUrl,
        selectedFormat.toLowerCase() as 'png' | 'jpg' | 'svg',
        selectedScale,
        nodeName || `node-${nodeId}`
      );
      toast.success('Image exported successfully!', { duration: 2000 });
      onClose();
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export image', { duration: 3000 });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={cn(
      "w-full h-full bg-transparent border-none shadow-none flex flex-col"
    )}>
      {/* Header */}
      {/* Header - Only hide in embedded mode if we want to rely on parent header, but keeping it for now serves as title */}
      {!embedded && <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/30">
        <h2 className="text-sm font-semibold text-zinc-200 font-mono">Export</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { }}
            className="p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            title="Add preset"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => { }}
            className="p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            title="More options"
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            onClick={() => { }}
            className="p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            title="Remove preset"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      }

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Scale Selector */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-zinc-400 font-mono mb-1 block">Scale</label>
            <select
              value={selectedScale}
              onChange={(e) => setSelectedScale(Number(e.target.value))}
              className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700/30 rounded text-xs text-zinc-300 font-mono focus:outline-none focus:border-[brand-cyan]/50"
            >
              {SCALE_OPTIONS.map((scale) => (
                <option key={scale} value={scale}>
                  {scale}x
                </option>
              ))}
            </select>
          </div>

          {/* Format Selector */}
          <div className="flex-1">
            <label className="text-xs text-zinc-400 font-mono mb-1 block">Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
              className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700/30 rounded text-xs text-zinc-300 font-mono focus:outline-none focus:border-[brand-cyan]/50"
            >
              {FORMAT_OPTIONS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExport}
          disabled={!imageUrl || isExporting}
          className={cn(
            'w-full px-4 py-2.5 bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/30 rounded text-xs font-mono text-brand-cyan transition-colors flex items-center justify-center gap-2',
            (!imageUrl || isExporting) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isExporting ? (
            <>
              <div className="w-3 h-3 border-2 border-[brand-cyan] border-t-transparent rounded-md animate-spin" />
              Exporting...
            </>
          ) : (
            `Export ${nodeName || 'Mockup'}`
          )}
        </button>

        {/* Preview Section */}
        <div className="border-t border-zinc-700/30 pt-4">
          <button
            onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
            className="w-full flex items-center justify-between text-xs font-mono text-zinc-400 hover:text-zinc-300 mb-2"
          >
            <span>Preview</span>
            {isPreviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isPreviewExpanded && imageUrl && (
            <div className="relative w-full bg-zinc-900/30 rounded border border-zinc-700/30 overflow-hidden">
              <div className="aspect-square p-4 flex items-center justify-center">
                <img
                  ref={previewRef}
                  src={imageUrl}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded"
                  style={{
                    transform: `scale(${selectedScale})`,
                    transformOrigin: 'center',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer - Help Button */}
      <div className="px-4 py-3 border-t border-zinc-700/30 flex justify-end">
        <button
          onClick={() => { }}
          className="w-8 h-8 rounded-md bg-zinc-900/50 hover:bg-zinc-900/70 border border-zinc-700/30 flex items-center justify-center text-zinc-400 hover:text-zinc-300 transition-colors"
          title="Help"
        >
          <HelpCircle size={16} />
        </button>
      </div>
    </div >
  );
};


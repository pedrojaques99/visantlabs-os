import React from 'react';
import { Download, Copy } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { type AssetSource } from '@/services/pipelineApi';
import { SendToButton } from '@/components/shared/SendToButton';
import { formatBytes } from '@/utils/formatUtils';

interface QuickActionsProps {
  toolId: AssetSource;
  outputMime: string;
  /** Summary line, e.g. "5 images compressed" */
  summary: string;
  /** Total bytes saved (optional — shows savings badge) */
  savedBytes?: number;
  savedPercent?: number;
  /** Called when user clicks Download All */
  onDownloadAll: () => void;
  /** Called when user clicks Copy (optional) */
  onCopy?: () => void;
  /** The asset data to send via pipeline */
  assetData?: { imageBase64?: string; imageUrl?: string; mimeType?: string; label?: string };
  className?: string;
}

const ease = [0.4, 0, 0.2, 1] as const;

export const QuickActions: React.FC<QuickActionsProps> = ({
  toolId,
  outputMime,
  summary,
  savedBytes,
  savedPercent,
  onDownloadAll,
  onCopy,
  assetData,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      className={cn(
        'flex flex-col gap-2.5 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/60',
        className
      )}
    >
      {/* Summary line */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-neutral-300">{summary}</span>
        {savedBytes != null && savedBytes > 0 && (
          <span className="text-[10px] font-mono text-success bg-success/10 px-1.5 py-0.5 rounded tabular-nums">
            saved {formatBytes(savedBytes)}
            {savedPercent != null && ` (${savedPercent}%)`}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Download */}
        <button
          onClick={onDownloadAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/20 text-[11px] font-mono uppercase tracking-wider transition-all duration-200"
        >
          <Download size={12} />
          Download
        </button>

        {/* Copy */}
        {onCopy && (
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-800/60 hover:bg-neutral-700/60 text-neutral-400 hover:text-neutral-200 border border-neutral-700/30 text-[11px] font-mono uppercase tracking-wider transition-all duration-200"
          >
            <Copy size={12} />
            Copy
          </button>
        )}

        {/* Send to — collapsed into a single button with dropdown */}
        {assetData && (
          <SendToButton
            source={toolId}
            outputMime={outputMime}
            imageBase64={assetData.imageBase64}
            imageUrl={assetData.imageUrl}
            mimeType={assetData.mimeType}
            label={assetData.label}
            variant="icon"
          />
        )}
      </div>
    </motion.div>
  );
};

import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, X, ImageIcon } from 'lucide-react';
import { usePipelinePending } from '@/hooks/usePipeline';
import type { PipelineAsset } from '@/services/pipelineApi';
import { cn } from '@/lib/utils';

interface PipelineInboxProps {
  /** Called when user clicks "Use" on an asset — the canvas page receives it and creates an image node */
  onUseAsset: (asset: PipelineAsset) => void;
}

export const PipelineInbox: React.FC<PipelineInboxProps> = ({ onUseAsset }) => {
  const [open, setOpen] = useState(false);
  const { assets, isLoading, refresh, consume } = usePipelinePending();

  // Poll every 30s while open, refresh once on mount
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [open, refresh]);

  const handleUse = useCallback(async (asset: PipelineAsset) => {
    onUseAsset(asset);
    await consume(asset.id);
    if (assets.length <= 1) setOpen(false);
  }, [assets.length, consume, onUseAsset]);

  const handleDiscard = useCallback(async (asset: PipelineAsset) => {
    await consume(asset.id);
  }, [consume]);

  const count = assets.length;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) refresh(); }}
        title="Pipeline Inbox"
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-lg border transition-colors',
          count > 0
            ? 'bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan hover:bg-brand-cyan/30'
            : 'bg-neutral-900/50 border-neutral-700/30 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
        )}
      >
        <Inbox size={14} strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-brand-cyan text-neutral-950 text-[9px] font-bold">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-10 top-0 z-50 bg-neutral-950 border border-neutral-700/50 rounded-xl shadow-2xl w-72">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
            <span className="text-xs font-mono text-neutral-300">Pipeline Inbox</span>
            <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-300">
              <X size={12} />
            </button>
          </div>

          {isLoading && <div className="px-3 py-4 text-xs text-neutral-500 text-center">Loading…</div>}

          {!isLoading && count === 0 && (
            <div className="px-3 py-6 text-xs text-neutral-500 text-center">
              No pending assets.<br />Use "Send to →" in any tool to send assets here.
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 px-3 py-2">
                <div className="w-10 h-10 rounded-md bg-neutral-800 flex-shrink-0 overflow-hidden">
                  {(asset.imageUrl || asset.imageBase64) ? (
                    <img
                      src={asset.imageUrl || asset.imageBase64}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={16} className="m-auto mt-2 text-neutral-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-300 truncate">{asset.label || 'Asset'}</p>
                  <p className="text-[10px] text-neutral-500">from {asset.source}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleUse(asset)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 border border-brand-cyan/30"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => handleDiscard(asset)}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-500 hover:text-neutral-300"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

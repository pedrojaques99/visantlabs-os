import React, { useState, useEffect, useCallback } from 'react';
import { Inbox, X, ImageIcon } from '@/lib/ui/icons';
import { usePipelinePending } from '@/hooks/usePipeline';
import type { PipelineAsset } from '@/services/pipelineApi';
import { cn } from '@/lib/utils';
import { Thumb } from '@/components/ui/Thumb';
import { useTranslation } from '@/hooks/useTranslation';

interface PipelineInboxProps {
  /** Called when user picks an asset — the canvas page receives it and creates an image node */
  onUseAsset: (asset: PipelineAsset) => void;
}

export const PipelineInbox: React.FC<PipelineInboxProps> = ({ onUseAsset }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { assets, isLoading, refresh, consume } = usePipelinePending();

  // Poll every 30s while open, refresh once on mount
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [open, refresh]);

  const handleUse = useCallback(
    async (asset: PipelineAsset) => {
      onUseAsset(asset);
      await consume(asset.id);
      if (assets.length <= 1) setOpen(false);
    },
    [assets.length, consume, onUseAsset]
  );

  const handleDiscard = useCallback(
    async (asset: PipelineAsset) => {
      await consume(asset.id);
    },
    [consume]
  );

  const count = assets.length;

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) refresh();
        }}
        title={t('pipeline.inbox.title')}
        aria-label={t('pipeline.inbox.title')}
        aria-expanded={open}
        className={cn(
          'relative flex items-center justify-center w-8 h-8 rounded-xl border transition-colors',
          count > 0
            ? 'bg-neutral-800/50 border-neutral-600 text-neutral-300 hover:bg-neutral-700/50'
            : 'bg-neutral-900/50 border-neutral-700/30 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
        )}
      >
        <Inbox size={14} strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-neutral-600 text-neutral-100 text-3xs font-semibold">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-10 top-0 z-50 bg-neutral-950 border border-neutral-700/50 rounded-xl shadow-2xl w-72">
          <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
            <span className="text-xs text-neutral-300">{t('pipeline.inbox.title')}</span>
            <button
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
              className="text-neutral-500 hover:text-neutral-300"
            >
              <X size={12} />
            </button>
          </div>

          {isLoading && (
            <div className="px-3 py-4 text-xs text-neutral-500 text-center">
              {t('common.loading')}
            </div>
          )}

          {!isLoading && count === 0 && (
            <div className="px-3 py-6 text-xs text-neutral-500 text-center">
              {t('pipeline.inbox.empty')}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800">
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-1 pr-2 hover:bg-neutral-900">
                {/* A linha inteira é a ação: clicar coloca o asset no canvas. */}
                <button
                  onClick={() => handleUse(asset)}
                  title={t('pipeline.inbox.addToCanvas')}
                  className="flex flex-1 min-w-0 items-center gap-2 px-3 py-2 text-left"
                >
                  <Thumb
                    src={asset.imageUrl || asset.imageBase64}
                    alt=""
                    fallbackIcon={ImageIcon}
                    className="w-10 h-10 rounded-md bg-neutral-800 flex-shrink-0 object-cover"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-neutral-300 truncate">
                      {asset.label || t('pipeline.inbox.untitled')}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      {t('pipeline.inbox.from', { source: asset.source })}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => handleDiscard(asset)}
                  aria-label={t('common.dismiss')}
                  title={t('common.dismiss')}
                  className="p-1 rounded text-neutral-500 hover:text-neutral-300"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

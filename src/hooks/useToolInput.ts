import { useEffect, useState, useCallback } from 'react';
import { pipelineApi, type PipelineAsset } from '@/services/pipelineApi';
import { toast } from 'sonner';
import { getToolById } from '@/lib/toolRegistry';

interface UseToolInputReturn {
  pendingAsset: PipelineAsset | null;
  acceptAsset: () => PipelineAsset | null;
  dismissAsset: () => void;
}

/**
 * Checks for pending pipeline assets when a tool page mounts.
 * Shows a toast if an asset from another tool is available.
 */
export function useToolInput(toolId: string): UseToolInputReturn {
  const [pendingAsset, setPendingAsset] = useState<PipelineAsset | null>(null);

  useEffect(() => {
    let cancelled = false;

    pipelineApi.pending().then((assets) => {
      if (cancelled || assets.length === 0) return;
      const asset = assets[0];
      setPendingAsset(asset);

      const sourceTool = getToolById(asset.source);
      const sourceName = sourceTool?.name ?? asset.source;

      toast.info(`Asset from ${sourceName} available`, {
        description: asset.label || 'Ready to use',
        duration: 6000,
        action: {
          label: 'Use it',
          onClick: () => {},
        },
      });
    });

    return () => { cancelled = true; };
  }, [toolId]);

  const acceptAsset = useCallback(() => {
    if (!pendingAsset) return null;
    const asset = pendingAsset;
    setPendingAsset(null);
    pipelineApi.remove(asset.id).catch(() => {});
    return asset;
  }, [pendingAsset]);

  const dismissAsset = useCallback(() => {
    if (!pendingAsset) return;
    pipelineApi.remove(pendingAsset.id).catch(() => {});
    setPendingAsset(null);
  }, [pendingAsset]);

  return { pendingAsset, acceptAsset, dismissAsset };
}

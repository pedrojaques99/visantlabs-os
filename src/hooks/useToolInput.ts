import { useEffect, useState, useCallback, useRef } from 'react';
import { pipelineApi, type PipelineAsset } from '@/services/pipelineApi';
import { toast } from 'sonner';
import { getToolById } from '@/lib/toolRegistry';

interface UseToolInputReturn {
  pendingAsset: PipelineAsset | null;
  /** Accept the asset — removes from pipeline and returns it for the page to consume */
  acceptAsset: () => PipelineAsset | null;
  dismissAsset: () => void;
}

/**
 * Checks for pending pipeline assets when a tool page mounts.
 * Shows a toast notification with accept/dismiss actions.
 *
 * Usage in a tool page:
 * ```ts
 * const { pendingAsset, acceptAsset } = useToolInput('compress');
 *
 * useEffect(() => {
 *   if (!pendingAsset) return;
 *   const asset = acceptAsset();
 *   if (asset) {
 *     // inject into your store, e.g.:
 *     addFiles([{ url: asset.imageUrl || asset.imageBase64!, name: asset.label || 'pipeline-asset', size: 0 }]);
 *   }
 * }, [pendingAsset]);
 * ```
 */
export function useToolInput(toolId: string): UseToolInputReturn {
  const [pendingAsset, setPendingAsset] = useState<PipelineAsset | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    pipelineApi.pending().then((assets) => {
      if (assets.length === 0) return;
      const asset = assets[0];
      setPendingAsset(asset);

      const sourceTool = getToolById(asset.source);
      const sourceName = sourceTool?.name ?? asset.source;

      toast.info(`Asset from ${sourceName}`, {
        description: asset.label || 'Ready to use in this tool',
        duration: 8000,
      });
    });
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

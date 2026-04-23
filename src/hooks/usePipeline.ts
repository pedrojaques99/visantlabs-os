import { useState, useCallback } from 'react';
import { pipelineApi, type PipelineAsset, type SendAssetParams } from '@/services/pipelineApi';
import { toast } from 'sonner';

export function usePipeline() {
  const [isSending, setIsSending] = useState(false);

  const sendAsset = useCallback(async (params: SendAssetParams): Promise<PipelineAsset | null> => {
    setIsSending(true);
    try {
      const asset = await pipelineApi.send(params);
      toast.success('Asset sent to pipeline');
      return asset;
    } catch {
      toast.error('Failed to send asset');
      return null;
    } finally {
      setIsSending(false);
    }
  }, []);

  return { sendAsset, isSending };
}

export function usePipelinePending() {
  const [assets, setAssets] = useState<PipelineAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await pipelineApi.pending();
      setAssets(list);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const consume = useCallback(async (id: string) => {
    await pipelineApi.remove(id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { assets, isLoading, refresh, consume };
}

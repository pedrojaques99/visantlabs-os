import { useCallback } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../../hooks/useTranslation';

export const useNodeDownload = (imageUrl: string | null | undefined, filenamePrefix: string = 'image') => {
  const { t } = useTranslation();
  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;

    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${filenamePrefix}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('canvasNodes.shared.imageDownloaded'), { duration: 2000 });
  }, [imageUrl, filenamePrefix, t]);

  return handleDownload;
};

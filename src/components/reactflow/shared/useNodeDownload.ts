import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { downloadImage } from '@/utils/imageUtils';

export const useNodeDownload = (imageUrl: string | null | undefined, filenamePrefix: string = 'image') => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;

    setIsDownloading(true);
    try {
      await downloadImage(imageUrl, filenamePrefix);
      toast.success(t('canvasNodes.shared.imageDownloaded'), { duration: 2000 });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(t('canvasNodes.shared.downloadFailed'), { duration: 2000 });
    } finally {
      setIsDownloading(false);
    }
  }, [imageUrl, filenamePrefix, t]);

  return { handleDownload, isDownloading };
};

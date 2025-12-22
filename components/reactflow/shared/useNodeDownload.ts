import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../../hooks/useTranslation';

export const useNodeDownload = (imageUrl: string | null | undefined, filenamePrefix: string = 'image') => {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!imageUrl) return;

    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Determine extension from content-type or url
      let extension = '.png';
      const contentType = response.headers.get('content-type');
      if (contentType) {
        if (contentType.includes('video/mp4')) extension = '.mp4';
        else if (contentType.includes('image/jpeg')) extension = '.jpg';
        else if (contentType.includes('image/webp')) extension = '.webp';
        else if (contentType.includes('image/gif')) extension = '.gif';
        else if (contentType.includes('image/png')) extension = '.png';
      } else {
        // Fallback to URL extension
        const urlExt = imageUrl.split('.').pop()?.split('?')[0];
        if (urlExt && ['mp4', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt.toLowerCase())) {
          extension = `.${urlExt}`;
        }
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = `${filenamePrefix}-${Date.now()}${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('canvasNodes.shared.imageDownloaded'), { duration: 2000 });
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to direct link
      const link = document.createElement('a');
      link.href = imageUrl;

      // Attempt to guess extension for fallback
      let extension = '.png';
      const urlExt = imageUrl.split('.').pop()?.split('?')[0];
      if (urlExt && ['mp4', 'jpg', 'jpeg', 'png', 'webp', 'gif'].includes(urlExt.toLowerCase())) {
        extension = `.${urlExt}`;
      }

      link.download = `${filenamePrefix}-${Date.now()}${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Still show success as we tried our best
      toast.success(t('canvasNodes.shared.imageDownloaded'), { duration: 2000 });
    } finally {
      setIsDownloading(false);
    }
  }, [imageUrl, filenamePrefix, t]);

  return { handleDownload, isDownloading };
};

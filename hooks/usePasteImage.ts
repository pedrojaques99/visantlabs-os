import { useEffect, useCallback } from 'react';
import type { UploadedImage } from '../types';

/**
 * Hook to handle paste events (Ctrl+V) and extract images from clipboard
 */
export const usePasteImage = (
  onImagePaste: (image: UploadedImage) => void,
  enabled: boolean = true
) => {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (!enabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Find image in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          e.stopPropagation();

          const file = item.getAsFile();
          if (!file) continue;

          // Convert to base64 for preview, but also pass File for direct upload
          const reader = new FileReader();
          reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
              // Extract base64 (remove data URL prefix)
              const base64 = result.includes(',') ? result.split(',')[1] : result;
              const mimeType = file.type || 'image/png';

              onImagePaste({
                base64,
                mimeType,
                file, // Pass File object for direct upload to R2
              });
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    },
    [enabled, onImagePaste]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [enabled, handlePaste]);
};







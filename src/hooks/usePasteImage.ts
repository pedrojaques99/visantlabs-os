import { useEffect, useCallback } from 'react';
import type { UploadedImage } from '../types/types';
import { isLocalDevelopment } from '@/utils/env';

/**
 * Hook to handle paste events (Ctrl+V) and extract images from clipboard
 */
export const usePasteImage = (
  onImagePaste: (image: UploadedImage) => void,
  enabled: boolean = true
) => {
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      if (isLocalDevelopment()) {
        console.log('[usePasteImage] Paste event triggered', { enabled, clipboardData: e.clipboardData });
      }

      if (!enabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Find image in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (isLocalDevelopment()) {
          console.log('[usePasteImage] Checking item', { type: item.type, kind: item.kind });
        }
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
              if (isLocalDevelopment()) {
                console.log('[usePasteImage] calling onImagePaste with image data');
              }
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







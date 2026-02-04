
import type { UploadedImage } from '../types/types';

/**
 * Format image to 16:9 aspect ratio without cropping
 * Adds padding (letterboxing/pillarboxing) when necessary
 */
export const formatImageTo16_9 = async (base64: string, mimeType: string): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const originalWidth = img.width;
      const originalHeight = img.height;
      const originalAspectRatio = originalWidth / originalHeight;
      const targetAspectRatio = 16 / 9;

      // If already 16:9 (within small tolerance), return original
      if (Math.abs(originalAspectRatio - targetAspectRatio) < 0.01) {
        resolve({ base64, mimeType });
        return;
      }

      let canvasWidth: number;
      let canvasHeight: number;
      let x: number;
      let y: number;

      // Calculate canvas dimensions and image position
      if (originalAspectRatio > targetAspectRatio) {
        // Image is wider than 16:9, add vertical padding (letterboxing)
        canvasWidth = originalWidth;
        canvasHeight = originalWidth / targetAspectRatio;
        x = 0;
        y = (canvasHeight - originalHeight) / 2;
      } else {
        // Image is taller than 16:9, add horizontal padding (pillarboxing)
        canvasWidth = originalHeight * targetAspectRatio;
        canvasHeight = originalHeight;
        x = (canvasWidth - originalWidth) / 2;
        y = 0;
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error("Failed to get canvas context."));
        return;
      }

      // Fill background - transparent for PNG/WebP, black for JPG
      const isTransparent = mimeType === 'image/png' || mimeType === 'image/webp';
      if (!isTransparent) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // Draw original image centered
      ctx.drawImage(img, x, y, originalWidth, originalHeight);

      // Convert to base64
      const outputMimeType = mimeType === 'image/gif' ? 'image/png' : mimeType;
      const dataUrl = canvas.toDataURL(outputMimeType, 1.0);
      const formattedBase64 = dataUrl.split(',')[1];

      if (formattedBase64) {
        resolve({ base64: formattedBase64, mimeType: outputMimeType });
      } else {
        reject(new Error("Failed to format image to 16:9."));
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image for formatting."));
    };

    // Load image from base64
    img.src = `data:${mimeType};base64,${base64}`;
  });
};

export const fileToBase64 = async (file: File | Blob): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) {
        try {
          // Automatically format to 16:9
          const formatted = await formatImageTo16_9(base64, file.type);
          resolve(formatted);
        } catch (error) {
          // If formatting fails, return original
          console.warn("Failed to format image to 16:9, using original:", error);
          resolve({ base64, mimeType: file.type });
        }
      } else {
        reject(new Error("Failed to convert file to base64."));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const videoToBase64 = async (file: File | Blob): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (base64) {
        resolve({ base64, mimeType: file.type });
      } else {
        reject(new Error("Failed to convert video to base64."));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Image compression utilities for client-side image optimization
 * Compresses and resizes images to reduce payload size before uploading to R2
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeBytes?: number;
  quality?: number;
  mimeType?: string;
}

const DEFAULT_MAX_WIDTH = 2048;
const DEFAULT_MAX_HEIGHT = 2048;
const DEFAULT_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const DEFAULT_QUALITY = 0.85;

/**
 * Compress and resize an image to reduce file size
 * @param base64Image - Base64 encoded image string (with or without data URL prefix)
 * @param options - Compression options
 * @returns Compressed image as base64 string with data URL prefix
 */
export async function compressImage(
  base64Image: string,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    quality = DEFAULT_QUALITY,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const originalSize = (width * height * 4) / 1024 / 1024; // Approximate size in MB (RGBA)

        // If image is very large, reduce dimensions more aggressively
        if (originalSize > 10) {
          // For very large images, reduce max dimensions further
          const adjustedMaxWidth = Math.min(maxWidth, 1280);
          const adjustedMaxHeight = Math.min(maxHeight, 1280);

          if (width > adjustedMaxWidth || height > adjustedMaxHeight) {
            const aspectRatio = width / height;
            if (width > height) {
              width = adjustedMaxWidth;
              height = width / aspectRatio;
            } else {
              height = adjustedMaxHeight;
              width = height * aspectRatio;
            }
          }
        } else if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format
        const inputMimeType = options.mimeType || getMimeTypeFromBase64(base64Image) || 'image/jpeg';
        const outputMimeType = inputMimeType === 'image/png' ? 'image/png' : 'image/jpeg';

        // Try different quality levels if image is still too large
        let currentQuality = quality;
        let compressedBase64 = '';
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
          // Convert to base64
          compressedBase64 = canvas.toDataURL(outputMimeType, currentQuality);

          // Calculate size (base64 is ~33% larger than binary)
          const base64Data = compressedBase64.split(',')[1];
          if (!base64Data) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Approximate binary size from base64
          const binarySize = (base64Data.length * 3) / 4;

          // If size is acceptable, return
          if (binarySize <= maxSizeBytes) {
            resolve(compressedBase64);
            return;
          }

          // Reduce quality and try again
          currentQuality = Math.max(0.3, currentQuality - 0.15);
          attempts++;
        }

        // If still too large after quality reduction, check final size
        const finalBase64Data = compressedBase64.split(',')[1];
        const finalBinarySize = finalBase64Data ? (finalBase64Data.length * 3) / 4 : 0;

        // This ensures we always return something, even if slightly over limit
        if (finalBinarySize > maxSizeBytes) {
          console.warn(`Image compression: Final size (${(finalBinarySize / 1024 / 1024).toFixed(2)}MB) exceeds target (${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB) after ${maxAttempts} attempts`);
        }
        resolve(compressedBase64);
      } catch (error: any) {
        reject(new Error(`Failed to compress image: ${error.message}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    // Load image from base64
    const dataUrl = base64Image.startsWith('data:')
      ? base64Image
      : `data:image/jpeg;base64,${base64Image}`;
    img.src = dataUrl;
  });
}

/**
 * Get MIME type from base64 string
 */
function getMimeTypeFromBase64(base64: string): string | null {
  if (base64.startsWith('data:')) {
    const match = base64.match(/data:([^;]+);/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Check if an image needs compression based on size
 * @param base64Image - Base64 encoded image string
 * @param maxSizeBytes - Maximum size in bytes (default: 2MB)
 * @returns true if image exceeds max size
 */
export function needsCompression(base64Image: string, maxSizeBytes: number = DEFAULT_MAX_SIZE_BYTES): boolean {
  if (!base64Image) return false;

  const base64Data = base64Image.includes(',')
    ? base64Image.split(',')[1]
    : base64Image;

  if (!base64Data) return false;

  // Approximate binary size from base64 (base64 is ~33% larger)
  const binarySize = (base64Data.length * 3) / 4;
  return binarySize > maxSizeBytes;
}

/**
 * Get approximate size of base64 image in bytes
 */
export function getBase64ImageSize(base64Image: string): number {
  const base64Data = base64Image.includes(',')
    ? base64Image.split(',')[1]
    : base64Image;

  if (!base64Data) return 0;

  // Approximate binary size from base64
  return (base64Data.length * 3) / 4;
}

/**
 * Compress a File object and return a Blob
 * This is useful for direct uploads to R2 without base64 conversion
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<Blob> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    quality = DEFAULT_QUALITY,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(url);

        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        const originalSize = (width * height * 4) / 1024 / 1024; // Approximate size in MB (RGBA)

        // If image is very large, reduce dimensions more aggressively
        if (originalSize > 10) {
          const adjustedMaxWidth = Math.min(maxWidth, 1280);
          const adjustedMaxHeight = Math.min(maxHeight, 1280);

          if (width > adjustedMaxWidth || height > adjustedMaxHeight) {
            const aspectRatio = width / height;
            if (width > height) {
              width = adjustedMaxWidth;
              height = width / aspectRatio;
            } else {
              height = adjustedMaxHeight;
              width = height * aspectRatio;
            }
          }
        } else if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Determine output format
        const inputMimeType = options.mimeType || file.type || 'image/jpeg';
        const outputMimeType = inputMimeType === 'image/png' ? 'image/png' : 'image/jpeg';

        // Try different quality levels if image is still too large
        let currentQuality = quality;
        let attempts = 0;
        const maxAttempts = 5;

        const tryCompress = (): void => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to compress image'));
                return;
              }

              // If size is acceptable, return
              if (blob.size <= maxSizeBytes || attempts >= maxAttempts) {
                if (blob.size > maxSizeBytes) {
                  console.warn(`Image compression: Final size (${(blob.size / 1024 / 1024).toFixed(2)}MB) exceeds target (${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB) after ${maxAttempts} attempts`);
                }
                resolve(blob);
                return;
              }

              // Reduce quality and try again
              currentQuality = Math.max(0.3, currentQuality - 0.15);
              attempts++;
              tryCompress();
            },
            outputMimeType,
            currentQuality
          );
        };

        tryCompress();
      } catch (error: any) {
        reject(new Error(`Failed to compress image: ${error.message}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}


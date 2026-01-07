/**
 * Export image with scale using Canvas API
 * Maintains original resolution while applying scale
 */

export async function exportImageWithScale(
  imageUrl: string,
  format: 'png' | 'jpg' | 'svg',
  scale: number,
  fileName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        // Create canvas with scaled dimensions
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Calculate scaled dimensions
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Set canvas size to scaled dimensions
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;

        // Draw image scaled to canvas (maintains original resolution)
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

        // Export based on format
        if (format === 'svg') {
          // For SVG, we'll convert to SVG format or fallback to PNG
          // SVG export is complex, so we'll export as PNG with SVG extension
          // or create a simple SVG wrapper
          exportAsSVG(canvas, fileName, scaledWidth, scaledHeight)
            .then(resolve)
            .catch((err) => {
              // Fallback to PNG if SVG fails
              console.warn('SVG export failed, falling back to PNG:', err);
              exportAsImage(canvas, 'png', fileName, scale)
                .then(resolve)
                .catch(reject);
            });
        } else {
          exportAsImage(canvas, format, fileName, scale)
            .then(resolve)
            .catch(reject);
        }
      } catch (error: any) {
        reject(new Error(`Export failed: ${error.message}`));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for export'));
    };

    // Handle CORS issues
    // Handle CORS issues by using proxy for external images
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('blob:')) {
      img.src = imageUrl;
    } else {
      try {
        // Check if it's an external URL
        const isExternal = imageUrl.startsWith('http') && new URL(imageUrl).origin !== window.location.origin;

        if (isExternal) {
          const apiBaseUrl = (import.meta as any).env?.VITE_API_URL || '/api';
          const cleanBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
          img.src = `${cleanBaseUrl}/images/stream?url=${encodeURIComponent(imageUrl)}`;
        } else {
          img.src = imageUrl;
        }
      } catch (e) {
        // If URL parsing fails, fallback to direct loading
        img.src = imageUrl;
      }
    }
  });
}

function exportAsImage(
  canvas: HTMLCanvasElement,
  format: 'png' | 'jpg',
  fileName: string,
  scale: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const quality = format === 'jpg' ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${fileName}-${scale}x.${format}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          resolve();
        },
        mimeType,
        quality
      );
    } catch (error: any) {
      reject(new Error(`Failed to export as ${format}: ${error.message}`));
    }
  });
}

async function exportAsSVG(
  canvas: HTMLCanvasElement,
  fileName: string,
  width: number,
  height: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png');

      // Create SVG with embedded image
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <image width="${width}" height="${height}" xlink:href="${dataUrl}"/>
  </svg>`;

      // Create blob and download
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}-${width}x${height}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      resolve();
    } catch (error: any) {
      reject(new Error(`Failed to export as SVG: ${error.message}`));
    }
  });
}

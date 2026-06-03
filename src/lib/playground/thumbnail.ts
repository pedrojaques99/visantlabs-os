import { toPng } from 'html-to-image';
import { authService } from '@/services/authService';

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 400;

export async function capturePreviewThumbnail(previewElement: HTMLElement): Promise<string | null> {
  try {
    const dataUrl = await toPng(previewElement, {
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT,
      quality: 0.8,
      pixelRatio: 1,
      backgroundColor: '#0a0a0a',
      style: {
        transform: `scale(${THUMBNAIL_WIDTH / previewElement.offsetWidth})`,
        transformOrigin: 'top left',
        width: `${previewElement.offsetWidth}px`,
        height: `${previewElement.offsetHeight}px`,
      },
    });

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

    const token = authService.getToken();
    const res = await fetch('/api/playground/proxy/community/upload-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ image: base64 }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.url || data.imageUrl || null;
  } catch {
    return null;
  }
}

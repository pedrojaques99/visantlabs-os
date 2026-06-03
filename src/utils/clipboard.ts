import { getProxiedUrl } from './proxyUtils';
import { loadImage } from '@/utils/imageUtils';

export function base64ToUint8Array(base64: string): Uint8Array {
  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  return byteArray;
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function fetchImageAsBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const base64Data = url.split(',')[1];
    const mimeMatch = url.match(/data:(.*?);/);
    const arr = base64ToUint8Array(base64Data);
    return new Blob([arr.buffer as ArrayBuffer], { type: mimeMatch?.[1] || 'image/png' });
  }

  if (url.startsWith('blob:')) {
    const response = await fetch(url);
    return response.blob();
  }

  // External URL — try direct fetch, fallback to proxy
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.statusText);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Not an image');
    return blob;
  } catch {
    const proxyUrl = getProxiedUrl(url);
    const proxyResponse = await fetch(proxyUrl);
    if (!proxyResponse.ok) throw new Error('Proxy fetch failed');

    const contentType = proxyResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await proxyResponse.json();
      if (data.error) throw new Error(data.error);
      const arr = base64ToUint8Array(data.base64);
      return new Blob([arr.buffer as ArrayBuffer], { type: data.mimeType || 'image/png' });
    }

    const blob = await proxyResponse.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Proxy response is not an image');
    return blob;
  }
}

async function convertToPngBlob(blob: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);
  let img: HTMLImageElement;
  try {
    img = await loadImage(objectUrl);
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Failed to load image for PNG conversion');
  }
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Canvas context failed');
  }
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      URL.revokeObjectURL(objectUrl);
      if (result) { resolve(result); } else { reject(new Error('PNG conversion failed')); }
    }, 'image/png');
  });
}

export async function copyImageAsPng(
  url: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let blob = await fetchImageAsBlob(url);

    if (blob.type !== 'image/png') {
      blob = await convertToPngBlob(blob);
    }

    if (!navigator.clipboard?.write) {
      throw new Error('Clipboard API not supported');
    }

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);

    return { success: true };
  } catch (error: any) {
    console.error('copyImageAsPng failed:', error);
    return { success: false, error: error?.message || 'Failed to copy image' };
  }
}

export async function copyImageOriginal(
  url: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const blob = await fetchImageAsBlob(url);

    if (!navigator.clipboard?.write) {
      throw new Error('Clipboard API not supported');
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
    } catch {
      // Most browsers only support image/png in ClipboardItem — fallback
      const pngBlob = await convertToPngBlob(blob);
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob }),
      ]);
    }

    return { success: true };
  } catch (error: any) {
    console.error('copyImageOriginal failed:', error);
    return { success: false, error: error?.message || 'Failed to copy image' };
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fallback below */ }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}

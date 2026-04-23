const THUMB_MAX_SIZE = 400;
const cache = new Map<string, string>();

export function getThumbnailFromCache(key: string): string | undefined {
  return cache.get(key);
}

export async function generateThumbnail(dataUrl: string, cacheKey: string): Promise<string> {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
  });

  const ratio = Math.min(THUMB_MAX_SIZE / img.width, THUMB_MAX_SIZE / img.height, 1);
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.7)
  );

  const thumbUrl = URL.createObjectURL(blob);
  cache.set(cacheKey, thumbUrl);
  return thumbUrl;
}

export function revokeThumbnail(cacheKey: string) {
  const url = cache.get(cacheKey);
  if (url) {
    URL.revokeObjectURL(url);
    cache.delete(cacheKey);
  }
}

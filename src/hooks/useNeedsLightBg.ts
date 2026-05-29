import { useState, useEffect, useRef } from 'react';
import { loadImage } from '@/utils/imageUtils';

export function useNeedsLightBg(url: string) {
  const [needsLight, setNeedsLight] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;

  useEffect(() => {
    loadImage(url).then((img) => {
      if (urlRef.current !== url) return;
      try {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        let darkOrTransparent = 0;
        const total = size * size;
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 30) { darkOrTransparent++; continue; }
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum < 50) darkOrTransparent++;
        }
        setNeedsLight(darkOrTransparent / total > 0.7);
      } catch { /* CORS or canvas error — keep dark bg */ }
    }).catch(() => { /* image failed to load — keep dark bg */ });
  }, [url]);

  return needsLight;
}

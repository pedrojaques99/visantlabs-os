import { potrace } from 'esm-potrace-wasm';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MAX_TRACE_DIM = 512;

export async function pngToSvg(file: File): Promise<string> {
  const dataUrl = await fileToDataURL(file);
  const img = await loadImage(dataUrl);

  let w = img.width;
  let h = img.height;
  if (w > MAX_TRACE_DIM || h > MAX_TRACE_DIM) {
    const scale = MAX_TRACE_DIM / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const { data } = imageData;

  // Check for alpha channel — if present, use alpha mask for silhouette
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) { hasAlpha = true; break; }
  }

  if (hasAlpha) {
    // Alpha masking: foreground (opaque) = black, transparent = white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    const mask = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < data.length; i += 4) {
      const val = data[i + 3] >= 128 ? 0 : 255;
      mask.data[i] = val;
      mask.data[i + 1] = val;
      mask.data[i + 2] = val;
      mask.data[i + 3] = 255;
    }
    ctx.putImageData(mask, 0, 0);
  }

  const svgString = await potrace(canvas, {
    turdsize: 2,
    alphamax: 1,
    opticurve: true,
    opttolerance: 0.2,
    color: '#000000',
  });

  return svgString;
}

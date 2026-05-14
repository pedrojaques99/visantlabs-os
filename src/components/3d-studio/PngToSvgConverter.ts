let cachedTracer: any = null;

async function getImageTracer() {
  if (!cachedTracer) {
    const mod = await import('imagetracerjs');
    cachedTracer = (mod as any).default || mod;
  }
  return cachedTracer;
}

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

function createAlphaMask(
  imageData: ImageData,
  threshold: number = 128,
): ImageData {
  const { width, height, data } = imageData;
  const out = new ImageData(width, height);

  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) {
      hasAlpha = true;
      break;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    let isForeground: boolean;

    if (hasAlpha) {
      isForeground = data[i + 3] >= threshold;
    } else {
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      isForeground = lum < 200;
    }

    const val = isForeground ? 0 : 255;
    out.data[i] = val;
    out.data[i + 1] = val;
    out.data[i + 2] = val;
    out.data[i + 3] = 255;
  }
  return out;
}

const MAX_TRACE_DIM = 512;

export async function pngToSvg(file: File): Promise<string> {
  const ImageTracer = await getImageTracer();
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
  ctx.drawImage(img, 0, 0, w, h);
  const rawData = ctx.getImageData(0, 0, w, h);

  const mask = createAlphaMask(rawData);

  const svgString: string = ImageTracer.imagedataToSVG(mask, {
    ltres: 0.5,
    qtres: 0.5,
    pathomit: 4,
    colorsampling: 0,
    numberofcolors: 2,
    mincolorratio: 0,
    colorquantcycles: 1,
    blurradius: 0,
    blurdelta: 20,
    strokewidth: 0,
    linefilter: false,
    roundcoords: 2,
  });

  return svgString;
}

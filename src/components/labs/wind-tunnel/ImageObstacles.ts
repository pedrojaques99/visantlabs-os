export interface ImageTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

function IX(i: number, j: number, N: number): number {
  return i + (N + 2) * j;
}

export function rasterizeImageToObstacles(
  img: HTMLImageElement,
  gridSize: number,
  canvasWidth: number,
  canvasHeight: number,
  transform?: ImageTransform
): boolean[] {
  const N = gridSize;
  const size = (N + 2) * (N + 2);
  const obs = new Array<boolean>(size).fill(false);

  const c = document.createElement('canvas');
  c.width = canvasWidth;
  c.height = canvasHeight;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const scaleFactor = (transform?.scale ?? 1) * 0.6;
  const aspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = canvasWidth / canvasHeight;
  let dw: number, dh: number, dx: number, dy: number;

  if (aspect > canvasAspect) {
    dw = canvasWidth * scaleFactor;
    dh = dw / aspect;
  } else {
    dh = canvasHeight * scaleFactor;
    dw = dh * aspect;
  }
  dx = (canvasWidth - dw) / 2 + (transform?.offsetX ?? 0) * canvasWidth;
  dy = (canvasHeight - dh) / 2 + (transform?.offsetY ?? 0) * canvasHeight;

  ctx.drawImage(img, dx, dy, dw, dh);

  const data = ctx.getImageData(0, 0, canvasWidth, canvasHeight).data;

  for (let j = 1; j <= N; j++) {
    for (let i = 1; i <= N; i++) {
      const x0 = Math.floor(((i - 1) / N) * canvasWidth);
      const x1 = Math.floor((i / N) * canvasWidth);
      const y0 = Math.floor(((j - 1) / N) * canvasHeight);
      const y1 = Math.floor((j / N) * canvasHeight);
      let hit = false;
      for (let y = y0; y < y1 && !hit; y++)
        for (let x = x0; x < x1 && !hit; x++) {
          const idx = (y * canvasWidth + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
          if (a > 128 && (r > 128 || g > 128 || b > 128)) hit = true;
        }
      obs[IX(i, j, N)] = hit;
    }
  }

  const dilated = [...obs];
  for (let j = 1; j <= N; j++)
    for (let i = 1; i <= N; i++)
      if (obs[IX(i, j, N)])
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ni = i + di, nj = j + dj;
            if (ni >= 1 && ni <= N && nj >= 1 && nj <= N)
              dilated[IX(ni, nj, N)] = true;
          }

  return dilated;
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

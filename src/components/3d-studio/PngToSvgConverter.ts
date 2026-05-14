let cachedTracer: any = null;

async function getImageTracer() {
  if (!cachedTracer) {
    const mod = await import('imagetracerjs');
    cachedTracer = (mod as any).default || mod;
  }
  return cachedTracer;
}

export async function pngToSvg(file: File): Promise<string> {
  const ImageTracer = await getImageTracer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        try {
          const svgString = ImageTracer.imagedataToSVG(imageData, {
            ltres: 1,
            qtres: 1,
            pathomit: 8,
            colorsampling: 2,
            numberofcolors: 16,
            mincolorratio: 0,
            colorquantcycles: 3,
            blurradius: 0,
            blurdelta: 20,
            strokewidth: 0,
            linefilter: false,
            roundcoords: 1,
          });
          resolve(svgString);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

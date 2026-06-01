/**
 * Server-side 3D scene rendering — SVG → PNG via @napi-rs/canvas (2D rasterization).
 * For turntable GIF, renders rotated frames and encodes with FFmpeg.
 *
 * Note: True 3D PBR rendering requires WebGL2 (headless-gl is WebGL1 only).
 * This service renders the traced SVG as a clean 2D preview with background.
 * The GLB export (studio3dExportService) provides the actual 3D model.
 */

export interface RenderOptions {
  width?: number;
  height?: number;
  background?: string;
  color?: string;
  padding?: number;
}

export interface GifOptions extends RenderOptions {
  frames?: number;
  fps?: number;
}

type NapiCanvasModule = typeof import('@napi-rs/canvas');

let _napi: NapiCanvasModule | null = null;
async function getNapi(): Promise<NapiCanvasModule> {
  if (!_napi) _napi = await import('@napi-rs/canvas');
  return _napi;
}

export async function renderSvgToPng(svgString: string, opts: RenderOptions = {}): Promise<Buffer> {
  const width = opts.width || 1200;
  const height = opts.height || 900;
  const bg = opts.background || '#111111';
  const fillColor = opts.color || '#c0c0c0';
  const padding = opts.padding ?? 60;

  const { createCanvas } = await getNapi();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Parse SVG viewBox to get natural dimensions
  const vbMatch = svgString.match(/viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/);
  const svgW = vbMatch ? parseFloat(vbMatch[3]) : 100;
  const svgH = vbMatch ? parseFloat(vbMatch[4]) : 100;

  // Fit SVG into canvas with padding
  const drawW = width - padding * 2;
  const drawH = height - padding * 2;
  const scaleX = drawW / svgW;
  const scaleY = drawH / svgH;
  const scale = Math.min(scaleX, scaleY);
  const offX = padding + (drawW - svgW * scale) / 2;
  const offY = padding + (drawH - svgH * scale) / 2;

  // Override fill color in SVG and render
  const coloredSvg = svgString
    .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
    .replace(/stroke="[^"]*"/g, `stroke="${fillColor}"`);

  // Encode SVG to data URI for canvas drawImage
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(coloredSvg).toString('base64')}`;

  const { Image } = await getNapi();
  const img = new Image();
  img.src = Buffer.from(coloredSvg);

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(scale, scale);
  ctx.drawImage(img as any, 0, 0, svgW, svgH);
  ctx.restore();

  // Drop shadow effect
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.filter = 'blur(20px)';
  ctx.translate(offX + 8, offY + 12);
  ctx.scale(scale, scale);
  ctx.drawImage(img as any, 0, 0, svgW, svgH);
  ctx.restore();

  return Buffer.from(canvas.toBuffer('image/png'));
}

export async function renderSvgToGif(svgString: string, opts: GifOptions = {}): Promise<Buffer> {
  const width = opts.width || 600;
  const height = opts.height || 450;
  const bg = opts.background || '#111111';
  const fillColor = opts.color || '#c0c0c0';
  const totalFrames = opts.frames || 36;
  const fps = opts.fps || 18;

  const { createCanvas, Image } = await getNapi();
  const { mkdir, writeFile, rm, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { randomUUID } = await import('node:crypto');
  const { execFile: execFileCb } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFileCb);

  const vbMatch = svgString.match(/viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/);
  const svgW = vbMatch ? parseFloat(vbMatch[3]) : 100;
  const svgH = vbMatch ? parseFloat(vbMatch[4]) : 100;

  const coloredSvg = svgString
    .replace(/fill="[^"]*"/g, `fill="${fillColor}"`)
    .replace(/stroke="[^"]*"/g, `stroke="${fillColor}"`);

  const img = new Image();
  img.src = Buffer.from(coloredSvg);

  const workDir = join(tmpdir(), 'visant-3d-gif', randomUUID());
  await mkdir(workDir, { recursive: true });

  try {
    const padding = 40;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;
    const baseScale = Math.min(drawW / svgW, drawH / svgH) * 0.75;

    for (let i = 0; i < totalFrames; i++) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Rotation animation (simulated 3D via scaleX + subtle Y offset)
      const angle = (i / totalFrames) * Math.PI * 2;
      const scaleX = Math.cos(angle);
      const skewY = Math.sin(angle) * 0.08;
      const scale = baseScale;

      const cx = width / 2;
      const cy = height / 2;

      // Drop shadow
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.translate(cx + 6, cy + 10);
      ctx.scale(scale * scaleX, scale * (1 + skewY));
      ctx.translate(-svgW / 2, -svgH / 2);
      ctx.drawImage(img as any, 0, 0, svgW, svgH);
      ctx.restore();

      // Main shape
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale * scaleX, scale * (1 + skewY));
      ctx.translate(-svgW / 2, -svgH / 2);
      ctx.drawImage(img as any, 0, 0, svgW, svgH);
      ctx.restore();

      const buf = canvas.toBuffer('image/jpeg');
      const idx = String(i).padStart(6, '0');
      await writeFile(join(workDir, `frame_${idx}.jpg`), buf);
    }

    // Encode to GIF via FFmpeg
    const palettePath = join(workDir, 'palette.png');
    const outputPath = join(workDir, 'output.gif');
    const maxW = Math.min(width, 640);
    const scaleFilter = `scale=${maxW}:-1:flags=lanczos`;

    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(fps),
      '-i', join(workDir, 'frame_%06d.jpg'),
      '-vf', `${scaleFilter},palettegen=stats_mode=diff`,
      palettePath,
    ], { maxBuffer: 10 * 1024 * 1024, timeout: 60_000 });

    await execFileAsync('ffmpeg', [
      '-y', '-framerate', String(fps),
      '-i', join(workDir, 'frame_%06d.jpg'),
      '-i', palettePath,
      '-lavfi', `${scaleFilter} [x]; [x][1:v] paletteuse=dither=floyd_steinberg`,
      '-loop', '0',
      outputPath,
    ], { maxBuffer: 50 * 1024 * 1024, timeout: 120_000 });

    return await readFile(outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

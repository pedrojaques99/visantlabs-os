/**
 * Turns the document into files. Everything is rendered by the browser, frame by
 * frame, from the same SVG the preview shows. No server, no AI, no credits.
 */
import * as Mp4Muxer from 'mp4-muxer';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { FORMATS, buildArtworkSvg, frameProgress, inkBlendMode, usesLogo } from './engine';
import { embedFontCss } from './fonts';
import { drawPaper, drawVeil } from './paper';
import type { InkDoc, InkLogo } from './types';

const FILTER_ID = 'ink-bleed-export';
const VIDEO_FPS = 30;
const GIF_FPS = 15;
const GIF_MAX_SIDE = 640;
const VIDEO_BITRATE = 8_000_000;

export interface ExportOptions {
  doc: InkDoc;
  logo: InkLogo | null;
  progress: number;
}

/**
 * WebKit silently drops a filtered element above a certain size, which would deliver
 * paper with no ink. Raised instead, so nobody downloads an empty artwork.
 */
export class InkTooLargeError extends Error {
  constructor() {
    super('The browser dropped the ink at this size');
    this.name = 'InkTooLargeError';
  }
}

function isBlank(source: HTMLCanvasElement): boolean {
  const probe = createCanvas(96, 72);
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, probe.width, probe.height);
  const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return false;
  return true;
}

function outputText(doc: InkDoc): string {
  const { text, uppercase } = doc.typography;
  return uppercase ? text.toUpperCase() : text;
}

async function fontCssFor(doc: InkDoc, logo: InkLogo | null): Promise<string> {
  if (usesLogo(doc, logo)) return '';
  return embedFontCss(doc.typography.fontFamily, doc.typography.fontWeight, outputText(doc));
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  return ctx;
}

function drawSvg(
  ctx: CanvasRenderingContext2D,
  svg: string,
  blend: GlobalCompositeOperation = 'source-over'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      ctx.save();
      ctx.globalCompositeOperation = blend;
      ctx.drawImage(image, 0, 0);
      ctx.restore();
      URL.revokeObjectURL(url);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the artwork'));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // A null blob means the canvas passed what this device can hold.
    canvas.toBlob((b) => (b ? resolve(b) : reject(new InkTooLargeError())), type);
  });
}

function layerBlend(doc: InkDoc): GlobalCompositeOperation {
  return inkBlendMode(doc) === 'multiply' ? 'multiply' : 'source-over';
}

export interface RasterOptions extends ExportOptions {
  scale: number;
  transparent: boolean;
}

/** One full-resolution image of the artwork, on paper or on transparency. */
export async function renderRaster(options: RasterOptions): Promise<HTMLCanvasElement> {
  const { doc, logo, progress, scale, transparent } = options;
  const base = FORMATS[doc.format];
  const canvas = createCanvas(Math.round(base.width * scale), Math.round(base.height * scale));
  const ctx = get2d(canvas);
  if (!transparent) drawPaper(ctx, canvas.width, canvas.height, doc.paper, scale, doc.seed);
  const fontCss = await fontCssFor(doc, logo);
  const ink = createCanvas(canvas.width, canvas.height);
  await drawSvg(
    get2d(ink),
    buildArtworkSvg(doc, { filterId: FILTER_ID, scale, progress, logo, fontCss })
  );
  const hasContent = usesLogo(doc, logo) || outputText(doc).trim().length > 0;
  if (hasContent && isBlank(ink)) throw new InkTooLargeError();
  ctx.save();
  ctx.globalCompositeOperation = transparent ? 'source-over' : layerBlend(doc);
  ctx.drawImage(ink, 0, 0);
  ctx.restore();
  if (!transparent) drawVeil(ctx, canvas.width, canvas.height, doc.paper, doc.seed);
  return canvas;
}

export async function exportPng(options: RasterOptions): Promise<Blob> {
  return toBlob(await renderRaster(options), 'image/png');
}

export async function exportPngDataUrl(options: RasterOptions): Promise<string> {
  return (await renderRaster(options)).toDataURL('image/png');
}

/**
 * Editable SVG: live text with the font embedded, ink as a filter. The filter is
 * resolved by whoever opens the file, so the ink is not vector and programs without
 * SVG filter support (some versions of Illustrator) will not show it.
 */
export async function exportSvg(options: ExportOptions & { transparent: boolean }): Promise<Blob> {
  const { doc, logo, progress, transparent } = options;
  const base = FORMATS[doc.format];
  let paperDataUrl: string | undefined;
  let veilDataUrl: string | undefined;
  if (!transparent && doc.paper.paperType !== 'transparent') {
    const paper = createCanvas(base.width, base.height);
    drawPaper(get2d(paper), base.width, base.height, doc.paper, 1, doc.seed);
    paperDataUrl = paper.toDataURL('image/png');
    if (doc.paper.veil > 0 && doc.paper.patches > 0) {
      const veil = createCanvas(base.width, base.height);
      drawVeil(get2d(veil), base.width, base.height, doc.paper, doc.seed);
      veilDataUrl = veil.toDataURL('image/png');
    }
  }
  const fontCss = await fontCssFor(doc, logo);
  const svg = buildArtworkSvg(doc, {
    filterId: FILTER_ID,
    progress,
    logo,
    fontCss,
    paperDataUrl,
    veilDataUrl,
  });
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
}

export function isMp4Supported(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window;
}

interface MotionOptions {
  doc: InkDoc;
  logo: InkLogo | null;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
}

/** Video has no alpha, so a transparent artwork gets the paper color behind it. */
function makeBackground(doc: InkDoc, width: number, height: number, scale: number) {
  const background = createCanvas(width, height);
  const ctx = get2d(background);
  if (doc.paper.paperType === 'transparent') {
    ctx.fillStyle = doc.paper.baseColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else {
    drawPaper(ctx, width, height, doc.paper, scale, doc.seed);
  }
  return background;
}

/** Yields each animation frame already composed on its canvas. */
async function renderFrames(
  options: MotionOptions,
  fps: number,
  scale: number,
  onFrame: (canvas: HTMLCanvasElement, index: number, total: number) => void | Promise<void>
): Promise<void> {
  const { doc, logo, onProgress, signal } = options;
  const base = FORMATS[doc.format];
  // H.264 and most players only accept even dimensions.
  const width = Math.round(base.width * scale) & ~1;
  const height = Math.round(base.height * scale) & ~1;
  const total = Math.max(1, Math.round((doc.motion.duration / doc.motion.speed) * fps));

  const canvas = createCanvas(width, height);
  const ctx = get2d(canvas);
  const background = makeBackground(doc, width, height, scale);
  const fontCss = await fontCssFor(doc, logo);

  for (let i = 0; i < total; i++) {
    throwIfAborted(signal);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(background, 0, 0);
    const progress = frameProgress(doc.motion.mode, i, total);
    await drawSvg(
      ctx,
      buildArtworkSvg(doc, { filterId: FILTER_ID, scale, progress, logo, fontCss }),
      layerBlend(doc)
    );
    drawVeil(ctx, width, height, doc.paper, doc.seed);
    await onFrame(canvas, i, total);
    onProgress((i + 1) / total);
  }
}

export async function exportMp4(options: MotionOptions): Promise<Blob> {
  const base = FORMATS[options.doc.format];
  const width = base.width & ~1;
  const height = base.height & ~1;

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (e) => {
      encoderError = e;
    },
  });
  encoder.configure({
    codec: 'avc1.640033',
    width,
    height,
    bitrate: VIDEO_BITRATE,
    framerate: VIDEO_FPS,
  });

  try {
    await renderFrames(options, VIDEO_FPS, 1, async (canvas, index) => {
      if (encoderError) throw encoderError;
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((index * 1_000_000) / VIDEO_FPS),
        duration: Math.round(1_000_000 / VIDEO_FPS),
      });
      encoder.encode(frame, { keyFrame: index % (VIDEO_FPS * 2) === 0 });
      frame.close();
      // Rendering outpaces encoding on large formats: wait instead of filling memory.
      while (encoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 5));
      }
    });
    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
}

export async function exportGif(options: MotionOptions): Promise<Blob> {
  const base = FORMATS[options.doc.format];
  const scale = Math.min(1, GIF_MAX_SIDE / Math.max(base.width, base.height));
  const gif = GIFEncoder();
  const delay = Math.round(1000 / GIF_FPS);
  // One palette for the whole file: a palette per frame makes the paper flicker.
  let palette: ReturnType<typeof quantize> | null = null;

  await renderFrames(options, GIF_FPS, scale, (canvas) => {
    const { width, height } = canvas;
    const { data } = get2d(canvas).getImageData(0, 0, width, height);
    palette ??= quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay });
  });

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/** Dimensions a person can check before exporting. */
export function describeSize(doc: InkDoc, scale: number) {
  const base = FORMATS[doc.format];
  const width = Math.round(base.width * scale);
  const height = Math.round(base.height * scale);
  const toCm = (px: number) => ((px / 300) * 2.54).toFixed(1);
  return { width, height, widthCm: toCm(width), heightCm: toCm(height) };
}

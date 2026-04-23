import * as Mp4Muxer from 'mp4-muxer';
import { RenderComposition, AnimationPreset, TransitionType } from '../../types/moodboard';

interface RenderCallbacks {
  onProgress: (percent: number) => void;
  signal: AbortSignal;
}

function applyPreset(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  preset: AnimationPreset,
  progress: number,
  canvasW: number,
  canvasH: number
) {
  let scale = 1;
  let translateX = 0;
  let opacity = 1;

  switch (preset) {
    case 'zoom-in':  scale = 1 + 0.2 * progress; break;
    case 'zoom-out': scale = 1.2 - 0.2 * progress; break;
    case 'pan-lr':   scale = 1.1; translateX = -5 + 10 * progress; break;
    case 'pan-rl':   scale = 1.1; translateX = 5 - 10 * progress; break;
    case 'fade-in':  opacity = Math.min(progress * 10, 1); break;
  }

  const imgRatio = img.width / img.height;
  const canvasRatio = canvasW / canvasH;
  let drawW: number, drawH: number;
  if (imgRatio > canvasRatio) { drawH = canvasH; drawW = canvasH * imgRatio; }
  else { drawW = canvasW; drawH = canvasW / imgRatio; }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.scale(scale, scale);
  ctx.translate(translateX * (canvasW / 100), 0);
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

function applyTransition(
  ctx: CanvasRenderingContext2D,
  imgA: HTMLImageElement, presetA: AnimationPreset, progressA: number,
  imgB: HTMLImageElement, presetB: AnimationPreset, progressB: number,
  transitionProgress: number, transition: TransitionType,
  canvasW: number, canvasH: number
) {
  switch (transition) {
    case 'fade':
      ctx.save(); ctx.globalAlpha = 1 - transitionProgress; applyPreset(ctx, imgA, presetA, progressA, canvasW, canvasH); ctx.restore();
      ctx.save(); ctx.globalAlpha = transitionProgress; applyPreset(ctx, imgB, presetB, progressB, canvasW, canvasH); ctx.restore();
      break;
    case 'slide': {
      const offsetX = canvasW * (1 - transitionProgress);
      ctx.save(); ctx.translate(-canvasW * transitionProgress, 0); applyPreset(ctx, imgA, presetA, progressA, canvasW, canvasH); ctx.restore();
      ctx.save(); ctx.translate(offsetX, 0); applyPreset(ctx, imgB, presetB, progressB, canvasW, canvasH); ctx.restore();
      break;
    }
    case 'wipe':
      applyPreset(ctx, imgA, presetA, progressA, canvasW, canvasH);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvasW * transitionProgress, canvasH); ctx.clip();
      applyPreset(ctx, imgB, presetB, progressB, canvasW, canvasH); ctx.restore();
      break;
    default:
      applyPreset(ctx, imgB, presetB, progressB, canvasW, canvasH);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

interface TimelineSegment {
  type: 'slide' | 'transition';
  slideIndexA?: number;
  slideIndexB?: number;
  slideIndex?: number;
  startFrame: number;
  endFrame: number;
}

function buildTimeline(composition: RenderComposition): { segments: TimelineSegment[]; totalFrames: number } {
  const { slides, fps, transition, transitionDurationFrames } = composition;
  const segments: TimelineSegment[] = [];
  let currentFrame = 0;

  for (let i = 0; i < slides.length; i++) {
    const slideDurationFrames = Math.round(slides[i].durationInSeconds * fps);

    if (i > 0 && transition !== 'none' && transitionDurationFrames > 0) {
      segments.push({ type: 'transition', slideIndexA: i - 1, slideIndexB: i, startFrame: currentFrame, endFrame: currentFrame + transitionDurationFrames });
      currentFrame += transitionDurationFrames;
    }

    const effectiveDuration = (i < slides.length - 1 && transition !== 'none')
      ? slideDurationFrames - transitionDurationFrames
      : slideDurationFrames;

    segments.push({ type: 'slide', slideIndex: i, startFrame: currentFrame, endFrame: currentFrame + Math.max(effectiveDuration, 1) });
    currentFrame += Math.max(effectiveDuration, 1);
  }

  return { segments, totalFrames: currentFrame };
}

export async function renderComposition(composition: RenderComposition, callbacks: RenderCallbacks): Promise<Blob> {
  const { slides, fps, transition } = composition;

  const MAX_DIM = 1920;
  const rawW = Math.max(...slides.map(s => s.width));
  const rawH = Math.max(...slides.map(s => s.height));
  const scale = Math.min(MAX_DIM / rawW, MAX_DIM / rawH, 1);
  const outputWidth = Math.round(rawW * scale);
  const outputHeight = Math.round(rawH * scale);
  const width = outputWidth % 2 === 0 ? outputWidth : outputWidth + 1;
  const height = outputHeight % 2 === 0 ? outputHeight : outputHeight + 1;

  const images = await Promise.all(slides.map(s => loadImage(s.imageUrl)));
  if (callbacks.signal.aborted) throw new DOMException('Render cancelled', 'AbortError');

  const { segments, totalFrames } = buildTimeline(composition);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (e) => { encoderError = e; },
  });

  const safeCloseEncoder = () => {
    try { if (videoEncoder.state !== 'closed') videoEncoder.close(); } catch {}
  };

  videoEncoder.configure({ codec: 'avc1.640033', width, height, bitrate: 8_000_000, framerate: fps, hardwareAcceleration: 'prefer-hardware' });

  for (let frame = 0; frame < totalFrames; frame++) {
    if (callbacks.signal.aborted) { safeCloseEncoder(); throw new DOMException('Render cancelled', 'AbortError'); }
    if (encoderError) { safeCloseEncoder(); throw encoderError; }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const segment = segments.find(s => frame >= s.startFrame && frame < s.endFrame)!;

    if (segment.type === 'slide') {
      const idx = segment.slideIndex!;
      const localProgress = (frame - segment.startFrame) / (segment.endFrame - segment.startFrame);
      applyPreset(ctx, images[idx], slides[idx].preset, localProgress, width, height);
    } else {
      const idxA = segment.slideIndexA!, idxB = segment.slideIndexB!;
      const transitionProgress = (frame - segment.startFrame) / (segment.endFrame - segment.startFrame);
      const slideADurationFrames = Math.round(slides[idxA].durationInSeconds * fps);
      const progressA = (slideADurationFrames - (segment.endFrame - frame)) / slideADurationFrames;
      const progressB = (frame - segment.startFrame) / Math.round(slides[idxB].durationInSeconds * fps);
      applyTransition(ctx, images[idxA], slides[idxA].preset, Math.min(progressA, 1), images[idxB], slides[idxB].preset, Math.min(progressB, 1), transitionProgress, transition, width, height);
    }

    const videoFrame = new VideoFrame(canvas, { timestamp: (frame * 1_000_000) / fps });
    try {
      videoEncoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
    } catch (e) { videoFrame.close(); safeCloseEncoder(); throw e; }
    videoFrame.close();

    callbacks.onProgress((frame / totalFrames) * 100);
    if (frame % 5 === 0) await new Promise(r => requestAnimationFrame(r));
  }

  if (encoderError) { safeCloseEncoder(); throw encoderError; }
  await videoEncoder.flush();
  safeCloseEncoder();
  muxer.finalize();

  const { buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;
  return new Blob([buffer], { type: 'video/mp4' });
}

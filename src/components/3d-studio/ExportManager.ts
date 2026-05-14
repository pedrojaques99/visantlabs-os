import { ASPECT_RATIOS, EXPORT_RESOLUTIONS } from '@/stores/studio3dStore';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import type { Scene, Camera, WebGLRenderer } from 'three';

type AspectRatio = '1:1' | '16:9' | '9:16' | '4:5';
type ExportResolution = 'hd' | '2k' | '4k';

function getExportCanvas(
  sourceCanvas: HTMLCanvasElement,
  aspectRatio: AspectRatio,
  resolution: ExportResolution,
  transparentBg: boolean,
  bgColor: string,
): HTMLCanvasElement {
  const ar = ASPECT_RATIOS[aspectRatio];
  const scale = EXPORT_RESOLUTIONS.find(r => r.id === resolution)?.scale ?? 2;
  const w = ar.w * scale;
  const h = ar.h * scale;

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d')!;

  if (!transparentBg) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  const srcAspect = sourceCanvas.width / sourceCanvas.height;
  const dstAspect = w / h;
  let dw: number, dh: number, dx: number, dy: number;

  if (srcAspect > dstAspect) {
    dw = w;
    dh = w / srcAspect;
    dx = 0;
    dy = (h - dh) / 2;
  } else {
    dh = h;
    dw = h * srcAspect;
    dx = (w - dw) / 2;
    dy = 0;
  }

  ctx.drawImage(sourceCanvas, dx, dy, dw, dh);
  return offscreen;
}

export async function exportPNG(
  canvas: HTMLCanvasElement,
  aspectRatio: AspectRatio,
  resolution: ExportResolution,
  transparentBg: boolean,
  bgColor: string,
  fileName: string,
  shader?: ShaderSettings,
): Promise<void> {
  let offscreen = getExportCanvas(canvas, aspectRatio, resolution, transparentBg, bgColor);
  if (shader) {
    offscreen = await applyShaderToCanvas(offscreen, shader);
  }
  const blob = await new Promise<Blob>((resolve) => {
    offscreen.toBlob((b) => resolve(b!), 'image/png');
  });
  downloadBlob(blob, `${fileName || '3d-export'}.png`);
}

export async function exportVideo(
  canvas: HTMLCanvasElement,
  duration: number,
  fileName: string,
  onProgress?: (progress: number) => void,
  shader?: ShaderSettings,
): Promise<void> {
  let captureSource = canvas;

  let shaderCanvas: HTMLCanvasElement | undefined;
  let shaderAnimId: number | undefined;
  if (shader) {
    shaderCanvas = document.createElement('canvas');
    shaderCanvas.width = canvas.width;
    shaderCanvas.height = canvas.height;
    const shaderCtx = shaderCanvas.getContext('2d')!;

    const renderLoop = async () => {
      try {
        const processed = await applyShaderToCanvas(canvas, shader);
        shaderCtx.clearRect(0, 0, shaderCanvas!.width, shaderCanvas!.height);
        shaderCtx.drawImage(processed, 0, 0);
      } catch { /* skip frame */ }
      shaderAnimId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    captureSource = shaderCanvas;
  }

  const stream = captureSource.captureStream(60);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve) => {
    recorder.onstop = () => {
      if (shaderAnimId) cancelAnimationFrame(shaderAnimId);
      const blob = new Blob(chunks, { type: 'video/webm' });
      downloadBlob(blob, `${fileName || '3d-export'}.webm`);
      resolve();
    };

    recorder.start(100);

    const totalMs = duration * 1000;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(elapsed / totalMs, 1));
      if (elapsed >= totalMs) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 100);
  });
}

export async function exportGLB(
  scene: Scene,
  fileName: string,
): Promise<void> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true });
  const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  downloadBlob(blob, `${fileName || '3d-export'}.glb`);
}

export async function exportOBJ(
  scene: Scene,
  fileName: string,
): Promise<void> {
  const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
  const exporter = new OBJExporter();
  const result = exporter.parse(scene);
  const blob = new Blob([result], { type: 'text/plain' });
  downloadBlob(blob, `${fileName || '3d-export'}.obj`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import { ASPECT_RATIOS, EXPORT_RESOLUTIONS } from '@/stores/studio3dStore';
import type { ShaderSettings } from '@/utils/shaders/shaderRenderer';
import { applyShaderToCanvas } from '@/utils/shaders/applyShaderToCanvas';
import type { Scene } from 'three';

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
  const blob = await new Promise<Blob>((resolve, reject) => {
    offscreen.toBlob((b) => b ? resolve(b) : reject(new Error('Failed to create PNG blob')), 'image/png');
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
      } catch {
        // skip frame on shader failure — non-fatal for video recording
      }
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

  return new Promise((resolve, reject) => {
    recorder.onerror = () => {
      if (shaderAnimId) cancelAnimationFrame(shaderAnimId);
      reject(new Error('Video recording failed'));
    };

    recorder.onstop = () => {
      if (shaderAnimId) cancelAnimationFrame(shaderAnimId);
      if (chunks.length === 0) {
        reject(new Error('No video frames captured'));
        return;
      }
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
  if (!scene.children.length) throw new Error('Scene is empty — nothing to export');
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
  if (!scene.children.length) throw new Error('Scene is empty — nothing to export');
  const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
  const exporter = new OBJExporter();
  const result = exporter.parse(scene);
  if (!result || result.trim().length === 0) throw new Error('OBJ export produced empty output');
  const blob = new Blob([result], { type: 'text/plain' });
  downloadBlob(blob, `${fileName || '3d-export'}.obj`);
}

export async function exportBatchViews(
  canvas: HTMLCanvasElement,
  aspectRatio: AspectRatio,
  resolution: ExportResolution,
  transparentBg: boolean,
  bgColor: string,
  fileName: string,
  setCameraView: (view: string) => void,
  shader?: ShaderSettings,
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const views = ['front', 'right', 'top', 'back', 'iso'];

  for (const view of views) {
    await setCameraView(view);
    await new Promise((r) => setTimeout(r, 300));
    let offscreen = getExportCanvas(canvas, aspectRatio, resolution, transparentBg, bgColor);
    if (shader) offscreen = await applyShaderToCanvas(offscreen, shader);
    const blob = await new Promise<Blob>((resolve, reject) => {
      offscreen.toBlob((b) => b ? resolve(b) : reject(new Error('Failed')), 'image/png');
    });
    zip.file(`${fileName || '3d-export'}-${view}.png`, blob);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `${fileName || '3d-export'}-views.zip`);
}

export async function exportTurntable(
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
      } catch { /* non-fatal */ }
      shaderAnimId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    captureSource = shaderCanvas;
  }

  const stream = captureSource.captureStream(60);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onerror = () => {
      if (shaderAnimId) cancelAnimationFrame(shaderAnimId);
      reject(new Error('Turntable recording failed'));
    };
    recorder.onstop = () => {
      if (shaderAnimId) cancelAnimationFrame(shaderAnimId);
      if (chunks.length === 0) { reject(new Error('No frames captured')); return; }
      const blob = new Blob(chunks, { type: 'video/webm' });
      downloadBlob(blob, `${fileName || '3d-export'}-turntable.webm`);
      resolve();
    };
    recorder.start(100);
    const totalMs = duration * 1000;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(elapsed / totalMs, 1));
      if (elapsed >= totalMs) { clearInterval(interval); recorder.stop(); }
    }, 100);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

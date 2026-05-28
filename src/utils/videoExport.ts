import { API_BASE } from '@/config/api';

export type VideoFormat = 'mp4' | 'gif' | 'webm';

export interface SeekRenderExportOptions {
  video: HTMLVideoElement;
  renderFrame: (video: HTMLVideoElement) => Promise<void> | void;
  canvas: HTMLCanvasElement;
  format: VideoFormat;
  fps?: number;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

const BATCH_SIZE = 30;
const FRAME_QUALITY = 0.92; // JPEG quality — much smaller than PNG, good enough for video frames
const MAX_CONCURRENT_UPLOADS = 2;

function seekToTime(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.001) { resolve(); return; }
    const timeout = setTimeout(() => reject(new Error('Seek timeout')), 5000);
    video.addEventListener('seeked', () => { clearTimeout(timeout); resolve(); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Seek failed')); }, { once: true });
    video.currentTime = time;
  });
}

async function canvasToArrayBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error('Canvas capture failed'))),
      'image/jpeg',
      FRAME_QUALITY,
    );
  });
}

export async function exportVideoServerSide({
  video,
  renderFrame,
  canvas,
  format,
  fps = 30,
  onProgress,
  signal,
}: SeekRenderExportOptions): Promise<Blob> {
  const wasPaused = video.paused;
  if (!wasPaused) video.pause();

  const duration = video.duration;
  const totalFrames = Math.ceil(duration * fps);
  const frameInterval = 1 / fps;

  try {
    // 1. Start render job
    const startRes = await fetch(`${API_BASE}/render/start`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: canvas.width, height: canvas.height }),
      signal,
    });
    if (!startRes.ok) throw new Error(`Server error: ${startRes.status}`);
    const { jobId } = await startRes.json();

    // 2. Extract + upload with pipeline overlap
    let batch: ArrayBuffer[] = [];
    let batchStart = 0;
    const uploadQueue: Promise<void>[] = [];

    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');

      const time = Math.min(i * frameInterval, duration - 0.001);
      await seekToTime(video, time);
      await new Promise(r => requestAnimationFrame(r));
      await renderFrame(video);

      const buf = await canvasToArrayBuffer(canvas);
      batch.push(buf);

      if (batch.length >= BATCH_SIZE || i === totalFrames - 1) {
        // Wait if too many concurrent uploads
        while (uploadQueue.length >= MAX_CONCURRENT_UPLOADS) {
          await Promise.race(uploadQueue);
          // Remove settled promises
          for (let j = uploadQueue.length - 1; j >= 0; j--) {
            const settled = await Promise.race([uploadQueue[j].then(() => true), Promise.resolve(false)]);
            if (settled) uploadQueue.splice(j, 1);
          }
        }

        const batchToSend = batch;
        const startIdx = batchStart;
        const upload = sendFrameBatch(jobId, batchToSend, startIdx, signal);
        uploadQueue.push(upload);

        batchStart += batch.length;
        batch = [];
      }

      onProgress?.(((i + 1) / totalFrames) * 75);
    }

    // Wait for remaining uploads
    await Promise.all(uploadQueue);
    onProgress?.(80);

    // 3. Trigger encoding
    const finishRes = await fetch(`${API_BASE}/render/${jobId}/finish`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, fps }),
      signal,
    });
    if (!finishRes.ok) {
      const err = await finishRes.json().catch(() => ({}));
      throw new Error(err.error || `Encoding failed: ${finishRes.status}`);
    }

    onProgress?.(100);
    return await finishRes.blob();
  } finally {
    if (!wasPaused) video.play();
  }
}

async function sendFrameBatch(
  jobId: string,
  frames: ArrayBuffer[],
  startIndex: number,
  signal?: AbortSignal,
): Promise<void> {
  let totalSize = 0;
  for (const f of frames) totalSize += 4 + f.byteLength;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let offset = 0;

  for (const frame of frames) {
    view.setUint32(offset, frame.byteLength, true);
    offset += 4;
    bytes.set(new Uint8Array(frame), offset);
    offset += frame.byteLength;
  }

  const res = await fetch(`${API_BASE}/render/${jobId}/frames`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Frame-Start': String(startIndex),
    },
    body: buf,
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Frame upload failed: ${res.status}`);
  }
}

export async function checkServerRenderAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/render/health`, { credentials: 'include' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ffmpeg === true;
  } catch {
    return false;
  }
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, rm, readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

const MAX_FRAMES = 1800; // 60s @ 30fps
const MAX_DIMENSION = 3840;
const MAX_JOB_SIZE_BYTES = 500 * 1024 * 1024; // 500MB total frame data

export interface RenderJob {
  jobId: string;
  workDir: string;
  frameCount: number;
  width: number;
  height: number;
}

export function validateDimensions(width: number, height: number): string | null {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 'Invalid dimensions';
  if (width < 2 || height < 2) return 'Dimensions too small';
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) return `Max dimension is ${MAX_DIMENSION}px`;
  return null;
}

export function validateFormat(format: string): format is 'mp4' | 'gif' | 'webm' {
  return ['mp4', 'gif', 'webm'].includes(format);
}

export function validateFps(fps: number): string | null {
  if (!Number.isFinite(fps) || fps < 1 || fps > 60) return 'FPS must be 1-60';
  return null;
}

export async function createRenderJob(): Promise<RenderJob> {
  const jobId = randomUUID();
  const workDir = join(tmpdir(), 'visant-render', jobId);
  await mkdir(workDir, { recursive: true });
  return { jobId, workDir, frameCount: 0, width: 0, height: 0 };
}

export async function getJobDiskUsage(workDir: string): Promise<number> {
  try {
    const files = await readdir(workDir);
    let total = 0;
    for (const f of files) {
      const s = await stat(join(workDir, f));
      total += s.size;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function saveFrames(
  workDir: string,
  frames: Buffer[],
  startIndex: number,
): Promise<number> {
  if (startIndex + frames.length > MAX_FRAMES) {
    throw new Error(`Max ${MAX_FRAMES} frames allowed`);
  }

  const diskUsage = await getJobDiskUsage(workDir);
  const batchSize = frames.reduce((sum, f) => sum + f.length, 0);
  if (diskUsage + batchSize > MAX_JOB_SIZE_BYTES) {
    throw new Error('Job size limit exceeded');
  }

  await Promise.all(
    frames.map((buf, i) => {
      const idx = String(startIndex + i).padStart(6, '0');
      return writeFile(join(workDir, `frame_${idx}.jpg`), buf);
    }),
  );
  return frames.length;
}

function ensureEven(n: number): number {
  return n % 2 === 0 ? n : n + 1;
}

export async function encodeToMp4(
  workDir: string,
  fps: number,
  width: number,
  height: number,
): Promise<Buffer> {
  const outputPath = join(workDir, 'output.mp4');

  await execFileAsync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', join(workDir, 'frame_%06d.jpg'),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${ensureEven(width)}:${ensureEven(height)}`,
    '-movflags', '+faststart',
    '-threads', '0',
    outputPath,
  ], { maxBuffer: 50 * 1024 * 1024, timeout: 300_000 });

  return readFile(outputPath);
}

export async function encodeToGif(
  workDir: string,
  fps: number,
  width: number,
  height: number,
): Promise<Buffer> {
  const palettePath = join(workDir, 'palette.png');
  const outputPath = join(workDir, 'output.gif');

  const maxW = Math.min(width, 640);
  const scale = `scale=${maxW}:-1:flags=lanczos`;

  await execFileAsync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', join(workDir, 'frame_%06d.jpg'),
    '-vf', `${scale},palettegen=stats_mode=diff`,
    palettePath,
  ], { maxBuffer: 10 * 1024 * 1024, timeout: 120_000 });

  await execFileAsync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', join(workDir, 'frame_%06d.jpg'),
    '-i', palettePath,
    '-lavfi', `${scale} [x]; [x][1:v] paletteuse=dither=floyd_steinberg`,
    outputPath,
  ], { maxBuffer: 50 * 1024 * 1024, timeout: 300_000 });

  return readFile(outputPath);
}

export async function encodeToWebm(
  workDir: string,
  fps: number,
  width: number,
  height: number,
): Promise<Buffer> {
  const outputPath = join(workDir, 'output.webm');

  await execFileAsync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', join(workDir, 'frame_%06d.jpg'),
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '0',
    '-pix_fmt', 'yuv420p',
    '-vf', `scale=${ensureEven(width)}:${ensureEven(height)}`,
    '-threads', '0',
    outputPath,
  ], { maxBuffer: 50 * 1024 * 1024, timeout: 300_000 });

  return readFile(outputPath);
}

export async function cleanupJob(workDir: string): Promise<void> {
  try {
    await rm(workDir, { recursive: true, force: true });
  } catch {}
}

export async function probeFFmpeg(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version']);
    return true;
  } catch {
    return false;
  }
}

export function parseFrameBuffer(body: Buffer): Buffer[] {
  const frames: Buffer[] = [];
  let offset = 0;
  while (offset < body.length) {
    if (offset + 4 > body.length) break;
    const len = body.readUInt32LE(offset);
    offset += 4;
    if (len <= 0 || len > 10 * 1024 * 1024) break; // max 10MB per frame
    if (offset + len > body.length) break;
    frames.push(body.subarray(offset, offset + len));
    offset += len;
  }
  return frames;
}

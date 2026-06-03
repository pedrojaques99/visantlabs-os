/**
 * Background Removal Service
 *
 * Uses rembg (Python, U2-Net) via subprocess for high-quality edge detection.
 * Falls back to @imgly/background-removal-node if rembg is unavailable.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { uploadImage } from './r2Service.js';

const execFileAsync = promisify(execFile);

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
const REMBG_TIMEOUT_MS = 120_000;

import { validateImageUrl } from '../utils/validateImageUrl.js';

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  validateImageUrl(imageUrl);

  if (imageUrl.startsWith('data:')) {
    const b64 = imageUrl.split(',')[1];
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > MAX_IMAGE_BYTES)
      throw new Error(`Image too large (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    return buf;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES)
      throw new Error(`Image too large (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function removeWithRembg(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync('rembg', ['i', inputPath, outputPath], {
    timeout: REMBG_TIMEOUT_MS,
  });
}

async function removeWithImgly(inputBuf: Buffer): Promise<Buffer> {
  const { removeBackground } = await import('@imgly/background-removal-node');
  const blob = new Blob([inputBuf], { type: 'image/png' });
  const resultBlob = await removeBackground(blob, {
    output: { format: 'image/png', quality: 1 },
  });
  return Buffer.from(await resultBlob.arrayBuffer());
}

export interface RemoveBackgroundRequest {
  imageUrl: string;
  outputFormat?: 'png' | 'webp';
  model?: 'u2net' | 'isnet-general-use';
}

export interface RemoveBackgroundResult {
  imageUrl: string;
  format: string;
  engine: 'rembg' | 'imgly';
}

export async function removeBackgroundFromImage(
  req: RemoveBackgroundRequest,
  userId: string
): Promise<RemoveBackgroundResult> {
  const imageBuf = await fetchImageBuffer(req.imageUrl);
  const format = req.outputFormat || 'png';

  let resultBuf: Buffer;
  let engine: 'rembg' | 'imgly';

  const tempDir = await mkdtemp(join(tmpdir(), 'rembg-'));
  const inputPath = join(tempDir, 'input.png');
  const outputPath = join(tempDir, 'output.png');

  try {
    await writeFile(inputPath, imageBuf);
    await removeWithRembg(inputPath, outputPath);
    resultBuf = await readFile(outputPath);
    engine = 'rembg';
  } catch {
    resultBuf = await removeWithImgly(imageBuf);
    engine = 'imgly';
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    // rmdir temp dir (will be empty)
    const { rmdir } = await import('fs/promises');
    await rmdir(tempDir).catch(() => {});
  }

  const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
  const dataUrl = `data:${mimeType};base64,${resultBuf.toString('base64')}`;
  const publicUrl = await uploadImage(dataUrl, userId);

  return {
    imageUrl: publicUrl,
    format,
    engine,
  };
}

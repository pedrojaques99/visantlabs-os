import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { redisClient } from '../lib/redis.js';
import { uploadSharedAsset } from './r2Service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_SCRIPT = path.resolve(__dirname, '../scripts/psd-render-worker.ts');
const TMP_DIR = '/tmp/psd-renders';
const ACTIVE_KEY = 'psd-render:active';
const MAX_CONCURRENT = 1;
const RENDER_TIMEOUT_MS = 120_000;

interface RenderRequest {
  psdUrl: string;
  artUrl: string;
  smartObject: string;
  hideLayers?: string[];
  userId: string;
}

interface RenderResult {
  url: string;
  sizeBytes: number;
  durationMs: number;
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
}

function runBunWorker(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bun', [WORKER_SCRIPT, ...args], {
      timeout: RENDER_TIMEOUT_MS,
      env: {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    proc.on('error', reject);
  });
}

export async function renderPsdMockup(req: RenderRequest): Promise<RenderResult> {
  const activeCount = await redisClient.get(ACTIVE_KEY);
  if (activeCount && parseInt(activeCount, 10) >= MAX_CONCURRENT) {
    throw new Error('Render queue is full. Try again in a moment.');
  }

  await redisClient.incr(ACTIVE_KEY);
  await redisClient.expire(ACTIVE_KEY, 300);

  const jobId = randomUUID();
  const jobDir = path.join(TMP_DIR, jobId);
  mkdirSync(jobDir, { recursive: true });

  const psdLocal = path.join(jobDir, 'input.psd');
  const artLocal = path.join(jobDir, 'art.png');
  const outputLocal = path.join(jobDir, 'output.png');

  const start = Date.now();

  try {
    await Promise.all([
      downloadToFile(req.psdUrl, psdLocal),
      downloadToFile(req.artUrl, artLocal),
    ]);

    const args = [
      '--psd', psdLocal,
      '--art', artLocal,
      '--smart-object', req.smartObject,
      '--output', outputLocal,
    ];
    if (req.hideLayers?.length) {
      args.push('--hide', req.hideLayers.join(','));
    }

    const result = await runBunWorker(args);

    if (result.code !== 0) {
      const errMsg = result.stderr || result.stdout || 'Unknown render error';
      throw new Error(`Render failed (exit ${result.code}): ${errMsg}`);
    }

    if (!existsSync(outputLocal)) {
      throw new Error('Render completed but output file not found');
    }

    const pngBuffer = readFileSync(outputLocal);
    const r2Key = `psd-renders/${req.userId}/${jobId}.png`;
    const url = await uploadSharedAsset(pngBuffer, r2Key, 'image/png');

    return {
      url,
      sizeBytes: pngBuffer.length,
      durationMs: Date.now() - start,
    };
  } finally {
    await redisClient.decr(ACTIVE_KEY);
    cleanup(jobDir);
  }
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

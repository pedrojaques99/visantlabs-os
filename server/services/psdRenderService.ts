import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
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

function getDoSpacesClient(): S3Client | null {
  const key = process.env.DO_SPACES_KEY;
  const secret = process.env.DO_SPACES_SECRET;
  const endpoint = process.env.DO_SPACES_ENDPOINT;
  if (!key || !secret || !endpoint) return null;
  return new S3Client({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: false,
  });
}

function parseSpacesUrl(url: string): { bucket: string; key: string } | null {
  const patterns = [
    /https?:\/\/([^.]+)\.[^.]+\.cdn\.digitaloceanspaces\.com\/(.+)/,
    /https?:\/\/([^.]+)\.[^.]+\.digitaloceanspaces\.com\/(.+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { bucket: match[1], key: decodeURIComponent(match[2]) };
  }

  const cdnUrl = process.env.DO_SPACES_CDN_URL;
  if (cdnUrl && url.startsWith(cdnUrl)) {
    const bucket = process.env.DO_SPACES_BUCKET;
    if (!bucket) return null;
    const key = url.slice(cdnUrl.length).replace(/^\//, '');
    return { bucket, key: decodeURIComponent(key) };
  }

  return null;
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const spacesInfo = parseSpacesUrl(url);
  if (spacesInfo) {
    const client = getDoSpacesClient();
    if (!client) throw new Error('Digital Ocean Spaces credentials not configured');
    const resp = await client.send(new GetObjectCommand({
      Bucket: spacesInfo.bucket,
      Key: spacesInfo.key,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadPsd(url: string, destPath: string): Promise<void> {
  const buffer = await downloadBuffer(url);

  if (url.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(buffer);
    const psdEntry = Object.values(zip.files).find(
      (f) => !f.dir && f.name.toLowerCase().endsWith('.psd') && !f.name.startsWith('__MACOSX')
    );
    if (!psdEntry) throw new Error('No .psd file found inside ZIP');
    const psdBuffer = await psdEntry.async('nodebuffer');
    writeFileSync(destPath, psdBuffer);
    return;
  }

  writeFileSync(destPath, buffer);
}

async function downloadArt(url: string, destPath: string): Promise<void> {
  const buffer = await downloadBuffer(url);
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
      downloadPsd(req.psdUrl, psdLocal),
      downloadArt(req.artUrl, artLocal),
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

import { spawn } from 'child_process';
import { stripDataUriPrefix } from '../lib/dataUri.js';
import { randomUUID } from 'crypto';
import { existsSync, writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import { redisClient } from '../lib/redis.js';
import { uploadSharedAsset } from './r2Service.js';
import { getCachedOrDownload, isDriveConfigured, allFolderIds, publicFolderIds } from './driveService.js';
import { uploadPublicAsset, isSpacesConfigured } from './spacesService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKER_SCRIPT = path.resolve(__dirname, '../scripts/psd-render-worker.ts');
const WORKER_SCRIPT_AGPSD = path.resolve(__dirname, '../scripts/psd-render-worker-agpsd.ts');
const TMP_DIR = '/tmp/psd-renders';
const ACTIVE_KEY = 'psd-render:active';
// Engine: 'agpsd' (ag-psd + canvas, rápido, sem Chromium — default) ou 'photopea' (legado)
const RENDER_ENGINE = process.env.PSD_RENDER_ENGINE || 'agpsd';
// ag-psd é leve (sem Chromium) — aguenta mais concorrência que o Photopea
const MAX_CONCURRENT = parseInt(
  process.env.PSD_RENDER_MAX_CONCURRENT || (RENDER_ENGINE === 'agpsd' ? '2' : '1'),
  10
);
const RENDER_TIMEOUT_MS = 120_000;

export interface RenderArt {
  /** Nome do smart object alvo. Ausente ou "*" = aplica em todas as faces editáveis. */
  smartObject?: string;
  artUrl?: string;
  artBase64?: string;
}

interface RenderRequest {
  /** URL http(s) do PSD (DO Spaces, zip suportado) — OU psdFileName via Google Drive. */
  psdUrl?: string;
  /** Nome do arquivo no Google Drive (ex.: "HM_BANNER_002.psd") — usa cache LRU em /tmp. */
  psdFileName?: string;
  /** Multi-face: uma arte por smart object. */
  arts?: RenderArt[];
  /** Legado: arte única. */
  artUrl?: string;
  smartObject?: string;
  hideLayers?: string[];
  /** true = JPEG ~1400px (rápido); false/ausente = PNG full-res. */
  preview?: boolean | number;
  userId: string;
  /**
   * 'all' (admin/team) = biblioteca inteira + psdUrl arbitrária.
   * 'public' (user normal) = só PSDs dentro de GOOGLE_DRIVE_PUBLIC_FOLDER_IDS (BOXY).
   */
  accessTier: 'all' | 'public';
}

interface RenderResult {
  url: string;
  sizeBytes: number;
  durationMs: number;
  engine: string;
  replaced?: string[];
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
    /^https?:\/\/([^.]+)\.[^.]+\.cdn\.digitaloceanspaces\.com\/([^?#]+)/,
    /^https?:\/\/([^.]+)\.[^.]+\.digitaloceanspaces\.com\/([^?#]+)/,
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
  // Try public fetch first (works for CDN-enabled DO Spaces buckets)
  const res = await fetch(url);
  if (res.ok) return Buffer.from(await res.arrayBuffer());

  // If 403, try S3 credentials for private buckets
  if (res.status === 403) {
    const spacesInfo = parseSpacesUrl(url);
    if (spacesInfo) {
      const client = getDoSpacesClient();
      if (!client) throw new Error('Digital Ocean Spaces credentials not configured');
      const resp = await client.send(
        new GetObjectCommand({
          Bucket: spacesInfo.bucket,
          Key: spacesInfo.key,
        })
      );
      const chunks: Uint8Array[] = [];
      for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
  }

  throw new Error(`Failed to download ${url}: ${res.status}`);
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

function runBunWorker(script: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bun', [script, ...args], {
      timeout: RENDER_TIMEOUT_MS,
      env: {
        ...process.env,
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    proc.on('error', reject);
  });
}

/** Upload do resultado: DO Spaces (BOXY, sem custo novo) com fallback pro R2. */
async function uploadRenderOutput(buffer: Buffer, key: string, contentType: string): Promise<string> {
  if (isSpacesConfigured()) {
    return uploadPublicAsset(buffer, key, contentType);
  }
  return uploadSharedAsset(buffer, key, contentType);
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

  const outputLocal = path.join(jobDir, 'output.png');
  const start = Date.now();

  try {
    // ── 1. PSD: Drive (cache LRU, fica fora do jobDir) ou URL ─────────────
    let psdLocal: string;
    if (req.psdFileName) {
      if (!isDriveConfigured()) {
        throw new Error('psdFileName requer GOOGLE_SERVICE_ACCOUNT_KEY configurada');
      }
      // Tier público só enxerga as pastas BOXY; team/admin enxerga todas
      let folderScope: string[];
      if (req.accessTier === 'all') {
        folderScope = allFolderIds();
      } else {
        folderScope = publicFolderIds();
        if (!folderScope.length) {
          throw new Error('Mockups públicos indisponíveis (GOOGLE_DRIVE_PUBLIC_FOLDER_IDS não configurada)');
        }
      }
      console.log(`[psd-render] Job ${jobId}: resolvendo "${req.psdFileName}" via Drive (tier ${req.accessTier})...`);
      psdLocal = await getCachedOrDownload(req.psdFileName, folderScope);
    } else if (req.psdUrl) {
      if (req.accessTier !== 'all') {
        throw new Error('psdUrl arbitrária é restrita à equipe — use psdFileName');
      }
      psdLocal = path.join(jobDir, 'input.psd');
      console.log(`[psd-render] Job ${jobId}: baixando PSD...`);
      await downloadPsd(req.psdUrl, psdLocal);
    } else {
      throw new Error('Informe psdUrl ou psdFileName');
    }

    // ── 2. Artes (multi-face ou legado) ────────────────────────────────────
    const arts: RenderArt[] =
      req.arts?.length ? req.arts : [{ smartObject: req.smartObject, artUrl: req.artUrl }];

    const replacements: Array<{ smartObject?: string; artPath: string }> = [];
    for (const [i, art] of arts.entries()) {
      const artPath = path.join(jobDir, `art-${i}.png`);
      if (art.artBase64) {
        writeFileSync(artPath, Buffer.from(stripDataUriPrefix(art.artBase64), 'base64'));
      } else if (art.artUrl) {
        await downloadArt(art.artUrl, artPath);
      } else {
        throw new Error(`arts[${i}] precisa de artUrl ou artBase64`);
      }
      replacements.push({ smartObject: art.smartObject, artPath });
    }

    // ── 3. Render (engine selecionável) ────────────────────────────────────
    console.log(`[psd-render] Job ${jobId}: render via ${RENDER_ENGINE}...`);
    let replaced: string[] | undefined;

    if (RENDER_ENGINE === 'photopea') {
      // Engine legado (Chromium) — só arte única
      const first = replacements[0];
      const args = [
        '--psd', psdLocal,
        '--art', first.artPath,
        '--smart-object', first.smartObject || 'Your design',
        '--output', outputLocal,
      ];
      if (req.hideLayers?.length) args.push('--hide', req.hideLayers.join(','));
      const result = await runBunWorker(WORKER_SCRIPT, args);
      if (result.code !== 0) {
        throw new Error(`Render failed (exit ${result.code}): ${result.stderr || result.stdout || 'Unknown error'}`);
      }
    } else {
      // ag-psd (default): compositor portado do mockup-store, multi-face
      const previewMaxPx = req.preview ? (typeof req.preview === 'number' ? req.preview : 1400) : 0;
      const jobFile = path.join(jobDir, 'job.json');
      writeFileSync(jobFile, JSON.stringify({
        psdPath: psdLocal,
        outputPath: outputLocal,
        replacements,
        hideLayers: req.hideLayers || [],
        previewMaxPx,
      }));
      const result = await runBunWorker(WORKER_SCRIPT_AGPSD, ['--job', jobFile]);
      if (result.code !== 0) {
        throw new Error(`Render failed (exit ${result.code}): ${result.stderr || result.stdout || 'Unknown error'}`);
      }
      try {
        const lines = result.stdout.trim().split('\n');
        replaced = JSON.parse(lines[lines.length - 1]).replaced;
      } catch {}
    }

    if (!existsSync(outputLocal)) {
      throw new Error('Render completed but output file not found');
    }

    // ── 4. Upload (Spaces da BOXY → fallback R2) ───────────────────────────
    const outBuffer = readFileSync(outputLocal);
    const isJpeg = outBuffer[0] === 0xff && outBuffer[1] === 0xd8;
    const key = `psd-renders/${req.userId}/${jobId}.${isJpeg ? 'jpg' : 'png'}`;
    const url = await uploadRenderOutput(outBuffer, key, isJpeg ? 'image/jpeg' : 'image/png');

    return {
      url,
      sizeBytes: outBuffer.length,
      durationMs: Date.now() - start,
      engine: RENDER_ENGINE,
      replaced,
    };
  } finally {
    await redisClient.decr(ACTIVE_KEY);
    cleanup(jobDir); // não toca no cache do Drive (fora do jobDir)
  }
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

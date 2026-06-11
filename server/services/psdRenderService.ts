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
import {
  getSceneRecord,
  downloadSceneAssets,
  type SceneRecord,
} from './sceneStore.js';

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
  /** true = pula o fast path de Scene Package e força abrir o PSD (escape hatch). */
  forcePsd?: boolean;
}

interface RenderResult {
  url: string;
  sizeBytes: number;
  durationMs: number;
  engine: string;
  replaced?: string[];
}

const SCENE_CACHE_DIR = '/tmp/scene-cache';

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
    // ── 0. Fast path: Scene Package (render no engine, RAM mínima) ─────────
    // Só pra psdFileName (Drive), sem forcePsd, com scene registrada no Mongo.
    // Qualquer erro aqui → log warn + fallback transparente pro pipeline PSD.
    if (req.psdFileName && req.forcePsd !== true) {
      try {
        const sceneResult = await tryRenderFromScene(req, jobId);
        if (sceneResult) {
          return {
            url: sceneResult.url,
            sizeBytes: sceneResult.sizeBytes,
            durationMs: Date.now() - start,
            engine: 'scene',
            replaced: sceneResult.replaced,
          };
        }
      } catch (err: any) {
        console.warn(`[psd-render] Job ${jobId}: scene fast path falhou, fallback PSD:`, err.message || err);
      }
    }

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

/**
 * Tenta renderizar via Scene Package. Retorna null se não houver scene pro PSD
 * (o caller cai pro pipeline PSD). Lança em erro real de render (caller faz warn+fallback).
 *
 * Reusa o MESMO caminho de upload do pipeline atual (uploadRenderOutput) e o mesmo
 * tratamento de arte (artBase64/artUrl), com cache local dos assets em /tmp.
 */
async function tryRenderFromScene(
  req: RenderRequest,
  jobId: string
): Promise<{ url: string; sizeBytes: number; replaced: string[] } | null> {
  if (!isSpacesConfigured()) return null;

  // getDb exige connectToMongoDB; chama defensivamente (idempotente).
  const { connectToMongoDB, getDb } = await import('../db/mongodb.js');
  await connectToMongoDB();
  const db = getDb();

  const record: SceneRecord | null = await getSceneRecord(db, req.psdFileName!);
  if (!record) return null;

  console.log(`[psd-render] Job ${jobId}: scene hit pra "${req.psdFileName}" — render via engine.`);

  const { createNodeAdapter } = await import('@visantlabs/psd-engine/adapters/node');
  const { renderScene } = await import('@visantlabs/psd-engine/scene');
  const adapter = await createNodeAdapter();

  // 1. Carrega as imagens das camadas (cache local em /tmp por hash da scene).
  mkdirSync(SCENE_CACHE_DIR, { recursive: true });
  const cacheDir = path.join(SCENE_CACHE_DIR, record.hash);
  mkdirSync(cacheDir, { recursive: true });

  const assetBuffers: Record<string, Buffer> = {};
  let needDownload = false;
  for (const f of record.files) {
    const local = path.join(cacheDir, `${f.ref}.bin`);
    if (existsSync(local)) {
      assetBuffers[f.ref] = readFileSync(local);
    } else {
      needDownload = true;
    }
  }
  if (needDownload) {
    const fresh = await downloadSceneAssets(record);
    for (const [ref, buf] of Object.entries(fresh)) {
      writeFileSync(path.join(cacheDir, `${ref}.bin`), buf);
      assetBuffers[ref] = buf;
    }
  }

  const assets: Record<string, any> = {};
  for (const [ref, buf] of Object.entries(assetBuffers)) {
    assets[ref] = await adapter.loadImage(buf);
  }

  // 2. Resolve as artes (mesmo tratamento do pipeline: artBase64 | artUrl).
  const artInputs: RenderArt[] =
    req.arts?.length ? req.arts : [{ smartObject: req.smartObject, artUrl: req.artUrl }];

  // Carrega cada arte uma vez.
  const loadedArts: Array<{ smartObject?: string; img: any }> = [];
  for (const a of artInputs) {
    let buf: Buffer;
    if (a.artBase64) {
      buf = Buffer.from(stripDataUriPrefix(a.artBase64), 'base64');
    } else if (a.artUrl) {
      buf = await downloadBuffer(a.artUrl);
    } else {
      throw new Error('arte sem artUrl/artBase64 no fast path');
    }
    loadedArts.push({ smartObject: a.smartObject, img: await adapter.loadImage(buf) });
  }

  // Mapeia arte → face.key. smartObject ausente/"*" = defaultArt (todas as faces).
  const artMap: Record<string, any> = {};
  let defaultArt: any;
  const replaced: string[] = [];
  for (const { smartObject, img } of loadedArts) {
    if (!smartObject || smartObject === '*') {
      defaultArt = img;
      for (const face of record.doc.faces) replaced.push(face.name);
      continue;
    }
    const target = smartObject.toLowerCase();
    const face =
      record.doc.faces.find((f) => f.key === smartObject) ||
      record.doc.faces.find((f) => f.name.toLowerCase() === target) ||
      record.doc.faces.find((f) => f.name.toLowerCase().includes(target));
    if (face) {
      artMap[face.key] = img;
      replaced.push(face.name);
    }
  }
  if (!defaultArt && Object.keys(artMap).length === 0) {
    throw new Error('nenhuma face da scene casou com a(s) arte(s) fornecida(s)');
  }

  // 3. Render isomórfico.
  const canvas = renderScene(record.doc, assets, artMap, adapter.createCanvas, { defaultArt });

  // 4. Encode (preview → JPEG; senão PNG) + upload pelo MESMO caminho atual.
  const previewMaxPx = req.preview ? (typeof req.preview === 'number' ? req.preview : 1400) : 0;
  let outCanvas = canvas;
  if (previewMaxPx > 0) {
    const scale = previewMaxPx / Math.max(record.doc.width, record.doc.height);
    if (scale < 1) {
      outCanvas = adapter.createCanvas(
        Math.round(record.doc.width * scale),
        Math.round(record.doc.height * scale)
      );
      outCanvas.getContext('2d').drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
    }
  }
  const isJpeg = previewMaxPx > 0;
  const outBuffer: Buffer = isJpeg
    ? adapter.toBuffer(outCanvas, 'image/jpeg', { quality: 0.8 })
    : adapter.toBuffer(outCanvas, 'image/png');

  const key = `psd-renders/${req.userId}/${jobId}.${isJpeg ? 'jpg' : 'png'}`;
  const url = await uploadRenderOutput(outBuffer, key, isJpeg ? 'image/jpeg' : 'image/png');

  return { url, sizeBytes: outBuffer.length, replaced };
}

function cleanup(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
}

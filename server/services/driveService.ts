/**
 * Google Drive — download de PSDs sob demanda com cache LRU em /tmp.
 * Os PSDs ficam no Drive (grátis); o VPS baixa só quando precisa e mantém
 * um cache limitado. Plano original: boxy-app/MOCKUP-STORE-PLAN.md (Phase 2).
 *
 * Auth (em ordem de preferência):
 *   1. GOOGLE_DRIVE_REFRESH_TOKEN — reaproveita o GOOGLE_CLIENT_ID/SECRET que
 *      já existe no Coolify (login Google do app). Gere o token uma vez com:
 *      `bun server/scripts/drive-auth-helper.ts`. Acessa o Drive como a SUA
 *      conta — sem compartilhar pastas com ninguém.
 *   2. GOOGLE_SERVICE_ACCOUNT_KEY — JSON de service account (compartilhar as
 *      pastas do Drive com o e-mail dele, permissão Viewer).
 *
 * Outras envs:
 *   GOOGLE_DRIVE_FOLDER_IDS     opcional, restringe a busca a essas pastas
 *   PSD_CACHE_DIR               default /tmp/psd-cache
 *   PSD_CACHE_MAX_GB            default 5
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, utimesSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { pipeline } from 'stream/promises';

const CACHE_DIR = process.env.PSD_CACHE_DIR || '/tmp/psd-cache';
const CACHE_MAX_BYTES = parseFloat(process.env.PSD_CACHE_MAX_GB || '5') * 1e9;

interface DriveFile {
  id: string;
  name: string;
  size?: number;
}

let driveClient: any = null;

async function getDrive(): Promise<any> {
  if (driveClient) return driveClient;
  const { google } = await import('googleapis');

  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (refreshToken && clientId && clientSecret) {
    // Mesma credencial OAuth do login Google do app + refresh token da sua conta
    if (!process.env.GOOGLE_DRIVE_FOLDER_IDS) {
      console.warn(
        '[drive] AVISO: refresh token sem GOOGLE_DRIVE_FOLDER_IDS — o render pode acessar QUALQUER arquivo da conta. Configure os IDs das pastas de mockup.'
      );
    }
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    driveClient = google.drive({ version: 'v3', auth: oauth2 });
    return driveClient;
  }

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    driveClient = google.drive({ version: 'v3', auth });
    return driveClient;
  }

  throw new Error(
    'Drive não configurado — defina GOOGLE_DRIVE_REFRESH_TOKEN (use server/scripts/drive-auth-helper.ts) ou GOOGLE_SERVICE_ACCOUNT_KEY'
  );
}

export function allFolderIds(): string[] {
  return (process.env.GOOGLE_DRIVE_FOLDER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pastas públicas (mockups BOXY) — o que users normais podem renderizar. */
export function publicFolderIds(): string[] {
  return (process.env.GOOGLE_DRIVE_PUBLIC_FOLDER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// `${fileId}:${folderSet}` → está dentro de uma pasta permitida? (cache do veredito)
const ancestryCache = new Map<string, boolean>();

/**
 * Sobe a cadeia de parents até achar uma pasta permitida (subpastas valem).
 * Com refresh token o servidor enxerga a conta INTEIRA — sem esse escopo,
 * qualquer psdFileName do Drive seria renderizável.
 */
async function isInsideAllowedFolder(fileId: string, allowed: string[]): Promise<boolean> {
  if (!allowed.length) return true; // sem restrição configurada

  const cacheKey = `${fileId}:${allowed.join(',')}`;
  const cached = ancestryCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const drive = await getDrive();
  let frontier = [fileId];
  for (let depth = 0; depth < 12 && frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (allowed.includes(id)) {
        ancestryCache.set(cacheKey, true);
        return true;
      }
      try {
        const res = await drive.files.get({
          fileId: id,
          fields: 'parents',
          supportsAllDrives: true,
        });
        next.push(...(res.data.parents || []));
      } catch {}
    }
    frontier = Array.from(new Set(next));
  }
  ancestryCache.set(cacheKey, false);
  return false;
}

/** Acha um arquivo pelo nome exato, restrito ao conjunto de pastas dado (default: todas as permitidas). */
export async function findFileByName(fileName: string, folderScope?: string[]): Promise<DriveFile | null> {
  const drive = await getDrive();
  const escaped = fileName.replace(/['\\]/g, '\\$&');
  const allowed = folderScope ?? allFolderIds();

  const res = await drive.files.list({
    q: `name = '${escaped}' and trashed = false`,
    fields: 'files(id, name, size)',
    pageSize: 10,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files: DriveFile[] = (res.data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: f.size ? parseInt(f.size, 10) : undefined,
  }));
  if (!files.length) return null;

  // Vários homônimos (cópias de pasta) → maior primeiro (provável original),
  // ficando com o primeiro que passar no escopo de pasta
  const bySize = files.sort((a, b) => (b.size || 0) - (a.size || 0));
  for (const f of bySize) {
    if (await isInsideAllowedFolder(f.id, allowed)) return f;
  }
  console.warn(`[drive] "${fileName}" existe mas fora do escopo de pastas permitido`);
  return null;
}

function safeCacheName(fileName: string): string {
  return fileName
    .replace(/[^\w.\- À-ɏ]+/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\./, '_');
}

const activeDownloads = new Map<string, Promise<void>>();

async function downloadToCache(file: DriveFile, destPath: string): Promise<void> {
  const existing = activeDownloads.get(destPath);
  if (existing) return existing;

  const promise = (async () => {
    const tmpPath = `${destPath}.${randomBytes(4).toString('hex')}.part`;
    try {
      const drive = await getDrive();
      const res = await drive.files.get(
        { fileId: file.id, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      await pipeline(res.data, createWriteStream(tmpPath));
      rmSync(destPath, { force: true });
      const { renameSync } = await import('fs');
      renameSync(tmpPath, destPath);
    } finally {
      activeDownloads.delete(destPath);
      rmSync(tmpPath, { force: true });
    }
  })();

  activeDownloads.set(destPath, promise);
  return promise;
}

/** Evict LRU até o cache caber em CACHE_MAX_BYTES. */
function evictLru(): void {
  try {
    if (!existsSync(CACHE_DIR)) return;
    const entries = readdirSync(CACHE_DIR)
      .filter((f) => !f.endsWith('.part'))
      .map((f) => {
        const p = path.join(CACHE_DIR, f);
        const s = statSync(p);
        return { path: p, size: s.size, atime: s.atimeMs || s.mtimeMs };
      })
      .sort((a, b) => a.atime - b.atime); // mais antigo primeiro

    let total = entries.reduce((sum, e) => sum + e.size, 0);
    for (const e of entries) {
      if (total <= CACHE_MAX_BYTES) break;
      rmSync(e.path, { force: true });
      total -= e.size;
      console.log(`[drive-cache] evicted ${path.basename(e.path)} (${(e.size / 1e6).toFixed(0)}MB)`);
    }
  } catch (err) {
    console.warn('[drive-cache] evict error:', err);
  }
}

/**
 * Caminho local do PSD: cache hit → retorna na hora; miss → busca no Drive,
 * baixa pro cache e retorna. `folderScope` restringe a quais pastas o arquivo
 * pode pertencer (tier do usuário). Lança erro se não existir/estiver fora do escopo.
 */
export async function getCachedOrDownload(fileName: string, folderScope?: string[]): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, safeCacheName(fileName));

  // Mesmo com cache hit, o escopo precisa valer — o arquivo pode ter sido
  // baixado antes por um user de tier maior.
  const file = await findFileByName(fileName, folderScope);
  if (!file) throw new Error(`PSD não encontrado (ou fora do seu acesso): ${fileName}`);

  if (existsSync(cachePath)) {
    // touch atime pro LRU
    const now = new Date();
    try { utimesSync(cachePath, now, statSync(cachePath).mtime); } catch {}
    console.log(`[drive-cache] hit: ${fileName}`);
    return cachePath;
  }

  console.log(`[drive-cache] miss: baixando ${fileName} (${((file.size || 0) / 1e6).toFixed(0)}MB)...`);
  await downloadToCache(file, cachePath);
  evictLru();
  return cachePath;
}

export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    (process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET)
  );
}

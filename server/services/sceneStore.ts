/**
 * Scene Package store — SSoT pra extração, persistência e leitura de Scene
 * Packages (o desbloqueio de RAM/UX do plano PSD-ENGINE-SSOT).
 *
 * Um Scene Package é o resultado de pré-processar um PSD UMA vez:
 *   - scene.json  (geometria das faces + ordem/blend das camadas flatten)
 *   - imagens WebP das camadas (base abaixo das faces, over acima)
 *
 * Layout no Spaces (objetos PRIVADOS — servidos por signed URL com TTL):
 *   scenes/<hash>/scene.json
 *   scenes/<hash>/<ref>.webp
 *
 * Mongo collection `psd_scenes` (upsert por psdFileName):
 *   { psdFileName, hash, basePath, files[], faces, warnings, width, height, bytes, createdAt, updatedAt }
 *
 * Este módulo NÃO duplica download/upload — reusa driveService, spacesService e o
 * engine `@visant/psd-engine/scene`. É importado pelo script de extração, pelas
 * rotas e pelo fast path do /render.
 */
import { statSync } from 'fs';
import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { extractScene } from '@visant/psd-engine/scene';
import type { SceneDoc, AssetMap } from '@visant/psd-engine/scene';
import { createNodeAdapter, initializeAgPsdCanvas } from '@visant/psd-engine/adapters/node';
import {
  getCachedOrDownload,
  isDriveConfigured,
  allFolderIds,
  publicFolderIds,
} from './driveService.js';
import { uploadPrivateAsset, getSignedReadUrl, downloadAsset } from './spacesService.js';

export interface SceneFileEntry {
  /** ref usado no scene.json (ex.: "base-0", "over-1", "mask-0"). */
  ref: string;
  /** key completa no Spaces (ex.: "scenes/<hash>/base-0.webp"). */
  key: string;
  bytes: number;
}

export interface SceneRecord {
  psdFileName: string;
  hash: string;
  /** Prefixo no Spaces (ex.: "scenes/<hash>"). */
  basePath: string;
  /** scene.json serializado. */
  doc: SceneDoc;
  files: SceneFileEntry[];
  /** Resumo das faces (catálogo do agente/Boxy). */
  faces: Array<{ key: string; name: string; innerW: number; innerH: number }>;
  warnings: string[];
  width: number;
  height: number;
  bytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export const SCENES_COLLECTION = 'psd_scenes';

/** Hash determinístico do par (nome do PSD, mtime) — muda quando o PSD muda. */
export function sceneHash(psdFileName: string, mtimeMs: number): string {
  return createHash('sha256')
    .update(`${psdFileName}:${Math.floor(mtimeMs)}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * Resolve um PSD pra um caminho local. Reusa o cache LRU/Drive do driveService
 * (mesmo caminho do /render) ou aceita um path local direto (preprocessador CLI).
 *
 * @param ref          psdFileName (Drive) ou caminho de arquivo local.
 * @param accessTier   'all' (equipe) enxerga todas as pastas; 'public' só BOXY.
 */
export async function resolvePsdPath(
  ref: string,
  accessTier: 'all' | 'public' = 'all'
): Promise<string> {
  // Caminho local explícito (preprocessador rodando contra um arquivo no disco).
  if (/[\\/]/.test(ref)) {
    return ref;
  }
  if (!isDriveConfigured()) {
    throw new Error(
      'psdFileName requer Drive configurado (GOOGLE_SERVICE_ACCOUNT_KEY ou refresh token)'
    );
  }
  const folderScope = accessTier === 'all' ? allFolderIds() : publicFolderIds();
  if (accessTier !== 'all' && !folderScope.length) {
    throw new Error(
      'Mockups públicos indisponíveis (GOOGLE_DRIVE_PUBLIC_FOLDER_IDS não configurada)'
    );
  }
  return getCachedOrDownload(ref, folderScope);
}

/** Lê o PSD com ag-psd (skipCompositeImageData pra cortar RAM) + node-canvas. */
async function readPsdTree(psdPath: string): Promise<any> {
  const agPsd = await import('ag-psd');
  await initializeAgPsdCanvas(agPsd as any);
  const buf = await readFile(psdPath);
  return agPsd.readPsd(new Uint8Array(buf).buffer as ArrayBuffer, {
    skipThumbnail: true,
    skipCompositeImageData: true,
  });
}

/**
 * Serializa um canvas das camadas pra PNG.
 *
 * PNG (e não WebP) de propósito: o consumidor do fallback server é o node-canvas,
 * que não decodifica WebP — e converter com sharp NO MESMO processo do node-canvas
 * dispara o clash de símbolos libvips×Cairo/GLib no Debian (o "out of memory"
 * espúrio em Image.setSource que derrubou o fast path em produção). Browsers
 * decodificam PNG nativamente; o custo é só uns KB a mais por asset.
 */
async function encodeAsset(
  canvas: any
): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
  const png: Buffer = canvas.toBuffer('image/png');
  return { buffer: png, ext: 'png', contentType: 'image/png' };
}

export interface ExtractAndStoreResult {
  record: Omit<SceneRecord, 'createdAt' | 'updatedAt'>;
  /** Assets prontos pra upload: { ref, key, buffer, contentType }. */
  uploads: Array<{ ref: string; key: string; buffer: Buffer; contentType: string }>;
}

/**
 * Extrai um Scene Package de um PSD local: roda o engine, serializa as camadas e
 * monta o registro + lista de uploads (não sobe nada — o caller decide).
 */
export async function extractSceneFromPsd(
  psdPath: string,
  psdFileName: string
): Promise<ExtractAndStoreResult> {
  const mtimeMs = statSync(psdPath).mtimeMs;
  const hash = sceneHash(psdFileName, mtimeMs);
  const basePath = `scenes/${hash}`;

  const adapter = await createNodeAdapter();
  const psd = await readPsdTree(psdPath);
  const { doc, assets }: { doc: SceneDoc; assets: AssetMap } = extractScene(
    psd,
    adapter.createCanvas
  );

  const files: SceneFileEntry[] = [];
  const uploads: ExtractAndStoreResult['uploads'] = [];
  for (const [ref, canvas] of Object.entries(assets)) {
    const { buffer, ext, contentType } = await encodeAsset(canvas);
    const key = `${basePath}/${ref}.${ext}`;
    files.push({ ref, key, bytes: buffer.length });
    uploads.push({ ref, key, buffer, contentType });
  }

  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const record: Omit<SceneRecord, 'createdAt' | 'updatedAt'> = {
    psdFileName,
    hash,
    basePath,
    doc,
    files,
    faces: doc.faces.map((f) => ({ key: f.key, name: f.name, innerW: f.innerW, innerH: f.innerH })),
    warnings: doc.warnings,
    width: doc.width,
    height: doc.height,
    bytes: totalBytes,
  };

  return { record, uploads };
}

/** Sobe os assets (privados) do Scene Package pro Spaces. */
export async function uploadSceneAssets(uploads: ExtractAndStoreResult['uploads']): Promise<void> {
  for (const u of uploads) {
    await uploadPrivateAsset(u.buffer, u.key, u.contentType);
  }
}

/** Persiste/atualiza o registro do Scene no Mongo (upsert por psdFileName). */
export async function saveSceneRecord(
  db: any,
  record: Omit<SceneRecord, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const now = new Date();
  await db.collection(SCENES_COLLECTION).updateOne(
    { psdFileName: record.psdFileName },
    {
      $set: { ...record, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
}

export async function getSceneRecord(db: any, psdFileName: string): Promise<SceneRecord | null> {
  return db.collection(SCENES_COLLECTION).findOne({ psdFileName });
}

export async function deleteSceneRecord(db: any, psdFileName: string): Promise<boolean> {
  const res = await db.collection(SCENES_COLLECTION).deleteOne({ psdFileName });
  return res.deletedCount > 0;
}

/** Lista resumida pro catálogo (agente/Boxy). */
export async function listScenes(db: any): Promise<
  Array<{
    psdFileName: string;
    faces: SceneRecord['faces'];
    width: number;
    height: number;
    warnings: string[];
    updatedAt: Date;
  }>
> {
  return db
    .collection(SCENES_COLLECTION)
    .find(
      {},
      {
        projection: {
          _id: 0,
          psdFileName: 1,
          faces: 1,
          width: 1,
          height: 1,
          warnings: 1,
          updatedAt: 1,
        },
      }
    )
    .sort({ updatedAt: -1 })
    .toArray();
}

/**
 * Monta a resposta do GET /scenes/:file: o SceneDoc + signed URLs (TTL) das
 * imagens, mapeadas por ref pra o cliente carregar e renderizar.
 */
export async function signedSceneResponse(
  record: SceneRecord,
  ttlSeconds = 600
): Promise<{ doc: SceneDoc; assets: Record<string, string>; expiresInSeconds: number }> {
  const assets: Record<string, string> = {};
  for (const f of record.files) {
    assets[f.ref] = await getSignedReadUrl(f.key, ttlSeconds);
  }
  return { doc: record.doc, assets, expiresInSeconds: ttlSeconds };
}

/** Baixa todos os assets do Scene por key (fast path server). ref → Buffer. */
export async function downloadSceneAssets(record: SceneRecord): Promise<Record<string, Buffer>> {
  const out: Record<string, Buffer> = {};
  for (const f of record.files) {
    out[f.ref] = await downloadAsset(f.key);
  }
  return out;
}

import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, hashQuery } from '../lib/cache-utils.js';
import { uploadSharedAsset, isR2Configured } from './r2Service.js';
import { safeFetch } from '../utils/securityValidation.js';
import type { VisualSearchResult } from './visualSearchService.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface CropResult {
  id: string;
  letter: string;
  cropUrl: string;
  thumbnailUrl: string;
  style?: string;
  source: string;
  sourceImageUrl: string;
  dimensions: { width: number; height: number };
}

// ── Config ─────────────────────────────────────────────────────────────────

const CROP_SIZE = 800;
const THUMB_SIZE = 400;
const MAX_CONCURRENT = 5;
const MAX_PROCESS_PER_SEARCH = 12;

// ── Main Pipeline ──────────────────────────────────────────────────────────

export async function processLetterCrops(
  results: VisualSearchResult[],
  letter: string,
): Promise<CropResult[]> {
  if (!isR2Configured()) return [];

  const normalizedLetter = letter.toUpperCase();
  const candidates = results.slice(0, MAX_PROCESS_PER_SEARCH);

  const cached = await getCachedCrops(candidates, normalizedLetter);
  const uncached = candidates.filter(r => !cached.find(c => c.sourceImageUrl === r.imageUrl));

  const freshCrops = await processInBatches(uncached, normalizedLetter);

  return [...cached, ...freshCrops].filter(Boolean);
}

// ── Cache Layer ────────────────────────────────────────────────────────────

async function getCachedCrops(
  results: VisualSearchResult[],
  letter: string,
): Promise<CropResult[]> {
  const crops: CropResult[] = [];

  for (const r of results) {
    const cacheKey = CacheKey.letterCrop(letter, r.id);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      try { crops.push(JSON.parse(cached)); } catch { /* skip */ }
    }
  }

  if (crops.length < results.length) {
    const dbCrops = await prisma.letterCrop.findMany({
      where: {
        letter,
        sourceId: { in: results.map(r => r.id) },
      },
    }).catch(() => []);

    for (const db of dbCrops) {
      if (!crops.find(c => c.id === db.id)) {
        const crop: CropResult = {
          id: db.id,
          letter: db.letter,
          cropUrl: db.cropUrl,
          thumbnailUrl: db.thumbnailUrl,
          style: db.style ?? undefined,
          source: db.source,
          sourceImageUrl: db.sourceImageUrl,
          dimensions: db.dimensions as { width: number; height: number },
        };
        crops.push(crop);
        await redisClient.setex(
          CacheKey.letterCrop(letter, db.sourceId),
          CACHE_TTL.LETTER_CROP,
          JSON.stringify(crop),
        ).catch(() => {});
      }
    }
  }

  return crops;
}

// ── Processing ─────────────────────────────────────────────────────────────

async function processInBatches(
  results: VisualSearchResult[],
  letter: string,
): Promise<CropResult[]> {
  const crops: CropResult[] = [];

  for (let i = 0; i < results.length; i += MAX_CONCURRENT) {
    const batch = results.slice(i, i + MAX_CONCURRENT);
    const settled = await Promise.allSettled(
      batch.map(r => processOneImage(r, letter)),
    );
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) crops.push(s.value);
    }
  }

  return crops;
}

async function processOneImage(
  result: VisualSearchResult,
  letter: string,
): Promise<CropResult | null> {
  try {
    const imageBuffer = await downloadImage(result.imageUrl);
    if (!imageBuffer || imageBuffer.length < 1000) return null;

    const { default: sharp } = await import('sharp');
    const metadata = await sharp(imageBuffer).metadata();
    if (!metadata.width || !metadata.height) return null;

    const { cropBuffer, thumbBuffer, dimensions } = await cropAndNormalize(
      imageBuffer,
      metadata.width,
      metadata.height,
    );

    const hash = crypto.createHash('md5').update(imageBuffer).digest('hex').slice(0, 12);
    const cropKey = `crops/${letter}/${hash}-${CROP_SIZE}.png`;
    const thumbKey = `crops/${letter}/${hash}-${THUMB_SIZE}.png`;

    const [cropUrl, thumbnailUrl] = await Promise.all([
      uploadSharedAsset(cropBuffer, cropKey),
      uploadSharedAsset(thumbBuffer, thumbKey),
    ]);

    const style = detectStyle(result);

    const dbCrop = await prisma.letterCrop.upsert({
      where: { sourceId_letter: { sourceId: result.id, letter } },
      create: {
        sourceImageUrl: result.imageUrl,
        sourceId: result.id,
        letter,
        cropUrl,
        thumbnailUrl,
        style,
        source: result.source,
        tags: result.tags,
        dimensions,
      },
      update: { cropUrl, thumbnailUrl, style },
    });

    const crop: CropResult = {
      id: dbCrop.id,
      letter,
      cropUrl,
      thumbnailUrl,
      style,
      source: result.source,
      sourceImageUrl: result.imageUrl,
      dimensions,
    };

    await redisClient.setex(
      CacheKey.letterCrop(letter, result.id),
      CACHE_TTL.LETTER_CROP,
      JSON.stringify(crop),
    ).catch(() => {});

    return crop;
  } catch (err: any) {
    console.error(`[letterCrop] Failed to process ${result.id}:`, err.message);
    return null;
  }
}

// ── Image Processing (Sharp) ───────────────────────────────────────────────

async function cropAndNormalize(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<{ cropBuffer: Buffer; thumbBuffer: Buffer; dimensions: { width: number; height: number } }> {
  const size = Math.min(width, height);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);

  const { default: sharp } = await import('sharp');
  const cropped = sharp(buffer)
    .extract({ left, top, width: size, height: size });

  const [cropBuffer, thumbBuffer] = await Promise.all([
    cropped.clone().resize(CROP_SIZE, CROP_SIZE, { fit: 'inside', withoutEnlargement: true }).png({ quality: 90 }).toBuffer(),
    cropped.clone().resize(THUMB_SIZE, THUMB_SIZE, { fit: 'inside', withoutEnlargement: true }).png({ quality: 80 }).toBuffer(),
  ]);

  return {
    cropBuffer,
    thumbBuffer,
    dimensions: { width: CROP_SIZE, height: CROP_SIZE },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await safeFetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

function detectStyle(result: VisualSearchResult): string | undefined {
  const text = `${result.title} ${result.description || ''} ${result.tags.join(' ')}`.toLowerCase();

  const styles: [string, RegExp][] = [
    ['script', /\b(script|cursive|handwritten|caligraphy|caligrafia)\b/],
    ['serif', /\b(serif|roman|times|garamond|didot|bodoni)\b/],
    ['sans-serif', /\b(sans|gothic|helvetica|futura|grotesk|modernist)\b/],
    ['decorative', /\b(decorat|ornament|art.?nouveau|art.?deco|vintage|retro)\b/],
    ['blackletter', /\b(blackletter|fraktur|gothic|medieval|old.?english)\b/],
    ['monospace', /\b(mono|typewriter|code|terminal)\b/],
    ['display', /\b(display|poster|headline|bold|heavy|3d|neon)\b/],
  ];

  for (const [style, pattern] of styles) {
    if (pattern.test(text)) return style;
  }
  return undefined;
}

export async function getLibraryCrops(
  letter?: string,
  style?: string,
  limit = 50,
  offset = 0,
): Promise<{ crops: CropResult[]; total: number }> {
  const where: any = {};
  if (letter) where.letter = letter.toUpperCase();
  if (style) where.style = style;

  const [crops, total] = await Promise.all([
    prisma.letterCrop.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.letterCrop.count({ where }),
  ]);

  return {
    crops: crops.map(db => ({
      id: db.id,
      letter: db.letter,
      cropUrl: db.cropUrl,
      thumbnailUrl: db.thumbnailUrl,
      style: db.style ?? undefined,
      source: db.source,
      sourceImageUrl: db.sourceImageUrl,
      dimensions: db.dimensions as { width: number; height: number },
    })),
    total,
  };
}

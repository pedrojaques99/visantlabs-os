/**
 * assetAnalysis — LLM visual ingest for brand guideline assets (logos + media).
 *
 * Mirrors the reference-library ingest (`mockup/referenceIngestor.ts`) but tuned
 * for brand assets: it analyzes each image and extracts a compact set of visual
 * dimensions (vibe / aesthetic / theme / mood / medium) plus a short description.
 * Reuses existing infra (Gemini structured output) — zero new vision stack.
 *
 * The tags are persisted onto each asset (`asset.analysis`) so the API exposes
 * them everywhere a guideline is read, and `brandContextBuilder` turns them into
 * a "VISUAL LANGUAGE" block — i.e. the brand's own assets become INPUT for
 * generation, not just stored files.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { safeFetch } from '../../utils/securityValidation.js';
import { shouldRetry } from '../ai-resilience.js';
import type { BrandAssetAnalysis } from './visualSignature.js';

export type { BrandAssetAnalysis, BrandAssetDimensions, BrandVisualSignature } from './visualSignature.js';
export { aggregateVisualSignature, hasSignature } from './visualSignature.js';

const MODEL = 'gemini-2.5-flash';

const ANALYSIS_PROMPT = `You are a brand designer cataloguing a brand's own visual asset (a logo, graphic, photo, pattern or mockup).

Return JSON describing its visual language:
{
  "description": "One concise sentence describing the asset, for prompt engineering (English).",
  "dimensions": {
    "vibe": ["emotional tone, e.g. premium, playful, bold, calm, edgy, corporate, warm"],
    "aesthetic": ["visual style, e.g. minimalist, brutalist, editorial, retro, organic, swiss, maximalist"],
    "theme": ["subject/motif, e.g. abstract, geometric, nature, urban, human, product, typographic"],
    "mood": ["color & light mood, e.g. warm, cool, vibrant, muted, pastel, monochrome, high-contrast"],
    "medium": ["treatment, e.g. photography, 3d render, illustration, vector, flat, gradient, grain, line-art"]
  }
}

Each dimension array should have 1-3 precise, lowercase values. Judge only what is visible.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING },
    dimensions: {
      type: Type.OBJECT,
      properties: {
        vibe: { type: Type.ARRAY, items: { type: Type.STRING } },
        aesthetic: { type: Type.ARRAY, items: { type: Type.STRING } },
        theme: { type: Type.ARRAY, items: { type: Type.STRING } },
        mood: { type: Type.ARRAY, items: { type: Type.STRING } },
        medium: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
  },
} as const;

function geminiKey(): string {
  return (
    process.env.VITE_GEMINI_API_KEY ||
    process.env.VITE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    ''
  ).trim();
}

/** True when a Gemini key is configured (lets callers fail fast with a clear error). */
export function isAssetAnalysisConfigured(): boolean {
  return geminiKey().length > 0;
}

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // 20s socket timeout so a dead asset host can't stall a large analysis job.
    const res = await safeFetch(url, { timeoutMs: 20_000 } as any);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type')?.split(';')[0] || '';
    const isSvg = ct.includes('svg') || /\.svg(\?|$)/i.test(url);
    if (!isSvg && !ct.startsWith('image/') && !/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url)) {
      return null; // skip pdfs / non-images
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;

    // Vision models can't read SVG — rasterize to a flat-white PNG first so logo
    // marks (which are often SVG) actually get analyzed instead of returning empty.
    if (isSvg) {
      const { default: sharp } = await import('sharp');
      const png = await sharp(buf, { density: 200 })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: false })
        .flatten({ background: '#ffffff' })
        .png()
        .toBuffer();
      return { data: png.toString('base64'), mimeType: 'image/png' };
    }

    return { data: buf.toString('base64'), mimeType: ct.startsWith('image/') ? ct : 'image/png' };
  } catch {
    return null;
  }
}

/**
 * Retry the Gemini call on transient errors (rate limits / 429) with exponential
 * backoff + jitter. Bulk analysis bursts hit per-minute quotas; a plain call
 * would return null and silently drop the asset. We retry rather than use the
 * circuit breaker (which would open and skip the whole batch).
 */
async function generateWithRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts || !shouldRetry(err)) throw err;
      // 3s, 6s, 12s … capped, with jitter to de-sync concurrent workers.
      const delay = Math.min(3000 * 2 ** (attempt - 1), 24000) + Math.floor(Math.random() * 1500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/**
 * Analyze a single asset image URL into visual dimensions (or null on failure).
 * Also returns the fetched image so callers can embed it without re-downloading.
 */
export async function analyzeAssetImage(url: string): Promise<{
  analysis: BrandAssetAnalysis;
  image: { data: string; mimeType: string };
  inputTokens: number;
  outputTokens: number;
} | null> {
  const key = geminiKey();
  if (!key) return null;
  const img = await fetchAsBase64(url);
  if (!img) return null;

  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            parts: [
              { inlineData: { data: img.data, mimeType: img.mimeType } },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
        config: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA as any },
      })
    );
    const parsed = JSON.parse((response.text || '').trim());
    const usage = (response as any).usageMetadata;
    return {
      analysis: {
        description: parsed.description || undefined,
        dimensions: parsed.dimensions || {},
        analyzedAt: new Date().toISOString(),
        model: MODEL,
      },
      image: img,
      inputTokens: usage?.promptTokenCount || 0,
      outputTokens: usage?.candidatesTokenCount || 0,
    };
  } catch (err) {
    console.warn('[assetAnalysis] analysis failed for', url, (err as any)?.message || err);
    return null;
  }
}


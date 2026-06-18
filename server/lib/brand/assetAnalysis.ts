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

export type {
  BrandAssetAnalysis,
  BrandAssetDimensions,
  BrandVisualSignature,
} from './visualSignature.js';
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
  return (
    geminiKey().length > 0 ||
    (process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '').trim().length > 0
  );
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
      // A spend cap won't recover on retry — fail fast so we fall back to Replicate.
      if (attempt >= maxAttempts || isSpendCap(err) || !shouldRetry(err)) throw err;
      // 3s, 6s, 12s … capped, with jitter to de-sync concurrent workers.
      const delay = Math.min(3000 * 2 ** (attempt - 1), 24000) + Math.floor(Math.random() * 1500);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

type AssetImage = { data: string; mimeType: string };

// Once Gemini reports a hard spend cap, stop hammering it for the rest of the
// batch and go straight to the fallback (a cap isn't transient — won't recover
// on retry). Re-checked after the window so a raised cap is picked up.
let geminiDisabledUntil = 0;
// Replicate has its own circuit: if it's unreachable (e.g. blocked egress) it would
// otherwise burn the full socket timeout on every asset. Trip it once → skip it for
// the cooldown → which also restores Gemini's retries (it's no longer "the fallback").
let replicateDisabledUntil = 0;
const PROVIDER_COOLDOWN_MS = 10 * 60 * 1000;
function isSpendCap(err: unknown): boolean {
  return /RESOURCE_EXHAUSTED|spending cap|exceeded its monthly|spend cap|quota/i.test(
    String((err as any)?.message || err || '')
  );
}

/** Gemini path — best structured output (native JSON schema). Throws on failure. */
async function analyzeWithGemini(img: AssetImage, maxAttempts = 4): Promise<BrandAssetAnalysis> {
  const ai = new GoogleGenAI({ apiKey: geminiKey() });
  const response = await generateWithRetry(
    () =>
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
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA as any,
          // Disable thinking — this is a simple tagging task. With thinking ON,
          // 2.5-flash spends the output budget reasoning and truncates the JSON
          // mid-string (the "Unterminated string" failures). Off = faster + valid.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 1024,
        },
      }),
    maxAttempts
  );
  const parsed = JSON.parse((response.text || '').trim());
  return {
    description: parsed.description || undefined,
    dimensions: parsed.dimensions || {},
    analyzedAt: new Date().toISOString(),
    model: MODEL,
  };
}

// ── Replicate fallback (provider-independent — survives a Gemini budget cap) ──

function replicateToken(): string {
  return (process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '').trim();
}
// Default to gpt-4o-mini: cheap, reliable structured JSON, and a *different*
// provider (OpenAI via Replicate's billing) so it bypasses a capped Google project.
const REPLICATE_MODEL = () => process.env.REPLICATE_VISION_MODEL || 'openai/gpt-4o-mini';
const REPLICATE_PROMPT =
  'You are tagging a brand visual asset. Output ONLY a JSON object, no prose. ' +
  'Schema: {"description":"one short sentence","dimensions":{"vibe":[],"aesthetic":[],"theme":[],"mood":[],"medium":[]}}. ' +
  'Use 1-3 lowercase single-word tags per dimension.';

// Official models (openai/anthropic/google/meta) run via the model endpoint with
// an `image_input` array; community models need a resolved version + `image` input.
const isOfficialModel = (m: string) => /^(openai|anthropic|google|meta)\//.test(m);

let cachedVersion: { model: string; version: string } | null = null;
async function replicateVersion(model: string): Promise<string | null> {
  if (cachedVersion?.model === model) return cachedVersion.version;
  const res = await safeFetch(`https://api.replicate.com/v1/models/${model}`, {
    headers: { Authorization: `Bearer ${replicateToken()}` },
    timeoutMs: 15_000,
  } as any);
  if (!res.ok) return null;
  const version = ((await res.json()) as any)?.latest_version?.id;
  if (version) cachedVersion = { model, version };
  return version || null;
}

function parseReplicateOutput(text: string): BrandAssetAnalysis {
  const clean = (a: unknown): string[] | undefined =>
    Array.isArray(a)
      ? a
          .map((s) => String(s).toLowerCase().trim())
          .filter(Boolean)
          .slice(0, 3)
      : undefined;
  let description: string | undefined;
  let dims: any = {};
  const match = text.match(/\{[\s\S]*\}/); // VLMs sometimes wrap JSON in prose/fences
  if (match) {
    try {
      const j = JSON.parse(match[0]);
      description = j.description;
      dims = j.dimensions || {};
    } catch {
      /* not valid JSON — fall back to caption below */
    }
  }
  if (!description) description = text.trim().slice(0, 200) || undefined;
  return {
    description,
    dimensions: {
      vibe: clean(dims.vibe),
      aesthetic: clean(dims.aesthetic),
      theme: clean(dims.theme),
      mood: clean(dims.mood),
      medium: clean(dims.medium),
    },
    analyzedAt: new Date().toISOString(),
    model: `replicate:${REPLICATE_MODEL()}`,
  };
}

/** Replicate VLM path — provider-independent fallback when Gemini is unavailable. */
async function analyzeWithReplicate(img: AssetImage): Promise<BrandAssetAnalysis | null> {
  const token = replicateToken();
  if (!token) return null;
  const model = REPLICATE_MODEL();
  const dataUri = `data:${img.mimeType};base64,${img.data}`;
  try {
    let endpoint: string;
    let body: Record<string, unknown>;
    if (isOfficialModel(model)) {
      endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;
      body = { input: { prompt: REPLICATE_PROMPT, image_input: [dataUri] } };
    } else {
      const version = await replicateVersion(model);
      if (!version) return null;
      endpoint = 'https://api.replicate.com/v1/predictions';
      body = {
        version,
        input: { image: dataUri, prompt: REPLICATE_PROMPT, temperature: 0.1, max_tokens: 350 },
      };
    }
    const res = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify(body),
      timeoutMs: 45_000,
    } as any);
    if (!res.ok) {
      // Provider-level failure (auth/quota/5xx) → trip the circuit for the batch.
      replicateDisabledUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      return null;
    }
    const j = (await res.json()) as any;
    if (j.status !== 'succeeded') return null; // per-prediction miss — don't trip
    const text = Array.isArray(j.output) ? j.output.join('') : String(j.output || '');
    if (!text.trim()) return null;
    return parseReplicateOutput(text);
  } catch (err) {
    // Network / timeout (e.g. blocked egress) → trip so we don't burn the socket
    // timeout on every asset; Gemini regains its retries while Replicate is down.
    replicateDisabledUntil = Date.now() + PROVIDER_COOLDOWN_MS;
    console.warn('[assetAnalysis] replicate failed — circuit open', (err as any)?.message || err);
    return null;
  }
}

/** Which provider leads. Configurable so a capped Gemini can be sidelined without
 *  a deploy: ASSET_VISION_PRIMARY=replicate makes gpt-4o-mini the primary. */
function visionPrimary(): 'gemini' | 'replicate' {
  return (process.env.ASSET_VISION_PRIMARY || 'gemini').toLowerCase() === 'replicate'
    ? 'replicate'
    : 'gemini';
}

/**
 * Analyze a single asset image into visual dimensions (or null on failure).
 *
 * Provider routing (pro pattern): a configurable primary with a fallback. When a
 * fallback is available, the primary fails FAST (1 attempt, no slow retry) — so
 * one capped provider doesn't burn ~20s of backoff per asset before falling over.
 * A Gemini spend cap also trips a shared circuit (`geminiDisabledUntil`) so the
 * rest of the batch skips Gemini entirely. Returns the fetched image so callers
 * can embed it without re-downloading.
 */
export async function analyzeAssetImage(url: string): Promise<{
  analysis: BrandAssetAnalysis;
  image: AssetImage;
  inputTokens: number;
  outputTokens: number;
} | null> {
  const img = await fetchAsBase64(url);
  if (!img) return null;

  const geminiUp = !!geminiKey() && Date.now() >= geminiDisabledUntil;
  const replicateUp = !!replicateToken() && Date.now() >= replicateDisabledUntil;
  const ok = (analysis: BrandAssetAnalysis) => ({
    analysis,
    image: img,
    inputTokens: 0,
    outputTokens: 0,
  });

  const tryGemini = async () => {
    try {
      // Fail fast (1 attempt) when Replicate can catch the failure — no 4× backoff.
      return ok(await analyzeWithGemini(img, replicateUp ? 1 : 4));
    } catch (err) {
      if (isSpendCap(err)) {
        geminiDisabledUntil = Date.now() + 10 * 60 * 1000; // circuit: skip Gemini for the batch
        console.warn('[assetAnalysis] Gemini spend cap — circuit open, routing to fallback');
      } else {
        console.warn('[assetAnalysis] gemini failed', (err as any)?.message || err);
      }
      return null;
    }
  };
  const tryReplicate = async () => {
    const rep = await analyzeWithReplicate(img);
    return rep ? ok(rep) : null;
  };

  // Run providers in primary-first order, skipping ones that are down.
  const order =
    visionPrimary() === 'replicate'
      ? ([
          ['replicate', replicateUp, tryReplicate],
          ['gemini', geminiUp, tryGemini],
        ] as const)
      : ([
          ['gemini', geminiUp, tryGemini],
          ['replicate', replicateUp, tryReplicate],
        ] as const);

  for (const [, up, run] of order) {
    if (!up) continue;
    const result = await run();
    if (result) return result;
  }
  return null;
}

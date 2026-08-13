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
import { meteredGemini } from '../ai/metered.js';
import { safeFetch } from '../../utils/securityValidation.js';
import { shouldRetry } from '../ai-resilience.js';
import { GEMINI_MODELS } from '../../../src/constants/geminiModels.js';
import type { BrandAssetAnalysis } from './visualSignature.js';

export type {
  BrandAssetAnalysis,
  BrandAssetDimensions,
  BrandVisualSignature,
} from './visualSignature.js';
export { aggregateVisualSignature, hasSignature } from './visualSignature.js';

// SSoT dos IDs de modelo. Era 'gemini-2.5-flash' hardcoded — mesmo valor, mas
// fora da constante ninguém enxerga que MODEL_CONFIG marca esse como
// `deprecated: true`. Migrar pra GEMINI_MODELS.TEXT (gemini-3-flash-preview,
// o que o resto do server usa) muda a saída do analisador, então fica como
// decisão explícita e não como efeito colateral desta correção.
const MODEL = GEMINI_MODELS.FLASH_2_5;

const ANALYSIS_PROMPT = `You are a brand designer cataloguing a brand's own visual asset (a logo, graphic, photo, pattern or mockup).

Return JSON describing its visual language AND how it can be placed onto a mockup surface.
Emit the fields in EXACTLY this order (description LAST):
{
  "dimensions": {
    "vibe": ["emotional tone, e.g. premium, playful, bold, calm, edgy, corporate, warm"],
    "aesthetic": ["visual style, e.g. minimalist, brutalist, editorial, retro, organic, swiss, maximalist"],
    "theme": ["subject/motif, e.g. abstract, geometric, nature, urban, human, product, typographic"],
    "mood": ["color & light mood, e.g. warm, cool, vibrant, muted, pastel, monochrome, high-contrast"],
    "medium": ["treatment, e.g. photography, 3d render, illustration, vector, flat, gradient, grain, line-art"]
  },
  "placement": {
    "kind": "ONE of: logo | wordmark | symbol | photo | pattern | texture | graphic | illustration",
    "luminance": "ONE of: light (art is mostly light/white) | dark (mostly dark/black) | mixed",
    "hasText": true or false (is there any legible text/lettering),
    "text": "the exact text if any, verbatim; empty string if none",
    "contrastSafeOn": ["which backgrounds it stays legible on: 'light' and/or 'dark'"],
    "box_2d": [ymin, xmin, ymax, xmax]
  },
  "name": "2-4 words, English, Title Case. A name a designer would file this under, e.g. 'Coral Gradient Backdrop', 'Founder Portrait', 'Packaging Mockup'. Describe what it IS, never transcribe text from the image, never invent a brand name.",
  "namePt": "the same name in Brazilian Portuguese, 2-4 words.",
  "description": "MAX 15 words. One short phrase (English). NEVER transcribe text in the image. No lists, no line breaks."
}

kind: 'logo' = symbol + wordmark lockup; 'wordmark' = text-only logotype; 'symbol' = icon/mark only; 'graphic' = a designed campaign composition; 'photo' = a photograph.
contrastSafeOn: a white/light mark is safe on 'dark'; a black/dark mark is safe on 'light'; a full-bleed photo or framed graphic is safe on both.
box_2d: the MINIMAL box containing ALL legible text and logo, in normalized 0-1000 coords, order [ymin, xmin, ymax, xmax]. Ignore photos, gradients, textures and decorative graphics — only text and logo matter. Omit box_2d entirely when hasText is false and there is no logo. Be precise: this becomes a crop tolerance — too loose decapitates the headline, too tight discards usable scenes.
Each dimension array should have 1-3 precise, lowercase values. Judge only what is visible.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  // Order matters: placement/dimensions FIRST, description LAST. If the model lets
  // the description run away (it sometimes emits a huge string), it truncates at the
  // token cap — but the essential fields are already emitted and get salvaged.
  properties: {
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
    placement: {
      type: Type.OBJECT,
      properties: {
        kind: { type: Type.STRING },
        luminance: { type: Type.STRING },
        hasText: { type: Type.BOOLEAN },
        text: { type: Type.STRING },
        contrastSafeOn: { type: Type.ARRAY, items: { type: Type.STRING } },
        // Convenção NATIVA de detecção do Gemini: [ymin, xmin, ymax, xmax] em
        // 0-1000, y antes de x. Pedir noutro formato degrada a resposta — o
        // modelo foi treinado nesta. Convertido pra textBox em normalizePlacementSemantic.
        box_2d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
      },
    },
    // Before `description` on purpose: the salvage in parseAnalysisJson cuts at
    // the `"description"` key, so anything emitted earlier survives a truncated
    // response. The asset's name is worth more than its description.
    name: { type: Type.STRING },
    namePt: { type: Type.STRING },
    description: { type: Type.STRING },
  },
  propertyOrdering: ['dimensions', 'placement', 'name', 'namePt', 'description'],
} as const;

/** Trim a model-supplied name to something safe to show as a label. */
export function cleanName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const n = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  // A model that echoes the layer name back has told us nothing.
  return n && !isAutoGeneratedLabel(n) ? n : undefined;
}

/**
 * True when a label is machine debris rather than something a person wrote.
 *
 * Figma hands over the LAYER NAME — "Frame 4836", "Group 12", "Rectangle 3" —
 * and a raw filename is barely better. The media kit is INPUT for generation, so
 * these end up in prompts: a kit you can consult versus a pile. A human-written
 * label is never overwritten; only these are.
 */
export function isAutoGeneratedLabel(label: string | undefined | null): boolean {
  const l = String(label ?? '').trim();
  if (!l) return true;
  // Figma/Sketch default node names, with or without a trailing index.
  if (
    /^(frame|group|rectangle|ellipse|vector|polygon|star|line|arrow|slice|component|instance|union|subtract|intersect|exclude|mask|image|shape|layer|path)[\s_-]*\d*$/i.test(
      l
    )
  )
    return true;
  // Bare filenames ("IMG_2043.png", "Screenshot 2026-08-05 at 10.14.png", "asset-1.svg").
  if (/\.(png|jpe?g|webp|gif|svg|pdf|avif)$/i.test(l)) return true;
  // Hashes, uuids and pure numbers.
  if (/^[0-9]+$/.test(l)) return true;
  if (/^[0-9a-f]{8,}$/i.test(l)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(l)) return true;
  return false;
}

/**
 * Parse the analysis JSON, salvaging the essential fields when the trailing
 * `description` overflows the token budget and truncates the response. Since
 * description is emitted LAST, cutting before it yields valid JSON with the
 * dimensions + placement intact.
 */
export function parseAnalysisJson(text: string): any {
  const t = (text || '').trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through to salvage */
  }
  const di = t.indexOf('"description"');
  if (di > 0) {
    const head = t.slice(0, di).replace(/[,\s]*$/, '');
    try {
      return JSON.parse(head + '}');
    } catch {
      /* unsalvageable */
    }
  }
  throw new Error('Unparseable analysis JSON');
}

// Vision returns free-form strings; clamp to our unions so the matcher can trust them.
const VALID_KINDS = [
  'logo',
  'wordmark',
  'symbol',
  'photo',
  'pattern',
  'texture',
  'graphic',
  'illustration',
] as const;
export function normalizePlacementSemantic(
  raw: any
): import('./visualSignature.js').BrandAssetPlacement {
  if (!raw || typeof raw !== 'object') return {};
  const kind = String(raw.kind || '')
    .toLowerCase()
    .trim();
  const lum = String(raw.luminance || '')
    .toLowerCase()
    .trim();
  const safe = Array.isArray(raw.contrastSafeOn)
    ? raw.contrastSafeOn
        .map((s: unknown) => String(s).toLowerCase().trim())
        .filter((s: string) => s === 'light' || s === 'dark')
    : undefined;
  let text = typeof raw.text === 'string' ? raw.text.trim() : undefined;
  // Models sometimes echo a sentinel ("false"/"none"/"n/a") instead of real text.
  if (text && /^(false|true|none|n\/?a|null|no text)$/i.test(text)) text = undefined;

  const box = parseBox2d(raw.box_2d);
  return {
    kind: (VALID_KINDS as readonly string[]).includes(kind) ? (kind as any) : undefined,
    luminance: lum === 'light' || lum === 'dark' || lum === 'mixed' ? (lum as any) : undefined,
    hasText: typeof raw.hasText === 'boolean' ? raw.hasText : text ? text.length > 0 : undefined,
    text: text || undefined,
    contrastSafeOn: safe && safe.length ? Array.from(new Set(safe)) : undefined,
    ...(box
      ? { textBox: box, safeCrop: safeCropFromBox(box), safeCropSource: 'vision' as const }
      : {}),
  };
}

/**
 * Converte o `box_2d` do Gemini ([ymin, xmin, ymax, xmax] em 0-1000, y antes de
 * x) pro nosso {x0,y0,x1,y1} em 0..1. Retorna null se vier malformado ou
 * degenerado — melhor não ter o dado do que ter um errado, porque o caller usa
 * a ausência como "não corte".
 */
function parseBox2d(raw: unknown): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const n = raw.map(Number);
  if (!n.every((v) => Number.isFinite(v) && v >= 0 && v <= 1000)) return null;
  let [y0, x0, y1, x1] = n.map((v) => v / 1000);
  // O modelo às vezes troca os cantos — ordena em vez de descartar a leitura.
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  // Caixa vazia = leitura inútil; caixa cobrindo tudo = não protege nada, mas é
  // informação válida (safeCrop 0 → não corte).
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return null;
  return { x0, y0, x1, y1 };
}

/**
 * Fração TOTAL da arte que um `cover` pode descartar sem tocar na caixa. O corte
 * é centrado, então cada lado perde metade do total → 2× a menor margem.
 */
export function safeCropFromBox(box: { x0: number; y0: number; x1: number; y1: number }): number {
  const mX = Math.min(box.x0, 1 - box.x1);
  const mY = Math.min(box.y0, 1 - box.y1);
  return +Math.max(0, Math.min(2 * mX, 2 * mY)).toFixed(4);
}

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

async function fetchAsBase64(
  url: string
): Promise<{ data: string; mimeType: string; raster: Buffer } | null> {
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
      // Keep alpha in the raster we measure mechanics on (transparency detection),
      // but send the vision model a flattened copy so it isn't confused by alpha.
      const raster = await sharp(buf, { density: 200 })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: false })
        .png()
        .toBuffer();
      const flat = await sharp(raster).flatten({ background: '#ffffff' }).png().toBuffer();
      return { data: flat.toString('base64'), mimeType: 'image/png', raster };
    }

    // Downscale rasters before vision. A full-res, text-heavy image (og-image,
    // screenshots) makes the model OCR-transcribe every word into `description`,
    // overflowing the JSON output ("Unterminated string"). Capping to ~1024px
    // keeps composition legible, kills the transcription runaway, and cuts tokens.
    // Ratio/alpha/dominant all survive the downscale, so mechanics stay correct.
    try {
      const { default: sharp } = await import('sharp');
      const meta = await sharp(buf).metadata();
      if ((meta.width || 0) > 1024 || (meta.height || 0) > 1024) {
        const resized = await sharp(buf)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
        return { data: resized.toString('base64'), mimeType: 'image/png', raster: resized };
      }
    } catch {
      /* sharp failed — fall through to the original bytes */
    }

    return {
      data: buf.toString('base64'),
      mimeType: ct.startsWith('image/') ? ct : 'image/png',
      raster: buf,
    };
  } catch {
    return null;
  }
}

/**
 * Deterministic placement mechanics via sharp — no LLM, no cost. These are pure
 * measurements the matcher trusts: aspect ratio (matches SceneFace innerW/innerH),
 * whether the asset has real transparency (can be pasted without a frame), and
 * its dominant color (for contrast scoring against a scene's base).
 */
export async function computeMechanics(
  raster: Buffer
): Promise<
  Pick<
    import('./visualSignature.js').BrandAssetPlacement,
    'aspectRatio' | 'hasTransparency' | 'dominantColor'
  >
> {
  try {
    const { default: sharp } = await import('sharp');
    const img = sharp(raster);
    const meta = await img.metadata();
    const out: {
      aspectRatio?: number;
      hasTransparency?: boolean;
      dominantColor?: string;
    } = {};

    if (meta.width && meta.height) out.aspectRatio = +(meta.width / meta.height).toFixed(4);

    // Real transparency = has alpha AND at least one meaningfully transparent pixel
    // (a flat opaque PNG can still carry an alpha channel). stats().isOpaque is the
    // cheap, reliable signal sharp already computes.
    if (meta.hasAlpha) {
      try {
        const stats = await img.stats();
        out.hasTransparency = !stats.isOpaque;
      } catch {
        out.hasTransparency = true; // has alpha but stats failed — assume transparent
      }
    } else {
      out.hasTransparency = false;
    }

    try {
      const { dominant } = await img.stats();
      out.dominantColor =
        '#' +
        [dominant.r, dominant.g, dominant.b]
          .map((c) => Math.round(c).toString(16).padStart(2, '0'))
          .join('');
    } catch {
      /* dominant optional */
    }
    return out;
  } catch {
    return {};
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
  const ai = meteredGemini({
    apiKey: geminiKey(),
    operation: 'asset-analysis',
    feature: 'branding',
  });
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
          // Headroom for the richer schema (dimensions + placement + description).
          // 1024 truncated once placement was added; a rambling description on busy
          // images can still eat the budget, so the prompt caps it at 15 words too.
          maxOutputTokens: 3072,
        },
      }),
    maxAttempts
  );
  const parsed = parseAnalysisJson(response.text || '');
  return {
    name: cleanName(parsed.name),
    namePt: cleanName(parsed.namePt),
    description: parsed.description || undefined,
    dimensions: parsed.dimensions || {},
    placement: normalizePlacementSemantic(parsed.placement),
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
  'Schema: {"name":"2-4 word Title Case name for what this asset IS, never text copied from the image",' +
  '"namePt":"the same name in Brazilian Portuguese","description":"one short sentence",' +
  '"dimensions":{"vibe":[],"aesthetic":[],"theme":[],"mood":[],"medium":[]},' +
  '"placement":{"kind":"logo|wordmark|symbol|photo|pattern|texture|graphic|illustration",' +
  '"luminance":"light|dark|mixed","hasText":true,"text":"verbatim text or empty","contrastSafeOn":["light","dark"]}}. ' +
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
  let placement: BrandAssetAnalysis['placement'];
  if (match) {
    try {
      placement = normalizePlacementSemantic(JSON.parse(match[0]).placement);
    } catch {
      /* placement optional — leave undefined */
    }
  }
  let name: string | undefined;
  let namePt: string | undefined;
  if (match) {
    try {
      const j = JSON.parse(match[0]);
      name = cleanName(j.name);
      namePt = cleanName(j.namePt);
    } catch {
      /* name optional */
    }
  }
  return {
    name,
    namePt,
    description,
    dimensions: {
      vibe: clean(dims.vibe),
      aesthetic: clean(dims.aesthetic),
      theme: clean(dims.theme),
      mood: clean(dims.mood),
      medium: clean(dims.medium),
    },
    placement,
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

  // Deterministic mechanics (sharp) computed once, merged onto whichever provider
  // returns — so aspectRatio/hasTransparency/dominantColor are always present even
  // if the vision model omits or fumbles the semantic placement fields.
  const mechanics = await computeMechanics(img.raster);

  const geminiUp = !!geminiKey() && Date.now() >= geminiDisabledUntil;
  const replicateUp = !!replicateToken() && Date.now() >= replicateDisabledUntil;
  const ok = (analysis: BrandAssetAnalysis) => ({
    analysis: { ...analysis, placement: { ...(analysis.placement || {}), ...mechanics } },
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

import { fal } from '@fal-ai/client';
import { safeFetch } from '../utils/securityValidation.js';
import type { KlingGenerateParams } from './klingService.js';

/**
 * Kling via fal.ai (cobrança por segundo, sem pacote na Kling).
 * Mesma assinatura do klingService: devolve a URL pública do vídeo.
 * Modelo sem endpoint mapeado aqui cai na Kling direta (ver useFalForKling).
 */

type FalVariant = 'standard' | 'pro' | '4k';
type FalKind = 'image-to-video' | 'text-to-video';

/** Famílias do enum do MCP → caminho no fal e variantes que existem lá. */
const FAL_FAMILIES: Record<string, { path: string; variants: FalVariant[]; kinds: FalKind[] }> = {
  'kling-v3': {
    path: 'v3',
    variants: ['standard', 'pro', '4k'],
    kinds: ['image-to-video', 'text-to-video'],
  },
  // O3 é a família "omni" do fal (image_url em vez de start_image_url).
  'kling-v3-omni': {
    path: 'o3',
    variants: ['standard', 'pro'],
    kinds: ['image-to-video', 'text-to-video'],
  },
  'kling-v2-6': { path: 'v2.6', variants: ['pro'], kinds: ['image-to-video', 'text-to-video'] },
  'kling-v2-5-turbo': {
    path: 'v2.5-turbo',
    variants: ['standard', 'pro'],
    kinds: ['image-to-video', 'text-to-video'],
  },
};

function toFalVariant(klingMode?: string): FalVariant {
  if (klingMode === 'pro') return 'pro';
  if (klingMode === '4k') return '4k';
  return 'standard';
}

/** Endpoint do fal para o modelo/modo, ou null se não houver (→ Kling direta). */
export function resolveFalEndpoint(
  model: string,
  klingMode: string | undefined,
  kind: FalKind
): string | null {
  const family = FAL_FAMILIES[model.replace(/\./g, '-')];
  if (!family || !family.kinds.includes(kind)) return null;
  const variant = toFalVariant(klingMode);
  if (!family.variants.includes(variant)) return null;
  return `fal-ai/kling-video/${family.path}/${variant}/${kind}`;
}

/** Fal só com FAL_KEY e sem KLING_PROVIDER=direct; modelo sem endpoint vai pra Kling direta. */
export function useFalForKling(params: KlingGenerateParams): boolean {
  if ((process.env.KLING_PROVIDER || '').toLowerCase() === 'direct') return false;
  if (!process.env.FAL_KEY) return false;
  return resolveFalEndpoint(params.model, params.klingMode, falKind(params)) !== null;
}

function needsImage(params: KlingGenerateParams): boolean {
  return !!(
    params.startFrame ||
    params.endFrame ||
    params.referenceImages?.length ||
    params.mode === 'frames_to_video' ||
    params.mode === 'image_to_video' ||
    params.mode === 'references'
  );
}

function falKind(params: KlingGenerateParams): FalKind {
  return needsImage(params) ? 'image-to-video' : 'text-to-video';
}

const RATIOS: Record<string, number> = { '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 };
const RATIO_TOLERANCE = 0.02;

/** Janela de corte centrada que deixa a imagem na proporção pedida; null se já está (±2%). */
export function centerCropBox(
  width: number,
  height: number,
  aspectRatio?: string
): { left: number; top: number; width: number; height: number } | null {
  const target = aspectRatio ? RATIOS[aspectRatio] : undefined;
  if (!target || !width || !height) return null;
  const current = width / height;
  if (Math.abs(current - target) / target <= RATIO_TOLERANCE) return null;
  if (current > target) {
    const w = Math.round(height * target);
    return { left: Math.floor((width - w) / 2), top: 0, width: w, height };
  }
  const h = Math.round(width / target);
  return { left: 0, top: Math.floor((height - h) / 2), width, height: h };
}

async function loadImageBytes(input: string): Promise<{ bytes: Buffer; mime: string }> {
  if (input.startsWith('http')) {
    // URL vem do usuário: safeFetch bloqueia IP interno/metadata (SSRF)
    const resp = await safeFetch(input);
    if (!resp.ok)
      throw new Error(`Kling (fal): não consegui baixar o frame (HTTP ${resp.status}).`);
    return {
      bytes: Buffer.from(await resp.arrayBuffer()),
      mime: resp.headers.get('content-type') ?? 'image/png',
    };
  }
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  return { bytes: Buffer.from(match?.[2] ?? input, 'base64'), mime: match?.[1] ?? 'image/png' };
}

/**
 * O fal só lê URL, e o image-to-video NÃO tem aspect_ratio: a proporção do vídeo
 * segue a do frame. Pra respeitar o aspectRatio pedido, o frame é cortado ao
 * centro na proporção e sobe pro storage do fal. Sem aspectRatio, passa direto.
 */
async function toFalImageUrl(input: string, aspectRatio?: string): Promise<string> {
  if (input.startsWith('http') && !aspectRatio) return input;
  // import dinâmico: sharp no topo quebra o cold-start da Vercel (check:serverless-imports)
  const { default: sharp } = await import('sharp');
  const { bytes, mime } = await loadImageBytes(input);
  const { width, height } = await sharp(bytes).metadata();
  const box = centerCropBox(width ?? 0, height ?? 0, aspectRatio);
  if (!box && input.startsWith('http')) return input;
  const out = box ? await sharp(bytes).extract(box).jpeg({ quality: 95 }).toBuffer() : bytes;
  return fal.storage.upload(new Blob([new Uint8Array(out)], { type: box ? 'image/jpeg' : mime }));
}

export async function buildFalInput(
  params: KlingGenerateParams,
  endpoint: string
): Promise<Record<string, unknown>> {
  const isOmni = endpoint.includes('/o3/');
  const kind = falKind(params);
  const input: Record<string, unknown> = {
    prompt: params.prompt ?? '',
    duration: (params.duration ?? '5').replace(/s$/, ''),
    // o fal liga o áudio por padrão; aqui só sai áudio se o usuário pediu
    generate_audio: params.sound === 'on',
  };

  if (kind === 'text-to-video') {
    input.aspect_ratio = params.aspectRatio ?? '16:9';
  } else {
    const start = params.startFrame ?? params.referenceImages?.[0];
    if (!start) throw new Error('Kling (fal): image-to-video precisa de um frame inicial.');
    input[isOmni ? 'image_url' : 'start_image_url'] = await toFalImageUrl(
      start,
      params.aspectRatio
    );
    if (params.endFrame)
      input.end_image_url = await toFalImageUrl(params.endFrame, params.aspectRatio);
  }

  // O3 não documenta negative_prompt/cfg_scale; só a família v3.
  if (!isOmni) {
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    if (params.cfgScale !== undefined) input.cfg_scale = params.cfgScale;
  }
  return input;
}

/** Resultado + o que o fal cobrou, pra contabilidade (custo real, não estimativa interna). */
export interface FalVideoResult {
  url: string;
  requestId: string | null;
  endpoint: string;
  seconds: number;
  /** US$ por segundo do endpoint (API de pricing do fal); null se a consulta falhou. */
  unitPriceUsd: number | null;
  /** seconds × unitPriceUsd; null quando o preço não pôde ser lido. */
  costUsd: number | null;
}

const PRICE_TTL_MS = 60 * 60 * 1000;
const priceCache = new Map<string, { price: number; at: number }>();

/**
 * Preço unitário (US$/s) do endpoint, direto da API de pricing do fal
 * (GET api.fal.ai/v1/models/pricing; qualquer chave serve, sem permissão extra).
 * Cache de 1h. Falha de rede devolve null: contabilidade nunca derruba a geração.
 */
export async function getFalUnitPrice(endpoint: string): Promise<number | null> {
  const hit = priceCache.get(endpoint);
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.price;
  try {
    const resp = await fetch(
      `https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpoint)}`,
      { headers: { Authorization: `Key ${process.env.FAL_KEY}` } }
    );
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      prices?: Array<{ endpoint_id: string; unit_price: number; unit: string; currency: string }>;
    };
    const row = body.prices?.find((p) => p.endpoint_id === endpoint);
    if (!row || row.currency !== 'USD' || !/second/i.test(row.unit)) return null;
    priceCache.set(endpoint, { price: row.unit_price, at: Date.now() });
    return row.unit_price;
  } catch {
    return null;
  }
}

/**
 * Saldo de crédito da conta fal em US$ (GET api.fal.ai/v1/account/billing?expand=credits).
 * Precisa de chave com escopo de billing; sem ele (ou em falha) devolve null.
 * Cache de 30s: o saldo muda a cada geração e o painel não precisa de mais que isso.
 */
let balanceCache: { value: number; at: number } | null = null;
export async function getFalBalanceUsd(): Promise<number | null> {
  if (balanceCache && Date.now() - balanceCache.at < 30_000) return balanceCache.value;
  if (!process.env.FAL_KEY) return null;
  try {
    const resp = await fetch('https://api.fal.ai/v1/account/billing?expand=credits', {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
    });
    if (!resp.ok) return null;
    const body = (await resp.json()) as {
      credits?: { current_balance?: number; currency?: string };
    };
    const value = body.credits?.current_balance;
    if (typeof value !== 'number' || body.credits?.currency !== 'USD') return null;
    balanceCache = { value, at: Date.now() };
    return value;
  } catch {
    return null;
  }
}

export async function generateKlingVideoViaFalDetailed(
  params: KlingGenerateParams
): Promise<FalVideoResult> {
  const endpoint = resolveFalEndpoint(params.model, params.klingMode, falKind(params));
  if (!endpoint) throw new Error(`Kling (fal): modelo ${params.model} sem endpoint mapeado.`);
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY must be set in environment variables.');

  fal.config({ credentials: process.env.FAL_KEY });
  const input = await buildFalInput(params, endpoint);
  const result = await fal.subscribe(endpoint, { input, logs: false });
  const url = (result.data as { video?: { url?: string } })?.video?.url;
  if (!url) throw new Error(`Kling (fal): ${endpoint} terminou sem URL de vídeo.`);

  const seconds = Number(input.duration) || 0;
  const unitPriceUsd = await getFalUnitPrice(endpoint);
  return {
    url,
    requestId: result.requestId ?? null,
    endpoint,
    seconds,
    unitPriceUsd,
    costUsd: unitPriceUsd === null ? null : Math.round(seconds * unitPriceUsd * 10000) / 10000,
  };
}

export async function generateKlingVideoViaFal(params: KlingGenerateParams): Promise<string> {
  return (await generateKlingVideoViaFalDetailed(params)).url;
}

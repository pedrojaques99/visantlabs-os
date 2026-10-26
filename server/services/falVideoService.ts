import { fal } from '@fal-ai/client';
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

/** O fal só lê URL: base64/data URL sobe pro storage do fal antes. */
async function toFalImageUrl(input: string): Promise<string> {
  if (input.startsWith('http')) return input;
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  const mime = match?.[1] ?? 'image/png';
  const bytes = Buffer.from(match?.[2] ?? input, 'base64');
  return fal.storage.upload(new Blob([bytes], { type: mime }));
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
    input[isOmni ? 'image_url' : 'start_image_url'] = await toFalImageUrl(start);
    if (params.endFrame) input.end_image_url = await toFalImageUrl(params.endFrame);
  }

  // O3 não documenta negative_prompt/cfg_scale; só a família v3.
  if (!isOmni) {
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    if (params.cfgScale !== undefined) input.cfg_scale = params.cfgScale;
  }
  return input;
}

export async function generateKlingVideoViaFal(params: KlingGenerateParams): Promise<string> {
  const endpoint = resolveFalEndpoint(params.model, params.klingMode, falKind(params));
  if (!endpoint) throw new Error(`Kling (fal): modelo ${params.model} sem endpoint mapeado.`);
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY must be set in environment variables.');

  fal.config({ credentials: process.env.FAL_KEY });
  const input = await buildFalInput(params, endpoint);
  const result = await fal.subscribe(endpoint, { input, logs: false });
  const url = (result.data as { video?: { url?: string } })?.video?.url;
  if (!url) throw new Error(`Kling (fal): ${endpoint} terminou sem URL de vídeo.`);
  return url;
}

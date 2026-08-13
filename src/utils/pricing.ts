// Centralized pricing for Gemini and Veo models
// Single source of truth for all pricing calculations

import type { GeminiModel, Resolution } from '../types/types';
import { GEMINI_MODELS } from '../constants/geminiModels.js';

/**
 * Pricing constants (in USD)
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 */
export const PRICING = {
  IMAGE: {
    // Gemini 2.5 Flash (HD) - fixed resolution ~1K
    GEMINI_2_5: 0.039, // gemini-2.5-flash-image
    // Gemini 3.1 Flash (NB2) - variable resolution
    NB2_512: 0.045, // gemini-3.1-flash-image-preview 512px
    NB2_1K: 0.067, // gemini-3.1-flash-image-preview 1K (official: $0.067)
    NB2_2K: 0.101, // gemini-3.1-flash-image-preview 2K (official: $0.101)
    NB2_4K: 0.151, // gemini-3.1-flash-image-preview 4K (official: $0.151)
    // Gemini 3 Pro - variable resolution (official: 1K/2K same price)
    GEMINI_1K: 0.134, // gemini-3-pro-image-preview with 1K resolution (official: $0.134)
    GEMINI_2K: 0.134, // gemini-3-pro-image-preview with 2K resolution (official: $0.134 - same as 1K)
    GEMINI_4K: 0.24, // gemini-3-pro-image-preview with 4K resolution (official: $0.24)

    // ── OpenAI ────────────────────────────────────────────────────────────
    // Fonte: https://developers.openai.com/api/docs/guides/image-generation
    //
    // Retrato e paisagem custam o MESMO; quadrado custa mais (mais pixels).
    // Sem saber a orientação usamos o quadrado — num número que serve pra
    // cobrar, errar pra cima é o lado seguro.
    GPT_IMAGE_2_LOW_SQ: 0.006,
    GPT_IMAGE_2_LOW_RECT: 0.005,
    GPT_IMAGE_2_MED_SQ: 0.053,
    GPT_IMAGE_2_MED_RECT: 0.041,
    GPT_IMAGE_2_HIGH_SQ: 0.211,
    GPT_IMAGE_2_HIGH_RECT: 0.165,

    // gpt-image-1 é cobrado por token: tokens × $40/1M (image output).
    // low 272/408 · medium 1056/1584 · high 4160/6240  (quadrado/retângulo)
    GPT_IMAGE_1_LOW_SQ: 0.01088,
    GPT_IMAGE_1_LOW_RECT: 0.01632,
    GPT_IMAGE_1_MED_SQ: 0.04224,
    GPT_IMAGE_1_MED_RECT: 0.06336,
    GPT_IMAGE_1_HIGH_SQ: 0.1664,
    GPT_IMAGE_1_HIGH_RECT: 0.2496,

    // ── Imagen 4 (Google) ─────────────────────────────────────────────────
    // Fonte: https://ai.google.dev/gemini-api/docs/pricing
    IMAGEN_4_FAST: 0.02,
    IMAGEN_4: 0.04,
    IMAGEN_4_ULTRA: 0.06,

    // ── Ideogram ──────────────────────────────────────────────────────────
    // Fonte: https://ideogram.ai/api-pricing
    // O serviço usa rendering_speed=DEFAULT salvo override, então DEFAULT é o
    // preço do caminho comum. Turbo e Quality ficam aqui para quando for exposto.
    IDEOGRAM_TURBO: 0.03,
    IDEOGRAM_DEFAULT: 0.06,
    IDEOGRAM_V4_QUALITY: 0.1,
    IDEOGRAM_V3_QUALITY: 0.09,

    // ── Seedream (BytePlus ModelArk) ──────────────────────────────────────
    // Fonte: https://docs.byteplus.com/en/docs/ModelArk/1824718 — "0.03USD / image"
    // Só o 4.0 tem preço publicado. 4.5, 5-lite e 3.0 caem no aviso de
    // modelo sem preço até alguém confirmar na conta.
    SEEDREAM_4_0: 0.03,
  },
  VIDEO: {
    // Veo 3.1 pricing per second (official docs)
    // Conferido em 2026-08-13 contra https://ai.google.dev/gemini-api/docs/pricing
    VEO_STANDARD_PER_SEC: 0.4, // veo-3.1-generate-preview (720p/1080p)
    VEO_STANDARD_4K_PER_SEC: 0.6, // veo-3.1-generate-preview (4K)
    // Fast estava superfaturado na tabela (0.15 e 0.35). Oficial: 0.10 em 720p,
    // 0.12 em 1080p, 0.30 em 4K. Usamos 0.12 como padrão porque o serviço
    // entrega 1080p salvo pedido explícito — assumir 720p subnotificaria.
    VEO_FAST_PER_SEC: 0.12, // veo-3.1-fast-generate-preview (1080p)
    VEO_FAST_720P_PER_SEC: 0.1, // veo-3.1-fast-generate-preview (720p)
    VEO_FAST_4K_PER_SEC: 0.3, // veo-3.1-fast-generate-preview (4K)
    // Default duration for credit calculations (typical Veo output)
    DEFAULT_DURATION_SEC: 8,
  },
} as const;

/**
 * Get the pricing for a specific image model and resolution
 * @param model - The Gemini model used
 * @param resolution - Optional resolution (only applies to gemini-3-pro-image-preview)
 * @returns Price per image in USD
 */
export function getImagePricing(
  model: GeminiModel | string,
  resolution?: Resolution | string | null,
  // Novo parâmetro opcional no FIM (regra do repo). Só a OpenAI cobra
  // diferente por forma; para os modelos Gemini é ignorado.
  orientation?: 'square' | 'rect' | null
): number {
  // Gemini 2.5 Flash (HD) - FLASH and IMAGE_FLASH are aliases
  if (model === GEMINI_MODELS.FLASH || model === GEMINI_MODELS.IMAGE_FLASH) {
    return PRICING.IMAGE.GEMINI_2_5;
  }

  // Gemini 3.1 Flash (NB2) - pricing varies by resolution - NB2 and IMAGE_NB2 are aliases
  if (model === GEMINI_MODELS.NB2 || model === GEMINI_MODELS.IMAGE_NB2) {
    if (resolution === '512px') {
      return PRICING.IMAGE.NB2_512;
    }
    if (resolution === '1K' || resolution === 'HD') {
      return PRICING.IMAGE.NB2_1K;
    }
    if (resolution === '2K') {
      return PRICING.IMAGE.NB2_2K;
    }
    if (resolution === '4K') {
      return PRICING.IMAGE.NB2_4K;
    }
    // Default to 1K if resolution not specified
    return PRICING.IMAGE.NB2_1K;
  }

  // Gemini 3 Pro - pricing varies by resolution - PRO and IMAGE_PRO are aliases
  if (model === GEMINI_MODELS.PRO || model === GEMINI_MODELS.IMAGE_PRO) {
    if (resolution === '1K' || resolution === 'HD') {
      return PRICING.IMAGE.GEMINI_1K;
    }
    if (resolution === '2K') {
      return PRICING.IMAGE.GEMINI_2K;
    }
    if (resolution === '4K') {
      return PRICING.IMAGE.GEMINI_4K;
    }
    // Default to 1K if resolution not specified
    return PRICING.IMAGE.GEMINI_1K;
  }

  // ── OpenAI ────────────────────────────────────────────────────────────────
  // O token de `resolution` vira `quality` na OpenAI (ver OPENAI_QUALITY_MAP):
  // 512px→low, HD/1K→medium, 2K/3K/4K→high. E não muda a dimensão — 1K e 4K
  // saem do mesmo tamanho.
  if (model === 'gpt-image-1' || model === 'gpt-image-2') {
    const q: 'LOW' | 'MED' | 'HIGH' =
      resolution === '512px' ? 'LOW' : resolution === 'HD' || resolution === '1K' ? 'MED' : 'HIGH';
    const forma = orientation === 'rect' ? 'RECT' : 'SQ';
    const chave =
      `${model === 'gpt-image-2' ? 'GPT_IMAGE_2' : 'GPT_IMAGE_1'}_${q}_${forma}` as const;
    return PRICING.IMAGE[chave as keyof typeof PRICING.IMAGE] as number;
  }

  // ── Imagen 4 ──────────────────────────────────────────────────────────────
  if (model === 'imagen-4.0-fast-generate-001') return PRICING.IMAGE.IMAGEN_4_FAST;
  if (model === 'imagen-4.0-generate-001') return PRICING.IMAGE.IMAGEN_4;
  if (model === 'imagen-4.0-ultra-generate-001') return PRICING.IMAGE.IMAGEN_4_ULTRA;

  // ── Ideogram ──────────────────────────────────────────────────────────────
  // O preço varia por rendering_speed, que não é o nosso token de `resolution`.
  // O serviço manda DEFAULT salvo override, então é esse o preço registrado.
  if (model === 'ideogram-v3' || model === 'ideogram-v4') return PRICING.IMAGE.IDEOGRAM_DEFAULT;

  // ── Seedream ──────────────────────────────────────────────────────────────
  if (model === 'seedream-4-0-250828') return PRICING.IMAGE.SEEDREAM_4_0;

  // Modelo desconhecido.
  //
  // Antes isto caía calado no preço do Gemini 2.5 ($0.039) — o MAIS BARATO da
  // tabela. Toda geração OpenAI, Seedream, Ideogram e Reve entrava no
  // `usage_records` por ~1/4 do custo real, e a subnotificação era invisível.
  //
  // Agora reclama e usa o teto conhecido: custo de operação subestimado é pior
  // que superestimado, porque some do radar até virar prejuízo.
  console.warn(
    `[pricing] modelo de imagem sem preço cadastrado: "${model}". ` +
      `Usando o teto conhecido ($${PRICING.IMAGE.GEMINI_4K}) para não subnotificar custo. ` +
      `Cadastre o preço em src/utils/pricing.ts.`
  );
  return PRICING.IMAGE.GEMINI_4K;
}

/**
 * Calculate total cost for image generation
 * @param imagesCount - Number of images generated
 * @param model - The Gemini model used
 * @param resolution - Optional resolution (only applies to gemini-3-pro-image-preview)
 * @returns Total cost in USD
 */
export function calculateImageCost(
  imagesCount: number,
  model: GeminiModel | string = GEMINI_MODELS.FLASH,
  resolution?: Resolution | string | null,
  orientation?: 'square' | 'rect' | null
): number {
  const pricePerImage = getImagePricing(model, resolution, orientation);
  return imagesCount * pricePerImage;
}

/**
 * Get the pricing for video generation
 * @param model - Veo model (standard or fast)
 * @param durationSec - Video duration in seconds (default: 8)
 * @param is4K - Whether output is 4K resolution
 * @returns Price per video in USD
 */
export function getVideoPricing(
  model: 'standard' | 'fast' = 'standard',
  durationSec: number = PRICING.VIDEO.DEFAULT_DURATION_SEC,
  is4K: boolean = false
): number {
  let pricePerSec: number;

  if (model === 'fast') {
    pricePerSec = is4K ? PRICING.VIDEO.VEO_FAST_4K_PER_SEC : PRICING.VIDEO.VEO_FAST_PER_SEC;
  } else {
    pricePerSec = is4K ? PRICING.VIDEO.VEO_STANDARD_4K_PER_SEC : PRICING.VIDEO.VEO_STANDARD_PER_SEC;
  }

  return pricePerSec * durationSec;
}

/**
 * Calculate total cost for video generation
 * @param videosCount - Number of videos generated (default: 1)
 * @param model - Veo model (standard or fast)
 * @param durationSec - Video duration in seconds (default: 8)
 * @param is4K - Whether output is 4K resolution
 * @returns Total cost in USD
 */
export function calculateVideoCost(
  videosCount: number = 1,
  model: 'standard' | 'fast' = 'standard',
  durationSec: number = PRICING.VIDEO.DEFAULT_DURATION_SEC,
  is4K: boolean = false
): number {
  return videosCount * getVideoPricing(model, durationSec, is4K);
}

/**
 * Check if a resolution is considered high resolution (2K or 4K)
 * @param resolution - The resolution to check
 * @returns true if resolution is 2K or 4K
 */
export function isHighResolution(resolution: string | undefined | null): boolean {
  if (!resolution) return false;
  const resLower = resolution.toLowerCase();
  return resLower.includes('2k') || resLower.includes('4k') || resLower.includes('8k');
}

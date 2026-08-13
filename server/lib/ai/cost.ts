/**
 * Custo de uma chamada de IA — fonte única.
 *
 * Mora aqui, e não em `utils/usageTracking.ts`, pra que o portão (`ai/metered.ts`) e o caminho
 * legado (`createUsageRecord`) calculem pelo MESMO código. Duas contas diferentes pro mesmo gasto
 * é como o Veo acabou gravando `cost: 0` por 8 meses.
 *
 * Só depende de `src/utils/pricing.ts` — nada importa daqui de volta, então não há ciclo.
 */

import {
  calculateImageCost,
  calculateVideoCost,
  isHighResolution,
} from '../../../src/utils/pricing.js';
import { GEMINI_MODELS } from '../../../src/constants/geminiModels.js';

/** Quanto a chamada consumiu. O que o provedor devolver, a gente mede; o resto vem declarado. */
export interface MeteredUsage {
  images?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Segundos de vídeo gerados (Veo cobra por segundo). */
  videoSeconds?: number;
  videos?: number;
  resolution?: string | null;
}

// Preço de texto por 1M de tokens (USD).
const TEXT_GENERATION_PRICING: Record<
  string,
  { inputPricePer1M: number; outputPricePer1M: number }
> = {
  [GEMINI_MODELS.FLASH_3_5]: { inputPricePer1M: 1.5, outputPricePer1M: 9.0 },
  [GEMINI_MODELS.FLASH_3]: { inputPricePer1M: 0.1, outputPricePer1M: 0.4 },
  [GEMINI_MODELS.PRO_3_1]: { inputPricePer1M: 1.25, outputPricePer1M: 5.0 },
  [GEMINI_MODELS.FLASH_2_5]: { inputPricePer1M: 0.15, outputPricePer1M: 0.6 },
};

/** Custo de geração de texto (por token, input e output com preços distintos). */
export function calculateTextGenerationCost(
  inputTokens: number,
  outputTokens: number,
  model: string = GEMINI_MODELS.TEXT
): number {
  const pricing = TEXT_GENERATION_PRICING[model] || TEXT_GENERATION_PRICING[GEMINI_MODELS.TEXT];

  if (!pricing) {
    console.warn(`Unknown text model pricing for ${model}, using Flash rates as fallback`);
    return (inputTokens / 1_000_000) * 0.3 + (outputTokens / 1_000_000) * 2.5;
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputPricePer1M +
    (outputTokens / 1_000_000) * pricing.outputPricePer1M
  );
}

/** true quando o modelo não cobra — único caso em que `cost: 0` é uma resposta, não um buraco. */
export function isFreeModel(model: string): boolean {
  return /(?:^|[-/])(?:free|local)(?:$|[-/])/i.test(model);
}

/**
 * Custo total da chamada. Soma o que houver: vídeo por segundo, imagem por unidade, texto por token.
 * Vídeo vem PRIMEIRO de propósito — é a chamada mais cara do catálogo e era a que caía em 0.
 */
export function computeCost(model: string, usage: MeteredUsage): number {
  let cost = 0;

  if (usage.videoSeconds || usage.videos) {
    const tier = model.includes('fast') || model.includes('lite') ? 'fast' : 'standard';
    const seconds = usage.videoSeconds ?? 8;
    cost += calculateVideoCost(
      usage.videos ?? 1,
      tier,
      seconds,
      isHighResolution(usage.resolution)
    );
  }

  if (usage.images) {
    cost += calculateImageCost(usage.images, model, usage.resolution ?? undefined);
  }

  if (usage.inputTokens || usage.outputTokens) {
    cost += calculateTextGenerationCost(usage.inputTokens || 0, usage.outputTokens || 0, model);
  }

  return cost;
}

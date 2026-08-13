import { describe, it, expect, vi } from 'vitest';

import { getImagePricing, PRICING } from '../../src/utils/pricing.js';

/**
 * Preços conferidos contra a documentação oficial em 2026-08-13:
 *
 *   OpenAI   https://developers.openai.com/api/docs/guides/image-generation
 *   Google   https://ai.google.dev/gemini-api/docs/pricing
 *   Ideogram https://ideogram.ai/api-pricing
 *   Seedream https://docs.byteplus.com/en/docs/ModelArk/1824718
 *
 * Este teste existe porque a tabela tinha SÓ modelos Gemini, e todo o resto
 * caía num fallback silencioso no preço do modelo MAIS BARATO ($0.039). Cada
 * geração OpenAI entrava no `usage_records` por ~1/4 do custo real, e a
 * subnotificação era invisível — o tipo de erro que só aparece na fatura.
 */
describe('getImagePricing — coerência com a documentação oficial', () => {
  it.each([
    // modelo,                        resolution, orientação, esperado
    ['gpt-image-2', '4K', 'rect', 0.165],
    ['gpt-image-2', '4K', 'square', 0.211],
    ['gpt-image-2', '2K', 'rect', 0.165],
    ['gpt-image-2', '1K', 'rect', 0.041],
    ['gpt-image-2', '512px', 'rect', 0.005],
    ['gpt-image-1', '4K', 'rect', 0.2496],
    ['gpt-image-1', '1K', 'square', 0.04224],
    ['gemini-3-pro-image-preview', '1K', undefined, 0.134],
    ['gemini-3-pro-image-preview', '2K', undefined, 0.134],
    ['gemini-3-pro-image-preview', '4K', undefined, 0.24],
    ['gemini-3.1-flash-image-preview', '2K', undefined, 0.101],
    ['gemini-2.5-flash-image', '1K', undefined, 0.039],
    ['imagen-4.0-fast-generate-001', undefined, undefined, 0.02],
    ['imagen-4.0-generate-001', undefined, undefined, 0.04],
    ['imagen-4.0-ultra-generate-001', undefined, undefined, 0.06],
    ['ideogram-v3', undefined, undefined, 0.06],
    ['ideogram-v4', undefined, undefined, 0.06],
    ['seedream-4-0-250828', undefined, undefined, 0.03],
  ])('%s (%s, %s) = $%s', (model, resolution, orientation, esperado) => {
    expect(getImagePricing(model as string, resolution as any, orientation as any)).toBeCloseTo(
      esperado as number,
      6
    );
  });

  it('sem orientação usa o preço do quadrado, que é o mais caro', () => {
    // Errar pra cima é o lado seguro quando o número serve pra cobrar.
    const semForma = getImagePricing('gpt-image-2', '4K');
    expect(semForma).toBe(PRICING.IMAGE.GPT_IMAGE_2_HIGH_SQ);
    expect(semForma).toBeGreaterThan(PRICING.IMAGE.GPT_IMAGE_2_HIGH_RECT);
  });

  it('modelo sem preço cadastrado avisa e NÃO usa o mais barato', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const preco = getImagePricing('modelo-que-nao-existe-v9', '4K');

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('modelo-que-nao-existe-v9'));
    // O bug antigo: cair calado no Gemini 2.5 ($0.039), o mais barato da tabela.
    expect(preco).not.toBe(PRICING.IMAGE.GEMINI_2_5);
    expect(preco).toBe(PRICING.IMAGE.GEMINI_4K);
    warn.mockRestore();
  });

  it('Veo fast não está mais superfaturado', () => {
    // A tabela trazia 0.15/s e 0.35/s (4K); o oficial é 0.10 (720p), 0.12
    // (1080p) e 0.30 (4K).
    expect(PRICING.VIDEO.VEO_FAST_PER_SEC).toBe(0.12);
    expect(PRICING.VIDEO.VEO_FAST_720P_PER_SEC).toBe(0.1);
    expect(PRICING.VIDEO.VEO_FAST_4K_PER_SEC).toBe(0.3);
  });
});

import { describe, it, expect } from 'vitest';
import { CREDIT_COSTS, CREDIT_PACKAGES, VISANT_INFRA_COSTS } from '../pricing-data.js';
import { getImagePricing } from '../../../src/utils/pricing.js';
import { getVideoCreditsRequired as uiCredits } from '../../../src/utils/creditCalculator.js';
import { getVideoCreditsRequired as serverCredits } from '../../utils/usageTracking.js';
import { videoProviderCostUsd } from '../ai/cost.js';

/**
 * Guarda de margem: o preço em créditos tem que cobrir o custo do provedor.
 * Referência de receita = o crédito mais barato vendido (pacote de 500). Veja
 * `docs/CREDIT-PRICING-AUDIT.md` pra metodologia e as recomendações.
 */
const FLOOR_USD_PER_CREDIT = Math.min(...CREDIT_PACKAGES.map((p) => p.pricePerCreditUSD));

// Tiers que HOJE vendem abaixo do custo (receita no piso < custo + infra). Cada um tem
// recomendação no audit. Tier novo que entre abaixo do custo reprova o teste; ao corrigir
// um destes, remova da lista.
const KNOWN_UNDERWATER = new Set(['veo-3.1-lite-generate-preview:1080p (8s)', 'gpt-image-2:2K']);

describe('guarda de margem dos créditos', () => {
  it('nenhum tier vende abaixo do custo (fora da lista conhecida)', () => {
    const underwater: string[] = [];
    for (const t of CREDIT_COSTS) {
      if (t.category !== 'image' && t.category !== 'video') continue;
      const infra =
        t.category === 'video' ? VISANT_INFRA_COSTS.VIDEO_TOTAL : VISANT_INFRA_COSTS.IMAGE_TOTAL;
      const revenue = t.creditsRequired * FLOOR_USD_PER_CREDIT;
      if (revenue < t.googlePriceUSD + infra) underwater.push(`${t.modelId}:${t.resolution}`);
    }
    const unexpected = underwater.filter((k) => !KNOWN_UNDERWATER.has(k));
    expect(unexpected).toEqual([]);
  });

  it('a tabela bate com o preço do código nos modelos de imagem com preço publicado', () => {
    const modelos = ['gemini', 'imagen', 'gpt-image-2'];
    for (const t of CREDIT_COSTS) {
      if (t.category !== 'image' || !modelos.some((m) => t.modelId.includes(m))) continue;
      const res = t.resolution.replace(' (HD)', '').replace('HD', '1K');
      expect(getImagePricing(t.modelId, res), `${t.modelId} ${t.resolution}`).toBeCloseTo(
        t.googlePriceUSD,
        3
      );
    }
  });
});

describe('créditos de vídeo: UI e servidor cobram o mesmo', () => {
  const casos: Array<[string, string | undefined, number | undefined]> = [
    ['kling-v3', 'std', 5],
    ['kling-v3', 'pro', 5],
    ['kling-v3', '4k', 5],
    ['kling-v3-omni', 'pro', 10],
    ['kling-v2-5-turbo', 'std', 5],
    ['seedance-2-0', undefined, 5],
    ['seedance-1-0-lite', undefined, 5],
    ['veo-3.1-fast-generate-preview', undefined, 8],
    ['veo-3.1-generate-preview', undefined, 8],
  ];
  it.each(casos)('%s %s %ss', (model, klingMode, durationSec) => {
    expect(serverCredits(model, { klingMode, durationSec })).toBe(
      uiCredits(model, klingMode, durationSec)
    );
  });

  it('Kling pro/4k deixam de ser cobrados como std (bug do servidor)', () => {
    expect(serverCredits('kling-v3', { klingMode: 'pro' })).toBe(30);
    expect(serverCredits('kling-v3', { klingMode: '4k' })).toBe(40);
    expect(serverCredits('kling-v3', { klingMode: 'std' })).toBe(20);
  });

  it('Kling escala com a duração acima de 5s e mantém o preço até 5s', () => {
    expect(uiCredits('kling-v3', 'std', 3)).toBe(20);
    expect(uiCredits('kling-v3', 'std', 5)).toBe(20);
    expect(uiCredits('kling-v3', 'std', 10)).toBe(40);
    expect(uiCredits('kling-v3', 'pro', 15)).toBe(90);
  });

  it('clipe Kling de qualquer duração cobre o custo do fal (US$ 0,14/s) no preço mínimo do crédito', () => {
    for (const sec of [5, 10, 15]) {
      const receita = uiCredits('kling-v3', 'std', sec) * FLOOR_USD_PER_CREDIT;
      expect(receita).toBeGreaterThan(sec * 0.14 + VISANT_INFRA_COSTS.VIDEO_TOTAL);
    }
  });
});

describe('videoProviderCostUsd', () => {
  it('não contabiliza mais Kling e Seedance como Veo standard de 8s (US$ 3,20)', () => {
    expect(videoProviderCostUsd('kling-v3', { klingMode: 'std', durationSec: 5 })).toBeCloseTo(
      0.7,
      4
    );
    expect(videoProviderCostUsd('kling-v3', { klingMode: 'pro', durationSec: 10 })).toBeCloseTo(
      1.4,
      4
    );
    expect(videoProviderCostUsd('seedance-2-0', { durationSec: 5 })).toBeCloseTo(0.92, 4);
  });

  it('Veo segue por segundo × duração', () => {
    expect(videoProviderCostUsd('veo-3.1-generate-preview', { durationSec: 8 })).toBeCloseTo(
      3.2,
      4
    );
    expect(videoProviderCostUsd('veo-3.1-fast-generate-preview', { durationSec: 8 })).toBeCloseTo(
      0.96,
      4
    );
    expect(videoProviderCostUsd('veo-3.1-generate-preview', { durationSec: 4 })).toBeCloseTo(
      1.6,
      4
    );
  });
});

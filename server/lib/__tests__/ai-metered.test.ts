/**
 * A LEI em teste: toda chamada que gasta grava um usage_record, e vídeo nunca custa 0.
 * Contexto: `.agent/plans/AI-SPEND-ACCOUNTING.md`
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertOne = vi.fn().mockResolvedValue({});

vi.mock('../../db/mongodb.js', () => ({
  connectToMongoDB: vi.fn().mockResolvedValue(undefined),
  getDb: () => ({ collection: () => ({ insertOne }) }),
}));

vi.mock('@google/genai', () => ({ GoogleGenAI: class {} }));

const { computeCost, meteredCall, measureGeminiResponse } = await import('../ai/metered.js');

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('computeCost', () => {
  it('cobra vídeo por segundo — o bug que gravou 11 registros de Veo em 0', () => {
    // 19 clipes de 5s da Axio no veo fast: o que a fatura viu e o app não.
    const cost = computeCost('veo-3.1-fast-generate-preview', { videos: 19, videoSeconds: 5 });
    expect(cost).toBeGreaterThan(0);
  });

  it('distingue veo fast de standard', () => {
    const fast = computeCost('veo-3.1-fast-generate-preview', { videos: 1, videoSeconds: 8 });
    const std = computeCost('veo-3.1-generate-preview', { videos: 1, videoSeconds: 8 });
    expect(std).toBeGreaterThan(fast);
  });

  it('soma imagem e token na mesma chamada', () => {
    const cost = computeCost('gemini-3-pro-image-preview', {
      images: 2,
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).toBeGreaterThan(0);
  });
});

describe('createUsageRecord — o caminho legado usa a MESMA conta', () => {
  it('não grava 0 num modelo pago', async () => {
    const { createUsageRecord } = await import('../../utils/usageTracking.js');
    const rec = createUsageRecord('u1', 2, 'gemini-3-pro-image-preview', false, 10, '4K');
    expect(rec.cost).toBeGreaterThan(0);
  });

  it('cobra texto por token quando não há imagem', async () => {
    const { createUsageRecord } = await import('../../utils/usageTracking.js');
    const rec = createUsageRecord(
      'u1',
      0,
      'gemini-3-flash',
      false,
      10,
      undefined,
      undefined,
      'system',
      50_000,
      20_000
    );
    expect(rec.cost).toBeGreaterThan(0);
  });
});

describe('measureGeminiResponse', () => {
  it('lê usageMetadata e conta imagens inline dos dois SDKs', () => {
    const legado = {
      response: {
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40 },
        candidates: [{ content: { parts: [{ inlineData: { data: 'x' } }] } }],
      },
    };
    expect(measureGeminiResponse(legado)).toMatchObject({
      inputTokens: 100,
      outputTokens: 40,
      images: 1,
    });

    const novo = {
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
      candidates: [{ content: { parts: [{ text: 'oi' }] } }],
    };
    expect(measureGeminiResponse(novo)).toMatchObject({ inputTokens: 7, outputTokens: 3 });
  });
});

describe('meteredCall', () => {
  beforeEach(() => insertOne.mockClear());

  it('grava em sucesso', async () => {
    await meteredCall(
      { provider: 'gemini', model: 'gemini-3-pro-image-preview', operation: 't', userId: 'u1' },
      async () => ({ ok: true }),
      () => ({ images: 1 })
    );
    await flush();
    expect(insertOne).toHaveBeenCalledOnce();
    const doc = insertOne.mock.calls[0][0];
    expect(doc.outcome).toBe('ok');
    expect(doc.cost).toBeGreaterThan(0);
  });

  it('grava em erro — o provedor cobra a tentativa que falhou depois de gerar', async () => {
    await expect(
      meteredCall(
        {
          provider: 'gemini',
          model: 'veo-3.1-generate-preview',
          operation: 't',
          usage: { videos: 1, videoSeconds: 8 },
        },
        async () => {
          throw new Error('429 prepayment credits are depleted');
        }
      )
    ).rejects.toThrow('429');

    await flush();
    expect(insertOne).toHaveBeenCalledOnce();
    const doc = insertOne.mock.calls[0][0];
    expect(doc.outcome).toBe('error');
    expect(doc.cost).toBeGreaterThan(0);
    expect(doc.error).toContain('429');
  });

  it('falha de gravação não derruba a geração', async () => {
    insertOne.mockRejectedValueOnce(new Error('mongo caiu'));
    const r = await meteredCall(
      { provider: 'gemini', model: 'gemini-3-flash', operation: 't' },
      async () => 'entregue',
      () => ({ inputTokens: 10, outputTokens: 5 })
    );
    expect(r).toBe('entregue');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A extração de marca é o motor do ingest (`POST /brand-guidelines/:id/ingest`).
 * Em 17/ago/2026 ela caiu inteira porque falava DIRETO com o Gemini e a quota
 * estourou — com uma cascata multi-provider já existindo no repo. Estes testes
 * prendem o contrato novo: quem faz a chamada é a cascata, e falha dela vira
 * mensagem que o usuário entende.
 */
type Opts = Record<string, any>;

async function load(completeText: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.doMock('../ai-providers/cheapText.js', () => ({ completeText }));
  return import('../brand-extract.js');
}

/** Opções com que a cascata foi chamada na n-ésima vez. */
function optsOf(fn: ReturnType<typeof vi.fn>, n = 0): Opts {
  return (fn.mock.calls[n] as unknown as Opts[])[0];
}

const served = (text: string) =>
  vi.fn(async () => ({ text, provider: 'gemini', model: 'gemini-3-flash-preview' }));

const CHUNKS = [{ source: 'brand.pdf', type: 'pdf', text: 'Marca X. Azul #0B1F3A.' } as any];

beforeEach(() => vi.clearAllMocks());

describe('extractBrandData', () => {
  it('goes through the cascade, not straight to one provider', async () => {
    const completeText = served('{"identity":{"name":"Marca X"}}');
    const { extractBrandData } = await load(completeText);

    const out = await extractBrandData(CHUNKS, undefined, 'user-1');

    expect(completeText).toHaveBeenCalledTimes(1);
    const opts = optsOf(completeText);
    // Extração é resultado PAGO (1 crédito) — não pode cair no tier barato.
    expect(opts.tier).toBe('quality');
    expect(opts.operation).toBe('brand-extract');
    expect(opts.userId).toBe('user-1'); // senão o BYOK do usuário não é usado
    expect(out.identity?.name).toBe('Marca X');
  });

  it('forwards images so the cascade restricts itself to providers that see', async () => {
    const completeText = served('{}');
    const { extractBrandData } = await load(completeText);

    await extractBrandData(CHUNKS, ['data:image/png;base64,AAA']);

    expect(optsOf(completeText).images).toEqual(['data:image/png;base64,AAA']);
  });

  it('gives room for the full JSON — persona e manifesto não cabem em 1k tokens', async () => {
    const completeText = served('{}');
    const { extractBrandData } = await load(completeText);
    await extractBrandData(CHUNKS);
    expect(optsOf(completeText).maxTokens).toBeGreaterThanOrEqual(8192);
  });

  it('reads JSON that came back inside a markdown fence', async () => {
    const completeText = served('```json\n{"identity":{"name":"Marca X"}}\n```');
    const { extractBrandData } = await load(completeText);
    expect((await extractBrandData(CHUNKS)).identity?.name).toBe('Marca X');
  });

  it('maps a dead cascade to extraction_unavailable (503), not a raw 500', async () => {
    const completeText = vi.fn(async () => {
      throw new Error('cheaptext_unavailable: all providers failed/cooling-down');
    });
    const { extractBrandData } = await load(completeText);

    await expect(extractBrandData(CHUNKS)).rejects.toThrow(/^extraction_unavailable/);
  });

  it('a bad source stays extraction_failed (502) — não é indisponibilidade', async () => {
    const completeText = served('isto não é json');
    const { extractBrandData } = await load(completeText);

    await expect(extractBrandData(CHUNKS)).rejects.toThrow(/^extraction_failed/);
  });

  // O bug que a LEI dos créditos já cobria: falha NUNCA pode virar `{}`, senão o
  // caller cobra o crédito e reporta "não encontrei nada" pra uma chamada que caiu.
  it('never swallows a failure into an empty result', async () => {
    const completeText = vi.fn(async () => {
      throw new Error('boom');
    });
    const { extractBrandData } = await load(completeText);
    await expect(extractBrandData(CHUNKS)).rejects.toThrow();
  });
});

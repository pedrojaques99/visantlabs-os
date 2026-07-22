import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Load the router fresh each time so its module-scoped cooldown map doesn't leak
 * across cases. Mocks env + key helpers + safeFetch.
 */
async function load(
  envOverrides: Record<string, string | undefined>,
  fetchImpl: (url: string) => any
) {
  vi.resetModules();
  vi.doMock('../../../config/env.js', () => ({ env: { ...envOverrides } }));
  vi.doMock('../../../utils/geminiApiKey.js', () => ({
    getGeminiApiKey: async () => envOverrides.GEMINI_API_KEY,
  }));
  vi.doMock('../../../utils/openAiApiKey.js', () => ({
    getOpenAiApiKey: async () => envOverrides.OPENAI_API_KEY,
  }));
  // `init` é declarado porque os testes de tier inspecionam o body enviado.
  const safeFetch = vi.fn((url: string, _init?: unknown) => Promise.resolve(fetchImpl(url)));
  vi.doMock('../../../utils/securityValidation.js', () => ({ safeFetch }));
  const mod = await import('../cheapText.js');
  return { mod, safeFetch };
}

const ok = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
  text: async () => content,
});
const fail = (status: number) => ({ ok: false, status, text: async () => 'err' });

beforeEach(() => vi.clearAllMocks());

describe('cheapText router', () => {
  it('cascades past a failing cheap provider to the next available one', async () => {
    const { mod, safeFetch } = await load({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'gm' }, (url) =>
      url.includes('groq') ? fail(500) : ok('{"ok":true}')
    );
    const res = await mod.completeCheapText({ system: 's', user: 'u', json: true });
    expect(res.provider).toBe('gemini'); // groq failed → cascaded
    expect(safeFetch).toHaveBeenCalledTimes(2); // tried groq then gemini
    expect(mod.parseJsonLoose(res.text)).toEqual({ ok: true });
  });

  it('tries cheapest (groq) before paid (openai) by cost order', async () => {
    const calls: string[] = [];
    const { mod } = await load({ GROQ_API_KEY: 'g', OPENAI_API_KEY: 'o' }, (url) => {
      calls.push(url.includes('groq') ? 'groq' : url.includes('openai') ? 'openai' : 'other');
      return ok('hi');
    });
    const res = await mod.completeCheapText({ system: 's', user: 'u' });
    expect(res.provider).toBe('groq');
    expect(calls[0]).toBe('groq');
  });

  it('honors TEXT_GEN_PRIMARY to jump a provider to the front', async () => {
    const calls: string[] = [];
    const { mod } = await load(
      { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'gm', TEXT_GEN_PRIMARY: 'gemini' },
      (url) => {
        calls.push(url.includes('generativelanguage') ? 'gemini' : 'groq');
        return ok('hi');
      }
    );
    const res = await mod.completeCheapText({ system: 's', user: 'u' });
    expect(res.provider).toBe('gemini');
    expect(calls[0]).toBe('gemini');
  });

  it('skips unconfigured providers entirely (no key = no call)', async () => {
    const { mod, safeFetch } = await load(
      { GEMINI_API_KEY: 'gm' }, // only gemini keyed
      () => ok('hi')
    );
    const res = await mod.completeCheapText({ system: 's', user: 'u' });
    expect(res.provider).toBe('gemini');
    expect(safeFetch).toHaveBeenCalledTimes(1); // never called groq/cerebras/etc.
  });

  it('throws cheaptext_unavailable when nothing is configured', async () => {
    const { mod } = await load({}, () => ok('hi'));
    await expect(mod.completeCheapText({ system: 's', user: 'u' })).rejects.toThrow(
      /cheaptext_unavailable: no provider configured/
    );
  });

  it('throws cheaptext_unavailable when every configured provider fails', async () => {
    const { mod } = await load({ GROQ_API_KEY: 'g', GEMINI_API_KEY: 'gm' }, () => fail(500));
    await expect(mod.completeCheapText({ system: 's', user: 'u' })).rejects.toThrow(
      /cheaptext_unavailable: all providers failed/
    );
  });

  // ── Tier de qualidade ──────────────────────────────────────────────────────
  // Rotas pagas (naming) não podem rodar no modelo mais barato só porque
  // passaram a usar a cascata.

  it('quality tier upgrades the model where the provider has a stronger one', async () => {
    const { mod, safeFetch } = await load({ OPENAI_API_KEY: 'o' }, () => ok('hi'));
    await mod.completeText({ system: 's', user: 'u', tier: 'quality' });
    expect(JSON.parse((safeFetch.mock.calls[0][1] as any).body).model).toBe('gpt-4o');
  });

  it('cheap tier keeps the small model', async () => {
    const { mod, safeFetch } = await load({ OPENAI_API_KEY: 'o' }, () => ok('hi'));
    await mod.completeText({ system: 's', user: 'u', tier: 'cheap' });
    expect(JSON.parse((safeFetch.mock.calls[0][1] as any).body).model).toBe('gpt-4o-mini');
  });

  it('completeCheapText still defaults to the cheap tier (legacy callers unchanged)', async () => {
    const { mod, safeFetch } = await load({ OPENAI_API_KEY: 'o' }, () => ok('hi'));
    await mod.completeCheapText({ system: 's', user: 'u' });
    expect(JSON.parse((safeFetch.mock.calls[0][1] as any).body).model).toBe('gpt-4o-mini');
  });

  // ── BYOK ───────────────────────────────────────────────────────────────────
  // Quem cobra crédito lê `usedUserKey`. Marcar a chave da PLATAFORMA como BYOK
  // faria a geração sair de graça.

  it('reports usedUserKey=false when the platform key served', async () => {
    vi.resetModules();
    vi.doMock('../../../config/env.js', () => ({ env: { GEMINI_API_KEY: 'platform' } }));
    vi.doMock('../../../utils/geminiApiKey.js', () => ({
      // skipFallback = "só a do usuário" → undefined: este user não tem BYOK.
      getGeminiApiKey: async (_u?: string, o: { skipFallback?: boolean } = {}) =>
        o.skipFallback ? undefined : 'platform',
    }));
    vi.doMock('../../../utils/openAiApiKey.js', () => ({ getOpenAiApiKey: async () => undefined }));
    vi.doMock('../../../utils/securityValidation.js', () => ({
      safeFetch: vi.fn(() => Promise.resolve(ok('hi'))),
    }));
    const mod = await import('../cheapText.js');
    const res = await mod.completeText({ system: 's', user: 'u', userId: 'u1' });
    expect(res.provider).toBe('gemini');
    expect(res.usedUserKey).toBe(false);
  });

  it('reports usedUserKey=true when the user own key served', async () => {
    vi.resetModules();
    vi.doMock('../../../config/env.js', () => ({ env: { GEMINI_API_KEY: 'platform' } }));
    vi.doMock('../../../utils/geminiApiKey.js', () => ({
      getGeminiApiKey: async () => 'user-own-key', // BYOK em ambos os modos
    }));
    vi.doMock('../../../utils/openAiApiKey.js', () => ({ getOpenAiApiKey: async () => undefined }));
    vi.doMock('../../../utils/securityValidation.js', () => ({
      safeFetch: vi.fn(() => Promise.resolve(ok('hi'))),
    }));
    const mod = await import('../cheapText.js');
    const res = await mod.completeText({ system: 's', user: 'u', userId: 'u1' });
    expect(res.usedUserKey).toBe(true);
  });

  it('never reports BYOK for a provider that has no user keys (groq)', async () => {
    const { mod } = await load({ GROQ_API_KEY: 'g' }, () => ok('hi'));
    const res = await mod.completeText({ system: 's', user: 'u', userId: 'u1' });
    expect(res.provider).toBe('groq');
    expect(res.usedUserKey).toBe(false);
  });

  // ── O cenário do pedido ────────────────────────────────────────────────────

  it('survives Gemini being down — the whole reason this router exists', async () => {
    const { mod } = await load(
      { GEMINI_API_KEY: 'gm', GROQ_API_KEY: 'g', TEXT_GEN_PRIMARY: 'gemini' },
      (url) => (url.includes('generativelanguage') ? fail(503) : ok('{"names":[]}'))
    );
    const res = await mod.completeText({ system: 's', user: 'u', tier: 'quality', json: true });
    expect(res.provider).toBe('groq'); // gemini caiu, a cascata serviu
  });

  // Sem isto o seletor de modelo da UI é decorativo: a cascata tentaria o mais
  // barato primeiro e a escolha do usuário só valeria quando ele falhasse.
  it('preferProvider jumps the chosen provider ahead of cheaper ones', async () => {
    const calls: string[] = [];
    const { mod } = await load({ GROQ_API_KEY: 'g', OPENAI_API_KEY: 'o' }, (url) => {
      calls.push(url.includes('groq') ? 'groq' : 'openai');
      return ok('hi');
    });
    const res = await mod.completeText({ system: 's', user: 'u', preferProvider: 'openai' });
    expect(res.provider).toBe('openai');
    expect(calls[0]).toBe('openai'); // groq é mais barato, mas não foi escolhido
  });

  it('preferProvider still falls back when the chosen provider is down', async () => {
    // Cuidado: a base do Groq é `api.groq.com/openai/v1` — casar por 'openai'
    // derrubaria os dois. Casar pelo host da OpenAI.
    const { mod } = await load({ GROQ_API_KEY: 'g', OPENAI_API_KEY: 'o' }, (url) =>
      url.includes('api.openai.com') ? fail(503) : ok('hi')
    );
    const res = await mod.completeText({ system: 's', user: 'u', preferProvider: 'openai' });
    expect(res.provider).toBe('groq'); // preferir não é exclusividade
  });

  it('preferProvider outranks TEXT_GEN_PRIMARY (user choice wins over config)', async () => {
    const calls: string[] = [];
    const { mod } = await load(
      { GROQ_API_KEY: 'g', OPENAI_API_KEY: 'o', TEXT_GEN_PRIMARY: 'groq' },
      (url) => {
        calls.push(url.includes('groq') ? 'groq' : 'openai');
        return ok('hi');
      }
    );
    await mod.completeText({ system: 's', user: 'u', preferProvider: 'openai' });
    expect(calls[0]).toBe('openai');
  });

  // ── JSON Schema ────────────────────────────────────────────────────────────
  // Substitui o `responseSchema` do Gemini nas rotas que migram. Onde o provider
  // suporta, o shape é garantido; onde não, o schema vai no prompt — sem isso o
  // fallback devolveria QUALQUER JSON válido e o caller quebraria no campo.

  const SCHEMA = {
    name: 'palette',
    schema: {
      type: 'object',
      properties: { colors: { type: 'array', items: { type: 'string' } } },
      required: ['colors'],
    },
  };

  it('uses native json_schema on a provider that supports it', async () => {
    const { mod, safeFetch } = await load({ OPENAI_API_KEY: 'o' }, () => ok('{}'));
    await mod.completeText({ system: 's', user: 'u', jsonSchema: SCHEMA });
    const body = JSON.parse((safeFetch.mock.calls[0][1] as any).body);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.name).toBe('palette');
    // Provider garante o shape → não polui o system prompt.
    expect(body.messages[0].content).toBe('s');
  });

  it('falls back to json_object AND injects the schema into the prompt', async () => {
    const { mod, safeFetch } = await load({ GROQ_API_KEY: 'g' }, () => ok('{}'));
    await mod.completeText({ system: 's', user: 'u', jsonSchema: SCHEMA });
    const body = JSON.parse((safeFetch.mock.calls[0][1] as any).body);
    expect(body.response_format.type).toBe('json_object'); // groq não faz json_schema
    // Sem isto o shape se perderia silenciosamente no fallback.
    expect(body.messages[0].content).toContain('JSON Schema');
    expect(body.messages[0].content).toContain('colors');
  });

  it('same schema survives a fallback between providers', async () => {
    const { mod, safeFetch } = await load(
      { OPENAI_API_KEY: 'o', GROQ_API_KEY: 'g', TEXT_GEN_PRIMARY: 'openai' },
      (url) => (url.includes('api.openai.com') ? fail(503) : ok('{}'))
    );
    const res = await mod.completeText({ system: 's', user: 'u', jsonSchema: SCHEMA });
    expect(res.provider).toBe('groq');
    const groqBody = JSON.parse((safeFetch.mock.calls[1][1] as any).body);
    expect(groqBody.messages[0].content).toContain('colors'); // shape preservado
  });

  it('plain json:true still works (no schema)', async () => {
    const { mod, safeFetch } = await load({ GROQ_API_KEY: 'g' }, () => ok('{}'));
    await mod.completeText({ system: 's', user: 'u', json: true });
    const body = JSON.parse((safeFetch.mock.calls[0][1] as any).body);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toBe('s');
  });

  // ── BYOK por parâmetro ─────────────────────────────────────────────────────
  // Destrava as funções do geminiService que recebem `apiKey` do caller. Sem
  // isto, migrá-las faria o usuário com chave própria gastar a chave da
  // plataforma — e como as rotas cobram por `isUserApiKey`, a plataforma pagaria
  // a conta em silêncio.

  it('apiKeyOverride uses the caller key and reports usedUserKey', async () => {
    const { mod, safeFetch } = await load({ GROQ_API_KEY: 'g' }, () => ok('hi'));
    const res = await mod.completeText({
      system: 's',
      user: 'u',
      apiKeyOverride: { provider: 'gemini', key: 'user-own-gemini-key' },
    });
    expect(res.provider).toBe('gemini');
    expect(res.usedUserKey).toBe(true); // senão a cobrança sairia errada
    const headers = (safeFetch.mock.calls[0][1] as any).headers;
    expect(headers.Authorization).toBe('Bearer user-own-gemini-key');
  });

  it('apiKeyOverride jumps its provider to the front', async () => {
    const calls: string[] = [];
    const { mod } = await load({ GROQ_API_KEY: 'g' }, (url) => {
      calls.push(url.includes('groq') ? 'groq' : 'gemini');
      return ok('hi');
    });
    await mod.completeText({
      system: 's',
      user: 'u',
      apiKeyOverride: { provider: 'gemini', key: 'k' },
    });
    expect(calls[0]).toBe('gemini'); // groq é mais barato e tem chave, mas cede
  });

  // O ponto do desenho: BYOK e fallback coexistem em vez de um anular o outro.
  it('still falls back to platform keys when the user key fails', async () => {
    const { mod } = await load({ GROQ_API_KEY: 'g' }, (url) =>
      url.includes('generativelanguage') ? fail(401) : ok('hi')
    );
    const res = await mod.completeText({
      system: 's',
      user: 'u',
      apiKeyOverride: { provider: 'gemini', key: 'chave-invalida' },
    });
    expect(res.provider).toBe('groq');
    expect(res.usedUserKey).toBe(false); // quem serviu foi a plataforma
  });

  it('passes through provider token usage for analytics', async () => {
    vi.resetModules();
    vi.doMock('../../../config/env.js', () => ({ env: { GROQ_API_KEY: 'g' } }));
    vi.doMock('../../../utils/geminiApiKey.js', () => ({ getGeminiApiKey: async () => undefined }));
    vi.doMock('../../../utils/openAiApiKey.js', () => ({ getOpenAiApiKey: async () => undefined }));
    vi.doMock('../../../utils/securityValidation.js', () => ({
      safeFetch: vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'hi' } }],
            usage: { total_tokens: 1234 },
          }),
          text: async () => 'hi',
        })
      ),
    }));
    const mod = await import('../cheapText.js');
    expect((await mod.completeText({ system: 's', user: 'u' })).tokens).toBe(1234);
  });

  it('parseJsonLoose handles fenced, raw, and prose-wrapped JSON', async () => {
    const { mod } = await load({ GROQ_API_KEY: 'g' }, () => ok('x'));
    expect(mod.parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(mod.parseJsonLoose('here: [1,2,3] done')).toEqual([1, 2, 3]);
    expect(mod.parseJsonLoose('not json')).toBeNull();
  });
});

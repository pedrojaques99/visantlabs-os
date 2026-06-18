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
  const safeFetch = vi.fn((url: string) => Promise.resolve(fetchImpl(url)));
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

  it('parseJsonLoose handles fenced, raw, and prose-wrapped JSON', async () => {
    const { mod } = await load({ GROQ_API_KEY: 'g' }, () => ok('x'));
    expect(mod.parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(mod.parseJsonLoose('here: [1,2,3] done')).toEqual([1, 2, 3]);
    expect(mod.parseJsonLoose('not json')).toBeNull();
  });
});

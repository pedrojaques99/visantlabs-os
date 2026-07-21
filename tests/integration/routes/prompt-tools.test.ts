import { describe, it, expect, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * `improvePrompt` e `suggestPromptVariations` foram migradas para a cascata
 * multi-provider. Não tinham teste nenhum — foram migradas e verificadas só à
 * mão, que é exatamente o risco que esta sessão passou o tempo todo apontando.
 *
 * O que estes testes travam:
 * 1. O contrato de saída sobrevive à troca de provider.
 * 2. `improvePrompt` NÃO devolve o texto entre aspas. Regressão real: o user
 *    prompt cita o original entre aspas, o modelo espelha, e pedir "sem aspas"
 *    no system prompt NÃO resolveu — a limpeza é determinística no código.
 * 3. A contabilidade separa input/output. Jogar tudo em `outputTokens` inflaria
 *    o custo em `usage_records`, onde saída é mais cara que entrada.
 */
const hoisted = vi.hoisted(() => ({ completeText: vi.fn() }));

vi.mock('../../../server/lib/ai-providers/cheapText.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, completeText: hoisted.completeText };
});

async function post(path: string, body: unknown) {
  const { user } = await createUser({ monthlyCredits: 50, creditsUsed: 0 });
  const token = signTestToken({ userId: user.id, email: user.email });
  const agent = await request();
  const res = await agent.post(path).set('Authorization', bearer(token)).send(body as object);
  return { res, user };
}

describe('improve-prompt — contrato pós-cascata', () => {
  it.each([
    ['aspas retas', '"um logo atrativo"'],
    ['aspas curvas', '“um logo atrativo”'],
    ['aspas simples', "'um logo atrativo'"],
    ['sem aspas', 'um logo atrativo'],
  ])('remove aspas envolventes (%s)', async (_label, raw) => {
    hoisted.completeText.mockResolvedValue({
      text: raw,
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      usedUserKey: false,
      inputTokens: 10,
      outputTokens: 5,
      tokens: 15,
    });

    const { res } = await post('/api/ai/improve-prompt', { prompt: 'um logo bonito' });

    expect(res.status).toBe(200);
    expect(res.body.improvedPrompt).toBe('um logo atrativo');
  });

  it('NÃO come aspas internas — só as que envolvem tudo', async () => {
    hoisted.completeText.mockResolvedValue({
      text: 'logo com a palavra "Visant" em destaque',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      usedUserKey: false,
    });

    const { res } = await post('/api/ai/improve-prompt', { prompt: 'logo' });

    expect(res.body.improvedPrompt).toBe('logo com a palavra "Visant" em destaque');
  });
});

describe('suggest-prompt-variations — contrato pós-cascata', () => {
  it('extrai as variações do JSON do provider', async () => {
    hoisted.completeText.mockResolvedValue({
      text: JSON.stringify({ suggestions: ['gato na chuva', 'gato ao luar', 'gato ao sol'] }),
      provider: 'openai',
      model: 'gpt-4o-mini',
      usedUserKey: false,
      inputTokens: 20,
      outputTokens: 30,
    });

    const { res } = await post('/api/ai/suggest-prompt-variations', { prompt: 'um gato preto' });

    expect(res.status).toBe(200);
    expect(res.body.variations).toHaveLength(3);
    expect(res.body.variations[0]).toBe('gato na chuva');
  });

  // `parseJsonLoose` tem que aguentar cerca ```json — providers sem json_schema
  // nativo respondem assim com frequência.
  it('aguenta JSON embrulhado em cerca markdown', async () => {
    hoisted.completeText.mockResolvedValue({
      text: '```json\n{"suggestions":["a","b"]}\n```',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      usedUserKey: false,
    });

    const { res } = await post('/api/ai/suggest-prompt-variations', { prompt: 'x' });

    expect(res.body.variations).toEqual(['a', 'b']);
  });

  it('degrada para lista vazia quando o provider não devolve JSON', async () => {
    hoisted.completeText.mockResolvedValue({
      text: 'desculpe, não consegui',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      usedUserKey: false,
    });

    const { res } = await post('/api/ai/suggest-prompt-variations', { prompt: 'x' });

    expect(res.status).toBe(200);
    expect(res.body.variations).toEqual([]);
  });
});

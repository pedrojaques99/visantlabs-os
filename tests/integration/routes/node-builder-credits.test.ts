import { describe, it, expect, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * Caminho do DINHEIRO do node-builder.
 *
 * As duas rotas (`/generate` e `/shader-params`) cobravam 1 crédito ANTES de
 * chamar a IA e **nunca estornavam**: qualquer falha do provider queimava o
 * crédito do usuário em silêncio. `/shader-params` era pior — o `JSON.parse`
 * cru de uma resposta não-JSON estourava direto para o 500, também sem estorno.
 *
 * A falha é injetada POR DENTRO da cascata (zerando os resolvers de chave), o
 * mesmo padrão de `naming-generate-refund.test.ts` — exercita o código real e
 * evita o ruído de mockar `completeText` ou `safeFetch`.
 */
vi.mock('../../../server/utils/geminiApiKey.js', () => ({
  getGeminiApiKey: async () => undefined,
}));
vi.mock('../../../server/utils/openAiApiKey.js', () => ({
  getOpenAiApiKey: async () => undefined,
}));

// Providers env-only sem chave em dev/CI — ver teste de pré-condição abaixo.
const ENV_ONLY_KEYS = [
  'GROQ_API_KEY',
  'CEREBRAS_API_KEY',
  'NVIDIA_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

async function creditsUsed(userId: string): Promise<number> {
  const { prisma } = await import('../../../server/db/prisma.js');
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsUsed: true },
  });
  return u?.creditsUsed ?? -1;
}

async function post(path: string, userId: string, email: string, body: unknown) {
  const token = signTestToken({ userId, email });
  const agent = await request();
  return agent.post(path).set('Authorization', bearer(token)).send(body as object);
}

const GENERATE_BODY = { messages: [{ role: 'user', content: 'um node que inverte cores' }] };
const SHADER_BODY = { description: 'ondas líquidas' };

describe('node-builder — cobrança e estorno', () => {
  it('precondição: nenhum provider env-only tem chave neste ambiente', () => {
    for (const key of ENV_ONLY_KEYS) {
      expect(process.env[key] || '', `${key} configurado quebra a premissa`).toBe('');
    }
  });

  // A regressão: cobrava e não devolvia.
  it('/generate ESTORNA quando a cascata falha', async () => {
    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });

    const res = await post('/api/node-builder/generate', user.id, user.email, GENERATE_BODY);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/estornado/i);
    expect(await creditsUsed(user.id)).toBe(0);
  });

  it('/shader-params ESTORNA quando a cascata falha', async () => {
    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });

    const res = await post('/api/node-builder/shader-params', user.id, user.email, SHADER_BODY);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/estornado/i);
    expect(await creditsUsed(user.id)).toBe(0);
  });

  it('/generate sem saldo é barrado antes de gastar qualquer coisa', async () => {
    const { user } = await createUser({ monthlyCredits: 1, creditsUsed: 1 });

    const res = await post('/api/node-builder/generate', user.id, user.email, GENERATE_BODY);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(503); // barrado no saldo, não na cascata
    expect(await creditsUsed(user.id)).toBe(1);
  });

  it('valida o payload ANTES de cobrar — request inválido não custa crédito', async () => {
    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });

    const res = await post('/api/node-builder/generate', user.id, user.email, { messages: [] });

    expect(res.status).toBe(400);
    expect(await creditsUsed(user.id)).toBe(0);
  });
});

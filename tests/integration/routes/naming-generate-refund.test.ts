import { describe, it, expect, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * ESTORNO do `POST /ai/generate-naming`.
 *
 * O crédito é cobrado ANTES de gerar (é o portão de saldo). Se a geração falha
 * depois disso, o usuário paga por nada — era o que acontecia quando o Gemini
 * caía, já que a rota era Gemini-only e sem estorno.
 *
 * A falha é injetada POR DENTRO da cascata: zeramos os resolvers de chave, então
 * `completeText` percorre a lista real, não acha provider configurado e lança
 * `cheaptext_unavailable`. Exercita o código de verdade — sem mockar
 * `completeText` (o vitest reporta a rejeição do mock como falha do teste) e sem
 * mockar `safeFetch` (usado pelo app inteiro, trava tudo).
 *
 * Arquivo separado porque estes mocks são de módulo, logo valem para o arquivo
 * todo — não dá para conviver com os testes de sucesso.
 */
vi.mock('../../../server/utils/geminiApiKey.js', () => ({
  getGeminiApiKey: async () => undefined,
}));
vi.mock('../../../server/utils/openAiApiKey.js', () => ({
  getOpenAiApiKey: async () => undefined,
}));
// Os demais providers (groq/cerebras/nvidia/openrouter) são env-only e não têm
// chave em dev/CI, então zerar gemini+openai já esvazia a cascata. Mockar o
// módulo `env` inteiro NÃO funciona: o logger (pino) lê `env.LOG_LEVEL` no
// import e quebra com "default level:undefined".
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

async function postNaming(userId: string, email: string) {
  const token = signTestToken({ userId, email });
  const agent = await request();
  return (
    agent
      .post('/api/ai/generate-naming')
      .set('Authorization', bearer(token))
      // Filtro de domínio OFF: isola o caminho do crédito de chamadas RDAP reais.
      .send({ brief: 'consultoria', count: 3, settings: { availabilityFilter: 'off' } })
  );
}

describe('generate-naming — estorno quando a cascata inteira falha', () => {
  // Pré-condição explícita: se alguém adicionar uma chave desses providers no
  // ambiente, a cascata deixa de falhar e o teste viraria um falso-verde.
  it('precondição: nenhum provider env-only tem chave neste ambiente', () => {
    for (const key of ENV_ONLY_KEYS) {
      expect(process.env[key] || '', `${key} configurado quebra a premissa`).toBe('');
    }
  });

  it('devolve 503 e ESTORNA o crédito — usuário não paga por nada', async () => {
    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });

    const res = await postNaming(user.id, user.email);

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/estornado/i);
    // O ponto do teste: cobrado no portão, devolvido no erro.
    expect(await creditsUsed(user.id)).toBe(0);
  });

  it('não estorna a mais — usuário sem saldo sai com o mesmo saldo', async () => {
    const { user } = await createUser({ monthlyCredits: 1, creditsUsed: 1 });

    const res = await postNaming(user.id, user.email);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).not.toBe(503); // barrado no saldo, não na cascata
    expect(await creditsUsed(user.id)).toBe(1); // intacto
  });
});

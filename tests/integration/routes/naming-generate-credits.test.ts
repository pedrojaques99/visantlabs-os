import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * Caminho do DINHEIRO do `POST /ai/generate-naming`.
 *
 * O crédito é cobrado ANTES de gerar — de propósito: `chargeCredits` lança e é
 * isso que barra usuário sem saldo. O risco dessa ordem é o inverso: se a
 * geração falha depois da cobrança, o usuário paga por nada — era o que
 * acontecia quando o Gemini caía (a rota era Gemini-only, sem estorno).
 *
 * O estorno é testado em `naming-generate-refund.test.ts` — precisa derrubar a
 * cascata por dentro (sem chaves), o que é incompatível com o mock de sucesso
 * usado aqui, então vive em arquivo separado.
 */

const hoisted = vi.hoisted(() => ({ completeText: vi.fn() }));

vi.mock('../../../server/lib/ai-providers/cheapText.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, completeText: hoisted.completeText };
});

/** Lê o consumo de crédito direto do banco. */
async function creditsUsed(userId: string): Promise<number> {
  const { prisma } = await import('../../../server/db/prisma.js');
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsUsed: true },
  });
  return u?.creditsUsed ?? -1;
}

const body = {
  brief: 'consultoria de engenharia industrial',
  count: 4,
  // Filtro de domínio OFF: isola o caminho do crédito de chamadas RDAP reais.
  settings: { availabilityFilter: 'off' },
};

async function postNaming(userId: string, email: string) {
  const token = signTestToken({ userId, email });
  const agent = await request();
  return agent.post('/api/ai/generate-naming').set('Authorization', bearer(token)).send(body);
}

beforeEach(() => hoisted.completeText.mockReset());

describe('generate-naming — cobrança', () => {
  it('cobra exatamente 1 crédito quando a cascata entrega', async () => {
    hoisted.completeText.mockResolvedValue({
      text: JSON.stringify({
        names: [
          { name: 'GALVA', rationale: 'r', technique: 'blend', territory: 't', family: 'Romance' },
        ],
      }),
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      usedUserKey: false,
      tokens: 100,
    });

    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });
    const res = await postNaming(user.id, user.email);

    expect(res.status).toBe(200);
    expect(await creditsUsed(user.id)).toBe(1);
  });

  it('expõe qual provider serviu — a UI precisa saber quando houve fallback', async () => {
    hoisted.completeText.mockResolvedValue({
      text: JSON.stringify({ names: [] }),
      provider: 'openai',
      model: 'gpt-4o',
      usedUserKey: false,
    });

    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });
    const res = await postNaming(user.id, user.email);

    expect(res.status).toBe(200);
    expect(res.body.servedBy).toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  it('sem saldo, nem chama a IA — a cobrança é o portão', async () => {
    const { user } = await createUser({ monthlyCredits: 1, creditsUsed: 1 });
    const res = await postNaming(user.id, user.email);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(hoisted.completeText).not.toHaveBeenCalled();
  });
});

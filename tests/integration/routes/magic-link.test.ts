import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';

// Os casos de next disparam vários pedidos; o teto real (5) derrubaria a suíte.
process.env.RATE_LIMIT_MAX_MAGIC_LINK = '1000';

// Captura o link que iria no e-mail (o Resend não existe nos testes).
const enviados = vi.hoisted(() => [] as Array<{ loginUrl: string }>);
vi.mock('../../../server/services/emailService.js', async (original) => ({
  ...(await original<object>()),
  isEmailConfigured: () => true,
  sendMagicLinkEmail: async (args: { loginUrl: string }) => {
    enviados.push(args);
  },
}));
beforeEach(() => {
  enviados.length = 0;
});

/**
 * Link mágico: entrar pelo e-mail, sem senha.
 *
 * O que estes casos guardam é o contrato de segurança, não o e-mail (que nos
 * testes não sai, porque o Resend não está configurado): o pedido responde
 * igual exista a conta ou não, o token serve uma vez só, e vencido ou falso
 * não vira sessão.
 */

async function tokens() {
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb().collection('magic_link_tokens');
}

async function contaSemSenha(email: string) {
  const { prisma } = await import('../../../server/db/prisma.js');
  return prisma.user.create({ data: { email, entitlements: [] as any } as any });
}

describe('POST /api/auth/magic-link', () => {
  it('responde igual pra e-mail sem conta, e não cria token', async () => {
    const res = await (await request())
      .post('/api/auth/magic-link')
      .send({ email: 'ninguem@example.com', app: 'club' });

    expect(res.status).toBe(200);
    expect(await (await tokens()).countDocuments({ email: 'ninguem@example.com' })).toBe(0);
  });

  it('cria um token (só o hash) pra conta que existe', async () => {
    const user = await contaSemSenha('comprou@example.com');

    const res = await (await request())
      .post('/api/auth/magic-link')
      .send({ email: 'comprou@example.com', app: 'club' });

    expect(res.status).toBe(200);
    const doc = await (await tokens()).findOne({ userId: user.id });
    expect(doc, 'o token tinha que existir').toBeTruthy();
    expect(doc?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(doc?.usedAt).toBeNull();
  });
});

describe('POST /api/auth/magic-link com next', () => {
  it('sem next, o link é o de sempre', async () => {
    await contaSemSenha('sem-next@example.com');
    await (await request())
      .post('/api/auth/magic-link')
      .send({ email: 'sem-next@example.com', app: 'club' });
    expect(enviados).toHaveLength(1);
    expect(enviados[0].loginUrl).toMatch(/\/entrar\/link\?token=[A-Za-z0-9_-]+$/);
  });

  it('com next relativo, o link leva o destino codificado', async () => {
    await contaSemSenha('com-next@example.com');
    const res = await (await request())
      .post('/api/auth/magic-link')
      .send({ email: 'com-next@example.com', app: 'club', next: '/curso/ia?aula=2&x=1' });
    expect(res.status).toBe(200);
    expect(enviados[0].loginUrl).toContain(`&next=${encodeURIComponent('/curso/ia?aula=2&x=1')}`);
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'curso', '/' + 'a'.repeat(200)])(
    'recusa next fora de caminho relativo: %s',
    async (next) => {
      const res = await (await request())
        .post('/api/auth/magic-link')
        .send({ email: 'x@example.com', app: 'club', next });
      expect(res.status).toBe(400);
      expect(enviados).toHaveLength(0);
    }
  );
});

describe('POST /api/auth/magic-link/verify', () => {
  it('troca o token por sessão, e o mesmo token não serve de novo', async () => {
    const user = await contaSemSenha('entra@example.com');
    const { criarLinkMagico } = await import('../../../server/services/magicLinkService.js');
    const token = await criarLinkMagico(user.id, user.email);

    const primeira = await (await request()).post('/api/auth/magic-link/verify').send({ token });
    expect(primeira.status).toBe(200);
    expect(typeof primeira.body.token).toBe('string');
    expect(primeira.body.user.email).toBe('entra@example.com');

    const segunda = await (await request()).post('/api/auth/magic-link/verify').send({ token });
    expect(segunda.status).toBe(400);
  });

  it('recusa token vencido', async () => {
    const user = await contaSemSenha('atrasado@example.com');
    const { criarLinkMagico } = await import('../../../server/services/magicLinkService.js');
    const token = await criarLinkMagico(user.id, user.email);
    await (
      await tokens()
    ).updateOne({ userId: user.id }, { $set: { expiresAt: new Date(Date.now() - 60_000) } });

    const res = await (await request()).post('/api/auth/magic-link/verify').send({ token });
    expect(res.status).toBe(400);
  });

  it('recusa token que nunca existiu e token malformado', async () => {
    const agent = await request();
    const falso = await agent.post('/api/auth/magic-link/verify').send({ token: 'a'.repeat(43) });
    expect(falso.status).toBe(400);

    const torto = await agent.post('/api/auth/magic-link/verify').send({ token: '<script>' });
    expect(torto.status).toBe(400);
  });
});

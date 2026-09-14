import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';

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

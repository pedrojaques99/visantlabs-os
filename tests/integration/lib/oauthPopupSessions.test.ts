import { describe, it, expect } from 'vitest';
import {
  criarSessao,
  lerSessao,
  atualizarSessao,
  apagarSessao,
  entregarSessao,
} from '../../../server/lib/oauthPopupSessions.js';

/**
 * Sessões do popup no Mongo (Mongo em memória da suíte de integração).
 *
 * O que estes casos guardam: a sessão é vista por qualquer instância (está no
 * banco, não num Map), vencida não conta mesmo antes do TTL do Mongo passar,
 * e o token sai uma vez só.
 */

async function colecao() {
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb().collection('oauth_popup_sessions');
}

describe('oauthPopupSessions', () => {
  it('cria com TTL e índice de expiração', async () => {
    await criarSessao('s1', { source: 'club' });
    const s = await lerSessao('s1');
    expect(s?.source).toBe('club');
    expect(s!.expiresAt.getTime() - s!.createdAt.getTime()).toBe(5 * 60 * 1000);

    const indices = await (await colecao()).indexes();
    expect(indices.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });

  it('id repetido não sobrescreve sessão', async () => {
    await criarSessao('dup', { source: 'club' });
    await expect(criarSessao('dup', { source: 'plugin' })).rejects.toThrow();
  });

  it('poll: pending, depois complete uma vez só, depois expired', async () => {
    await criarSessao('s2', { source: 'club' });
    expect(await entregarSessao('s2')).toEqual({ status: 'pending' });

    expect(await atualizarSessao('s2', { token: 'jwt' })).toBeTruthy();
    expect(await entregarSessao('s2')).toEqual({ status: 'complete', token: 'jwt' });
    expect(await entregarSessao('s2')).toEqual({ status: 'expired' });
    // O JWT não fica no banco depois de entregue.
    expect(await (await colecao()).countDocuments({ _id: 's2' as any })).toBe(0);
  });

  it('poll concorrente entrega o token a um só', async () => {
    await criarSessao('s3', { source: 'club' });
    await atualizarSessao('s3', { token: 'jwt' });
    const r = await Promise.all([entregarSessao('s3'), entregarSessao('s3'), entregarSessao('s3')]);
    expect(r.filter((x) => x.status === 'complete')).toHaveLength(1);
  });

  it('erro chega ao poll e apaga a sessão', async () => {
    await criarSessao('s4', { source: 'plugin' });
    await atualizarSessao('s4', { error: 'oauth_failed' });
    expect(await entregarSessao('s4')).toEqual({ status: 'error', error: 'oauth_failed' });
    expect(await lerSessao('s4')).toBeNull();
  });

  it('vencida não conta, mesmo antes do TTL do Mongo apagar', async () => {
    await criarSessao('s5', { source: 'club' });
    await (
      await colecao()
    ).updateOne({ _id: 's5' as any }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await lerSessao('s5')).toBeNull();
    expect(await atualizarSessao('s5', { token: 'jwt' })).toBeNull();
    expect(await entregarSessao('s5')).toEqual({ status: 'expired' });
  });

  it('apagar devolve o returnTo uma vez', async () => {
    await criarSessao('s6', { returnTo: '/oauth/device' });
    expect((await apagarSessao('s6'))?.returnTo).toBe('/oauth/device');
    expect(await apagarSessao('s6')).toBeNull();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';

/**
 * Regressão: o consentimento não pode virar trampolim pra outro host.
 *
 * O ramo `deny` do POST /oauth/authorize redirecionava pro `redirect_uri` cru,
 * antes de conferir se ele é um dos registrados pelo client. O GET validava,
 * mas o POST é form comum — qualquer página podia postar aqui. Saía um open
 * redirect com a cara de api.visantlabs.com.
 */
const CLIENT_ID = 'test-client-deny-redirect';
const REGISTERED = 'https://app.example.com/callback';
const FOREIGN = 'https://evil.example.net/steal';

async function ensureClient() {
  const { prisma } = await import('../../../server/db/prisma.js');
  await prisma.oAuthClient.upsert({
    where: { clientId: CLIENT_ID },
    update: { redirectUris: [REGISTERED] },
    create: {
      clientId: CLIENT_ID,
      clientName: 'Test Client',
      redirectUris: [REGISTERED],
      grantTypes: ['authorization_code'],
    },
  });
}

describe('POST /oauth/authorize', () => {
  // A suíte limpa as coleções entre testes — o client tem de nascer em cada um.
  beforeEach(ensureClient);

  const form = (redirectUri: string, action: string) => ({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    code_challenge: 'a'.repeat(43),
    code_challenge_method: 'S256',
    state: 'xyz',
    action,
  });

  it('refuses to bounce a denial to an unregistered redirect_uri', async () => {
    const agent = await request();
    const res = await agent
      .post('/oauth/authorize')
      .type('form')
      .send(form(FOREIGN, 'deny'))
      .redirects(0);

    expect(res.status).toBe(400);
    expect(res.headers.location).toBeUndefined();
  });

  it('still bounces a denial to the registered redirect_uri', async () => {
    const agent = await request();
    const res = await agent
      .post('/oauth/authorize')
      .type('form')
      .send(form(REGISTERED, 'deny'))
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(REGISTERED);
    expect(res.headers.location).toContain('error=access_denied');
    expect(res.headers.location).toContain('state=xyz');
  });

  it('refuses an unregistered redirect_uri on approval too', async () => {
    const agent = await request();
    const res = await agent
      .post('/oauth/authorize')
      .type('form')
      .send(form(FOREIGN, 'approve'))
      .redirects(0);

    expect(res.status).toBe(400);
  });

  it('demands a session before minting a code', async () => {
    const agent = await request();
    const res = await agent
      .post('/oauth/authorize')
      .type('form')
      .send(form(REGISTERED, 'approve'))
      .redirects(0);

    // redirect_uri legítimo, mas sem token: 401, nunca um code.
    expect(res.status).toBe(401);
  });
});

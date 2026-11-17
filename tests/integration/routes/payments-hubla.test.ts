import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';

/**
 * A Hubla testa a URL ao criar a regra e recusa 404 (visto em 17/11/2026).
 * Estes testes garantem que o caminho existe e que evento sem token não passa.
 */
describe('POST /api/payments/hubla', () => {
  it('responde 200 ao ping sem corpo (validação da regra)', async () => {
    const agent = await request();
    const post = await agent.post('/api/payments/hubla').send({});
    expect(post.status).toBe(200);
    const get = await agent.get('/api/payments/hubla');
    expect(get.status).toBe(200);
  });

  it('recusa evento sem x-hubla-token', async () => {
    const agent = await request();
    const res = await agent
      .post('/api/payments/hubla')
      .set('Content-Type', 'application/json')
      .send({
        type: 'customer.member_added',
        event: {
          product: { id: 'l5WxBnTjVBoVJwWiIZG1' },
          subscription: { id: 'sub-x' },
          user: { email: 'x@exemplo.com' },
        },
      });
    expect(res.status).toBe(401);
  });
});

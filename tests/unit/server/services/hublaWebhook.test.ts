import { describe, it, expect, vi } from 'vitest';
import {
  handleHublaWebhook,
  tokenMatches,
  type HublaDeps,
} from '../../../../server/services/hublaWebhook';

const TOKEN = 'tok_certo';
const PRODUCT = 'l5WxBnTjVBoVJwWiIZG1';

class RevokedError extends Error {}

function deps(overrides: Partial<HublaDeps> = {}): HublaDeps {
  return {
    grantProduct: vi.fn(async () => ({ userId: 'u1', granted: true, created: true })),
    revokeProductGrant: vi.fn(async () => ({ revoked: true, already: false })),
    isRevokedError: (e) => e instanceof RevokedError,
    log: vi.fn(),
    ...overrides,
  };
}

function evento(type: string, extra: Record<string, unknown> = {}) {
  return {
    type,
    event: {
      product: { id: PRODUCT, name: 'IA Para Designers' },
      subscription: { id: 'sub-123', type: 'one_time' },
      user: { email: 'Aluno@Exemplo.com', firstName: 'Ana', lastName: 'Lima' },
      ...extra,
    },
    version: '2.0.0',
  };
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return { headers: { 'x-hubla-token': TOKEN, 'x-hubla-sandbox': 'false', ...headers }, body };
}

describe('tokenMatches', () => {
  it('aceita o token e qualquer um da lista (troca de token)', () => {
    expect(tokenMatches('a', 'a')).toBe(true);
    expect(tokenMatches('b', 'a, b')).toBe(true);
  });
  it('recusa vazio, diferente e env ausente', () => {
    expect(tokenMatches('', 'a')).toBe(false);
    expect(tokenMatches('x', 'a')).toBe(false);
    expect(tokenMatches('a', undefined)).toBe(false);
  });
});

describe('handleHublaWebhook', () => {
  it('ping sem tipo responde 200 sem token (validação da regra)', async () => {
    const d = deps();
    const r = await handleHublaWebhook({ headers: {}, body: {} }, d, TOKEN);
    expect(r.status).toBe(200);
    expect(d.grantProduct).not.toHaveBeenCalled();
  });

  it('evento com token errado é 401 e não libera', async () => {
    const d = deps();
    const r = await handleHublaWebhook(
      req(evento('customer.member_added'), { 'x-hubla-token': 'falso' }),
      d,
      TOKEN
    );
    expect(r.status).toBe(401);
    expect(d.grantProduct).not.toHaveBeenCalled();
  });

  it('evento sem HUBLA_WEBHOOK_TOKEN configurado é 401', async () => {
    const r = await handleHublaWebhook(req(evento('customer.member_added')), deps(), undefined);
    expect(r.status).toBe(401);
  });

  it('acesso concedido libera o sku com sessionId da assinatura', async () => {
    const d = deps();
    const r = await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(d.grantProduct).toHaveBeenCalledWith({
      email: 'Aluno@Exemplo.com',
      sku: 'ia-aplicada',
      sessionId: 'hubla:sub-123',
      source: 'hubla',
      name: 'Ana Lima',
    });
  });

  it('acesso removido revoga pela mesma chave', async () => {
    const d = deps();
    const r = await handleHublaWebhook(req(evento('customer.member_removed')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(d.revokeProductGrant).toHaveBeenCalledWith({ sessionId: 'hubla:sub-123' });
  });

  it('sandbox não libera nem revoga', async () => {
    const d = deps();
    const r = await handleHublaWebhook(
      req(evento('customer.member_added'), { 'x-hubla-sandbox': 'true' }),
      d,
      TOKEN
    );
    expect(r.status).toBe(200);
    expect(r.body.sandbox).toBe(true);
    expect(d.grantProduct).not.toHaveBeenCalled();
  });

  it('produto não mapeado e evento desconhecido são ignorados com 200', async () => {
    const d = deps();
    const outro = evento('customer.member_added', { product: { id: 'outro' } });
    expect((await handleHublaWebhook(req(outro), d, TOKEN)).body.ignored).toBe('product');
    expect(
      (await handleHublaWebhook(req(evento('invoice.payment_succeeded')), d, TOKEN)).body.ignored
    ).toBe('event');
    expect(d.grantProduct).not.toHaveBeenCalled();
  });

  it('sem subscription.id ou sem e-mail é 422 (reenviar não muda)', async () => {
    const semSub = evento('customer.member_added', { subscription: {} });
    expect((await handleHublaWebhook(req(semSub), deps(), TOKEN)).status).toBe(422);
    const semEmail = evento('customer.member_added', { user: {} });
    expect((await handleHublaWebhook(req(semEmail), deps(), TOKEN)).status).toBe(422);
  });

  it('removido antes do concedido: grant recusado vira 200 sem acesso', async () => {
    const d = deps({
      grantProduct: vi.fn(async () => {
        throw new RevokedError('revogada');
      }),
    });
    const r = await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ granted: false, revoked: true });
  });

  it('falha nossa é 500 pra Hubla tentar de novo', async () => {
    const d = deps({
      grantProduct: vi.fn(async () => {
        throw new Error('mongo fora');
      }),
    });
    const r = await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(500);
  });

  it('na 1ª liberação manda o link direto pro curso', async () => {
    const sendAccessLink = vi.fn(async () => {});
    const d = deps({ sendAccessLink });
    const r = await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(r.body.emailed).toBe(true);
    expect(sendAccessLink).toHaveBeenCalledWith({
      userId: 'u1',
      email: 'Aluno@Exemplo.com',
      name: 'Ana Lima',
      sku: 'ia-aplicada',
    });
  });

  it('reenvio do mesmo evento (já liberado) não manda e-mail de novo', async () => {
    const sendAccessLink = vi.fn(async () => {});
    const d = deps({
      sendAccessLink,
      grantProduct: vi.fn(async () => ({ userId: 'u1', granted: false, created: false })),
    });
    await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it('e-mail falhando não derruba a liberação (200)', async () => {
    const d = deps({
      sendAccessLink: vi.fn(async () => {
        throw new Error('resend fora');
      }),
    });
    const r = await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(r.body.emailed).toBe(false);
  });

  it('não loga o e-mail do comprador', async () => {
    const d = deps();
    await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    const logs = JSON.stringify((d.log as any).mock.calls);
    expect(logs).not.toContain('Exemplo.com');
  });
});

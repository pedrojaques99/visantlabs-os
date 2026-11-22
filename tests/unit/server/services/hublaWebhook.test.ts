import { describe, it, expect, vi } from 'vitest';
import {
  handleHublaWebhook,
  tokenMatches,
  type HublaDeps,
} from '../../../../server/services/hublaWebhook';
import {
  activateHublaClub,
  deactivateHublaClub,
  renewHublaClubCredits,
  CLUB_MONTHLY_CREDITS,
} from '../../../../server/services/hublaClubService';

const TOKEN = 'tok_certo';
const PRODUCT = 'l5WxBnTjVBoVJwWiIZG1';

class RevokedError extends Error {}

function deps(overrides: Partial<HublaDeps> = {}): HublaDeps {
  return {
    grantProduct: vi.fn(async () => ({ userId: 'u1', granted: true, created: true })),
    revokeProductGrant: vi.fn(async () => ({ revoked: true, already: false })),
    isRevokedError: (e) => e instanceof RevokedError,
    activateClub: vi.fn(async () => ({
      userId: 'u1',
      created: true,
      activated: true,
      creditsGranted: true,
    })),
    deactivateClub: vi.fn(async () => ({ deactivated: true, userId: 'u1' })),
    renewClubCredits: vi.fn(async () => ({ renewed: true, userId: 'u1' })),
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
      email: 'aluno@exemplo.com',
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
      // Normalizado desde 21/11/2026: o link e o envio recebiam o valor cru.
      email: 'aluno@exemplo.com',
      name: 'Ana Lima',
      acesso: expect.objectContaining({
        titulo: 'IA Labs',
        caminho: '/curso/ia-aplicada',
      }),
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

const CLUB = 'iUVlULNrtLYpKbVvBbzW';

function clubEvento(type: string, extra: Record<string, unknown> = {}) {
  return evento(type, {
    product: { id: CLUB, name: 'Visant Club' },
    subscription: {
      id: 'sub-club',
      type: 'recurring',
      status: 'active',
      billingCycleMonths: 1,
      lastInvoice: { id: 'inv-1', status: 'paid' },
    },
    ...extra,
  });
}

function fatura(invoiceId: string, productId = CLUB) {
  return {
    type: 'invoice.payment_succeeded',
    event: {
      product: { id: productId, name: 'Visant Club' },
      invoice: { id: invoiceId, subscriptionId: 'sub-club', status: 'paid' },
      user: { email: 'aluno@exemplo.com' },
    },
    version: '2.0.0',
  };
}

describe('handleHublaWebhook — e-books', () => {
  it.each([
    ['ABPdfoZXp66KtdDXSmpq', 'ebook-metodologia', 'Metodologia Visant'],
    ['n7U4EGH0THfVY5wMvQ5B', 'imersao-marca', 'A Imersão de Marca'],
    ['2cdlR0D3TekTpWhqhd6W', 'guia-de-call', 'Guia de call da Imersão'],
  ])('%s libera %s e o e-mail leva pra /p/<sku>', async (productId, sku, titulo) => {
    const sendAccessLink = vi.fn(async () => {});
    const d = deps({ sendAccessLink });
    const r = await handleHublaWebhook(
      req(evento('customer.member_added', { product: { id: productId } })),
      d,
      TOKEN
    );
    expect(r.status).toBe(200);
    expect(d.grantProduct).toHaveBeenCalledWith(
      expect.objectContaining({ sku, sessionId: 'hubla:sub-123', source: 'hubla' })
    );
    expect(sendAccessLink).toHaveBeenCalledWith(
      expect.objectContaining({
        acesso: expect.objectContaining({ titulo, caminho: `/p/${sku}`, botao: 'Abrir o e-book' }),
      })
    );
  });

  it('reembolso do e-book revoga pela chave da compra', async () => {
    const d = deps();
    await handleHublaWebhook(
      req(evento('customer.member_removed', { product: { id: 'ABPdfoZXp66KtdDXSmpq' } })),
      d,
      TOKEN
    );
    expect(d.revokeProductGrant).toHaveBeenCalledWith({ sessionId: 'hubla:sub-123' });
  });

  it('fatura paga de e-book é ignorada (libera pelo evento de Membro)', async () => {
    const d = deps();
    const r = await handleHublaWebhook(req(fatura('inv-x', 'ABPdfoZXp66KtdDXSmpq')), d, TOKEN);
    expect(r.body.ignored).toBe('event');
    expect(d.grantProduct).not.toHaveBeenCalled();
  });
});

describe('handleHublaWebhook — assinatura do Club', () => {
  it('member_added ativa o Club com a fatura que pagou e manda o link pro /dashboard', async () => {
    const sendAccessLink = vi.fn(async () => {});
    const d = deps({ sendAccessLink });
    const r = await handleHublaWebhook(req(clubEvento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(d.activateClub).toHaveBeenCalledWith({
      email: 'aluno@exemplo.com',
      name: 'Ana Lima',
      subscriptionId: 'sub-club',
      invoiceId: 'inv-1',
    });
    expect(d.grantProduct).not.toHaveBeenCalled();
    expect(sendAccessLink).toHaveBeenCalledWith(
      expect.objectContaining({
        acesso: expect.objectContaining({ titulo: 'Visant Club', caminho: '/dashboard' }),
      })
    );
    expect(r.body).toMatchObject({ activated: true, creditsGranted: true, emailed: true });
  });

  it('reenvio do member_added (já ativo) não manda e-mail de novo', async () => {
    const sendAccessLink = vi.fn(async () => {});
    const d = deps({
      sendAccessLink,
      activateClub: vi.fn(async () => ({
        userId: 'u1',
        created: false,
        activated: false,
        creditsGranted: false,
      })),
    });
    await handleHublaWebhook(req(clubEvento('customer.member_added')), d, TOKEN);
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it('conta que já paga por outro caminho não é tocada nem avisada', async () => {
    const sendAccessLink = vi.fn(async () => {});
    const d = deps({
      sendAccessLink,
      activateClub: vi.fn(async () => ({
        userId: 'u1',
        created: false,
        activated: false,
        creditsGranted: false,
        skipped: 'stripe-subscription' as const,
      })),
    });
    const r = await handleHublaWebhook(req(clubEvento('customer.member_added')), d, TOKEN);
    expect(r.body).toEqual({ activated: false, skipped: 'stripe-subscription' });
    expect(sendAccessLink).not.toHaveBeenCalled();
  });

  it('member_added com assinatura não ativa no payload não liga nada', async () => {
    const d = deps();
    const r = await handleHublaWebhook(
      req(
        clubEvento('customer.member_added', {
          subscription: { id: 'sub-club', type: 'recurring', status: 'inactive' },
        })
      ),
      d,
      TOKEN
    );
    expect(r.body.ignored).toBe('status');
    expect(d.activateClub).not.toHaveBeenCalled();
  });

  it('member_removed desativa pela assinatura', async () => {
    const d = deps();
    const r = await handleHublaWebhook(req(clubEvento('customer.member_removed')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(d.deactivateClub).toHaveBeenCalledWith({ subscriptionId: 'sub-club' });
    expect(d.revokeProductGrant).not.toHaveBeenCalled();
  });

  it('fatura paga renova os créditos pela fatura', async () => {
    const d = deps();
    const r = await handleHublaWebhook(req(fatura('inv-2')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(d.renewClubCredits).toHaveBeenCalledWith({
      subscriptionId: 'sub-club',
      invoiceId: 'inv-2',
    });
  });

  it('sandbox do Club não ativa, não desativa, não renova', async () => {
    const d = deps();
    const sb = { 'x-hubla-sandbox': 'true' };
    for (const body of [
      clubEvento('customer.member_added'),
      clubEvento('customer.member_removed'),
      fatura('inv-2'),
    ]) {
      const r = await handleHublaWebhook(req(body, sb), d, TOKEN);
      expect(r.body).toEqual({ sandbox: true, sku: 'club' });
    }
    expect(d.activateClub).not.toHaveBeenCalled();
    expect(d.deactivateClub).not.toHaveBeenCalled();
    expect(d.renewClubCredits).not.toHaveBeenCalled();
  });

  it('falha ao ativar é 500 pra Hubla tentar de novo', async () => {
    const d = deps({
      activateClub: vi.fn(async () => {
        throw new Error('mongo fora');
      }),
    });
    const r = await handleHublaWebhook(req(clubEvento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(500);
  });
});

// ── hublaClubService com um Mongo de mentira (só o que o serviço usa) ────────

type Doc = Record<string, any>;

function fakeDb(seed: Doc[] = []) {
  const cols: Record<string, Doc[]> = { users: seed, processed_payment_events: [] };
  const eq = (a: unknown, b: unknown) => String(a) === String(b);
  const matches = (d: Doc, f: Doc) => Object.entries(f).every(([k, v]) => eq(d[k], v));
  const collection = (name: string) => {
    const rows = (cols[name] ??= []);
    return {
      createIndex: async () => 'ok',
      findOne: async (f: Doc) => rows.find((d) => matches(d, f)) ?? null,
      insertOne: async (doc: Doc) => {
        if (rows.some((d) => d.provider === doc.provider && d.eventId === doc.eventId)) {
          throw Object.assign(new Error('dup'), { code: 11000 });
        }
        rows.push(doc);
        return { acknowledged: true };
      },
      deleteOne: async (f: Doc) => {
        const i = rows.findIndex((d) => matches(d, f));
        if (i >= 0) rows.splice(i, 1);
        return { deletedCount: i >= 0 ? 1 : 0 };
      },
      updateOne: async (f: Doc, op: { $set?: Doc; $unset?: Doc }) => {
        const d = rows.find((x) => matches(x, f));
        if (!d) return { modifiedCount: 0 };
        Object.assign(d, op.$set ?? {});
        for (const k of Object.keys(op.$unset ?? {})) delete d[k];
        return { modifiedCount: 1 };
      },
    };
  };
  return { db: { collection } as any, cols };
}

const ID = '64b7f0a1c2d3e4f5a6b7c8d9';
const NOW = new Date('2026-11-17T12:00:00Z');

function clubDeps(seed: Doc[]) {
  const { db, cols } = fakeDb(seed);
  return {
    cols,
    deps: {
      db,
      now: () => NOW,
      findOrCreateUser: vi.fn(async () => ({ id: ID, created: false })),
    },
  };
}

const usuarioFree = () => ({
  _id: ID,
  email: 'aluno@exemplo.com',
  subscriptionTier: 'free',
  subscriptionStatus: 'free',
  monthlyCredits: 20,
  creditsUsed: 15,
  subscriptionEndDate: new Date('2026-12-01'),
});

const ativar = { email: 'aluno@exemplo.com', subscriptionId: 'sub-club', invoiceId: 'inv-1' };

describe('hublaClubService', () => {
  it('ativa: tier club ativo, origem hubla, 60 créditos zerados, sem subscriptionEndDate', async () => {
    const { deps: d, cols } = clubDeps([usuarioFree()]);
    const r = await activateHublaClub(d, ativar);
    expect(r).toMatchObject({ activated: true, creditsGranted: true });
    const u = cols.users[0];
    expect(u).toMatchObject({
      subscriptionTier: 'club',
      subscriptionStatus: 'active',
      clubSource: 'hubla',
      hublaSubscriptionId: 'sub-club',
      monthlyCredits: CLUB_MONTHLY_CREDITS,
      creditsUsed: 0,
    });
    expect(u.creditsResetDate.toISOString()).toBe('2026-12-17T12:00:00.000Z');
    expect(u).not.toHaveProperty('subscriptionEndDate');
  });

  it('1ª fatura chega duas vezes (member_added + invoice): crédito uma vez só', async () => {
    const { deps: d, cols } = clubDeps([usuarioFree()]);
    await activateHublaClub(d, ativar);
    cols.users[0].creditsUsed = 40;
    const r = await renewHublaClubCredits(d, { subscriptionId: 'sub-club', invoiceId: 'inv-1' });
    expect(r).toMatchObject({ renewed: false, already: true });
    expect(cols.users[0].creditsUsed).toBe(40);
  });

  it('renovação: fatura nova zera os créditos; reenvio dela não zera de novo', async () => {
    const { deps: d, cols } = clubDeps([usuarioFree()]);
    await activateHublaClub(d, ativar);
    cols.users[0].creditsUsed = 55;
    expect(
      await renewHublaClubCredits(d, { subscriptionId: 'sub-club', invoiceId: 'inv-2' })
    ).toMatchObject({ renewed: true });
    expect(cols.users[0].creditsUsed).toBe(0);
    cols.users[0].creditsUsed = 10;
    expect(
      await renewHublaClubCredits(d, { subscriptionId: 'sub-club', invoiceId: 'inv-2' })
    ).toMatchObject({ renewed: false, already: true });
    expect(cols.users[0].creditsUsed).toBe(10);
  });

  it('fatura antes do member_added não carimba: a ativação concede depois', async () => {
    const { deps: d, cols } = clubDeps([usuarioFree()]);
    expect(
      await renewHublaClubCredits(d, { subscriptionId: 'sub-club', invoiceId: 'inv-1' })
    ).toMatchObject({ renewed: false, noMember: true });
    const r = await activateHublaClub(d, ativar);
    expect(r.creditsGranted).toBe(true);
    expect(cols.users[0].creditsUsed).toBe(0);
  });

  it('member_added repetido não reativa nem dá crédito de novo', async () => {
    const { deps: d } = clubDeps([usuarioFree()]);
    await activateHublaClub(d, ativar);
    expect(await activateHublaClub(d, ativar)).toMatchObject({
      activated: false,
      creditsGranted: false,
    });
  });

  it('desativa: volta pro free e solta a assinatura; repetir não faz nada', async () => {
    const { deps: d, cols } = clubDeps([usuarioFree()]);
    await activateHublaClub(d, ativar);
    expect(await deactivateHublaClub(d, { subscriptionId: 'sub-club' })).toMatchObject({
      deactivated: true,
    });
    const u = cols.users[0];
    expect(u).toMatchObject({
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
      monthlyCredits: 20,
    });
    expect(u).not.toHaveProperty('hublaSubscriptionId');
    expect(u).not.toHaveProperty('clubSource');
    expect(await deactivateHublaClub(d, { subscriptionId: 'sub-club' })).toEqual({
      deactivated: false,
    });
  });

  it.each([
    [
      'stripe-subscription',
      { subscriptionTier: 'club', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_x' },
    ],
    ['labs-tier', { subscriptionTier: 'pro', subscriptionStatus: 'active' }],
    ['club-other-source', { subscriptionTier: 'fundador', subscriptionStatus: 'active' }],
  ])('não sobrescreve quem já paga por outro caminho (%s)', async (motivo, estado) => {
    const antes = { ...usuarioFree(), ...estado };
    const { deps: d, cols } = clubDeps([{ ...antes }]);
    const r = await activateHublaClub(d, ativar);
    expect(r.skipped).toBe(motivo);
    expect(cols.users[0]).toEqual(antes);
    expect(cols.processed_payment_events).toHaveLength(0);
  });

  it('desativar não toca assinante do Stripe (não tem hublaSubscriptionId)', async () => {
    const stripe = {
      ...usuarioFree(),
      subscriptionTier: 'club',
      subscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_x',
    };
    const { deps: d, cols } = clubDeps([{ ...stripe }]);
    expect(await deactivateHublaClub(d, { subscriptionId: 'sub-club' })).toEqual({
      deactivated: false,
    });
    expect(cols.users[0]).toEqual(stripe);
  });
});

describe('registro da compra (hubla_compras)', () => {
  it('grava a compra com o comprador e a conta, no concedido e no removido', async () => {
    const recordPurchase = vi.fn(async () => {});
    const d = deps({ recordPurchase });
    await handleHublaWebhook(
      req(
        evento('customer.member_added', {
          user: {
            email: 'Ana@X.com',
            firstName: 'Ana',
            phone: '11 98888-7777',
            document: '12345678909',
          },
        })
      ),
      d,
      TOKEN
    );
    expect(recordPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-123',
        alvo: 'ia-aplicada',
        status: 'ativa',
        userId: 'u1',
        email: 'ana@x.com',
        telefone: '11988887777',
        cpf4: '8909',
      })
    );
    await handleHublaWebhook(req(evento('customer.member_removed')), d, TOKEN);
    expect(recordPurchase).toHaveBeenLastCalledWith(
      expect.objectContaining({ subscriptionId: 'sub-123', status: 'removida' })
    );
  });

  it('falha no registro não desfaz a liberação', async () => {
    const d = deps({
      recordPurchase: vi.fn(async () => {
        throw new Error('mongo fora');
      }),
    });
    const r = await handleHublaWebhook(req(evento('customer.member_added')), d, TOKEN);
    expect(r.status).toBe(200);
    expect(r.body.granted).toBe(true);
  });
});

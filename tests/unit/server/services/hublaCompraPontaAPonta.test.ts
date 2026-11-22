// A compra do IA Labs pela Hubla, de ponta a ponta, sem banco e sem e-mail de
// verdade (21/11/2026, véspera do lançamento). Roda o webhook de verdade, o
// "avisa quem comprou" de verdade (hublaAviso) e o e-mail de verdade
// (clubMail), trocando só as bordas: grant, trava, link mágico e `fetch`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const resend = vi.hoisted(() => ({
  configurado: false,
  enviar: vi.fn(async (_p: unknown) => {}),
}));
vi.mock('../../../../server/services/emailService.js', () => ({
  isEmailConfigured: () => resend.configurado,
  sendPurchaseAccessEmail: resend.enviar,
}));

import { handleHublaWebhook, type HublaDeps } from '../../../../server/services/hublaWebhook.js';
import {
  criarAvisoDeCompra,
  HORAS_DO_LINK_DE_COMPRA,
} from '../../../../server/services/hublaAviso.js';
import { enviarEmailDeCompra, podeAvisarCompra } from '../../../../server/services/clubMail.js';

const TOKEN = 'tok_certo';
const IA_LABS = 'l5WxBnTjVBoVJwWiIZG1';

function evento(email = 'ana@exemplo.com', sub = 'sub-777') {
  return {
    headers: { 'x-hubla-token': TOKEN, 'x-hubla-sandbox': 'false' },
    body: {
      type: 'customer.member_added',
      event: {
        product: { id: IA_LABS, name: 'IA Labs®' },
        subscription: { id: sub, type: 'one_time', payer: { email } },
        user: { email, firstName: 'Ana', lastName: 'Lima', phone: '+55 11 99999-0000' },
        invoice: { id: 'inv-1' },
      },
    },
  };
}

type Chamada = { url: string; init: RequestInit };

/** O mundo de fora: grant em memória, trava em memória, MillionSend e Club falsos. */
function montar(
  opts: {
    jaTemPorOutraCompra?: boolean;
    millionSend?: 'ok' | 'falha';
    travaQuebrada?: boolean;
  } = {}
) {
  const contas = new Map<string, { id: string; sessoes: Set<string>; skus: Set<string> }>();
  if (opts.jaTemPorOutraCompra) {
    contas.set('ana@exemplo.com', {
      id: 'u-ana',
      sessoes: new Set(['cs_live_stripe']),
      skus: new Set(['ia-aplicada']),
    });
  }
  const travas = new Set<string>();
  const chamadas: Chamada[] = [];

  const grantProduct = vi.fn(async (i: { email: string; sku: string; sessionId: string }) => {
    const email = i.email.toLowerCase().trim();
    let c = contas.get(email);
    let created = false;
    if (!c) {
      c = { id: `u-${contas.size + 1}`, sessoes: new Set(), skus: new Set() };
      contas.set(email, c);
      created = true;
    }
    if (c.sessoes.has(i.sessionId))
      return { userId: c.id, granted: false, created, ja: 'sessao' as const };
    if (c.skus.has(i.sku)) return { userId: c.id, granted: false, created, ja: 'sku' as const };
    c.sessoes.add(i.sessionId);
    c.skus.add(i.sku);
    return { userId: c.id, granted: true, created };
  });

  const criarLinkMagico = vi.fn(
    async (userId: string, _email: string, ttl: number) => `tok-${userId}-${ttl}`
  );
  const fetchFalso = vi.fn(async (url: string, init: RequestInit = {}) => {
    chamadas.push({ url: String(url), init });
    if (String(url).includes('/api/emails/modelo/')) {
      return new Response(JSON.stringify({ modelo: null }), { status: 200 });
    }
    if (opts.millionSend === 'falha') return new Response('fora', { status: 500 });
    return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchFalso);

  const recordPurchase = vi.fn(async () => {});
  const releaseAviso = vi.fn(async (s: string) => {
    travas.delete(s);
  });
  const deps: HublaDeps = {
    grantProduct,
    revokeProductGrant: vi.fn(),
    isRevokedError: () => false,
    activateClub: vi.fn(),
    deactivateClub: vi.fn(),
    renewClubCredits: vi.fn(),
    recordPurchase,
    sendAccessLink: criarAvisoDeCompra({
      criarLinkMagico,
      enviarEmailDeCompra,
      podeAvisarCompra,
      base: 'https://app.visant.club',
    }),
    claimAviso: vi.fn(async (s: string) => {
      if (opts.travaQuebrada) throw new Error('mongo fora');
      if (travas.has(s)) return false;
      travas.add(s);
      return true;
    }),
    releaseAviso,
    log: vi.fn(),
  };
  const envios = () => chamadas.filter((c) => c.url.endsWith('/emails'));
  return { deps, grantProduct, criarLinkMagico, recordPurchase, releaseAviso, envios, chamadas };
}

const corpoDo = (c: Chamada) => JSON.parse(String(c.init.body));

describe('compra do IA Labs pela Hubla, de ponta a ponta', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.CLUB_EMAIL_API_KEY = 'ms_teste';
    process.env.EMAIL_MODELO_SECRET = 'segredo';
    resend.configurado = false;
    resend.enviar.mockClear();
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('(a) comprador novo: registra, cria a conta, libera e manda o link de 72 h pro curso', async () => {
    const m = montar();
    const r = await handleHublaWebhook(evento(), m.deps, TOKEN);

    expect(r).toEqual({ status: 200, body: { granted: true, created: true, emailed: true } });
    expect(m.grantProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@exemplo.com',
        sku: 'ia-aplicada',
        sessionId: 'hubla:sub-777',
        source: 'hubla',
      })
    );
    expect(m.recordPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: 'sub-777',
        productId: IA_LABS,
        alvo: 'ia-aplicada',
        status: 'ativa',
        userId: 'u-1',
        email: 'ana@exemplo.com',
      })
    );
    expect(m.criarLinkMagico).toHaveBeenCalledWith(
      'u-1',
      'ana@exemplo.com',
      HORAS_DO_LINK_DE_COMPRA * 60
    );

    // O texto do e-mail vem do Club (com o segredo) e cai no padrão quando ele não tem override.
    const modelo = m.chamadas.find((c) => c.url.includes('/api/emails/modelo/compra-curso'));
    expect((modelo!.init.headers as Record<string, string>).Authorization).toBe('Bearer segredo');

    const [envio] = m.envios();
    expect(envio.url).toBe('https://api.millionsend.com/emails');
    expect(envio.init.signal).toBeDefined();
    const b = corpoDo(envio);
    expect(b.to).toEqual(['ana@exemplo.com']);
    expect(b.subject).toBe('Bem-vindo ao IA Labs');
    const link =
      'https://app.visant.club/entrar/link?token=tok-u-1-4320&amp;next=%2Fcurso%2Fia-aplicada';
    expect(b.html).toContain(link);
    expect(b.html).toContain('Começar pela primeira aula');
    expect(b.text).toContain(
      'Começar pela primeira aula: https://app.visant.club/entrar/link?token=tok-u-1-4320&next=%2Fcurso%2Fia-aplicada'
    );
  });

  it('(b) a Hubla reenvia o mesmo evento: um grant só, um e-mail só', async () => {
    const m = montar();
    await handleHublaWebhook(evento(), m.deps, TOKEN);
    const r2 = await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(r2.body).toMatchObject({ granted: false, emailed: false });
    expect(m.envios()).toHaveLength(1);
    expect(m.criarLinkMagico).toHaveBeenCalledTimes(1);
  });

  it('(c) já tinha o curso por outra compra (Stripe): recebe o e-mail desta, uma vez', async () => {
    const m = montar({ jaTemPorOutraCompra: true });
    const r = await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(r.body).toMatchObject({ granted: false, emailed: true });
    expect(m.criarLinkMagico).toHaveBeenCalledWith('u-ana', 'ana@exemplo.com', 4320);
    await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(m.envios()).toHaveLength(1);
  });

  it('(d) MillionSend fora e sem Resend: o acesso fica, a Hubla leva 200, e a trava solta pro reenvio', async () => {
    const m = montar({ millionSend: 'falha' });
    const r = await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(r).toEqual({ status: 200, body: { granted: true, created: true, emailed: false } });
    expect(m.releaseAviso).toHaveBeenCalledWith('sub-777');
  });

  it('(d2) MillionSend fora com Resend ligado: sai o e-mail do Labs com o mesmo link', async () => {
    resend.configurado = true;
    const m = montar({ millionSend: 'falha' });
    const r = await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(r.body.emailed).toBe(true);
    expect(resend.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@exemplo.com',
        titulo: 'IA Labs',
        horas: 72,
        loginUrl:
          'https://app.visant.club/entrar/link?token=tok-u-1-4320&next=%2Fcurso%2Fia-aplicada',
      })
    );
  });

  it('(e) e-mail com maiúscula e espaço vira um só, no grant, no link e no envio', async () => {
    const m = montar();
    await handleHublaWebhook(evento('  Ana@Exemplo.COM '), m.deps, TOKEN);
    expect(m.grantProduct.mock.calls[0][0].email).toBe('ana@exemplo.com');
    expect(m.criarLinkMagico.mock.calls[0][1]).toBe('ana@exemplo.com');
    expect(corpoDo(m.envios()[0]).to).toEqual(['ana@exemplo.com']);
  });

  it('trava fora do ar não custa o e-mail de quem acabou de liberar', async () => {
    const m = montar({ travaQuebrada: true });
    const r = await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(r.body).toMatchObject({ granted: true, emailed: true });
  });

  it('sem nenhum e-mail configurado: libera e não promete e-mail', async () => {
    delete process.env.CLUB_EMAIL_API_KEY;
    const m = montar();
    const r = await handleHublaWebhook(evento(), m.deps, TOKEN);
    expect(r).toEqual({ status: 200, body: { granted: true, created: true, emailed: false } });
  });
});

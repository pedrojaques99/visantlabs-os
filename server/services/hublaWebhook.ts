// Webhook da Hubla → entitlement de produto e assinatura do Club no Labs.
//
// A Hubla fica só com o caixa (Pix, 12x, reembolso); a aula mora no Club. Este
// handler traduz os eventos de Membro da Hubla para o mesmo `grantProduct` /
// `revokeProductGrant` que o Stripe já usa.
//
// Contrato da Hubla (hubla.gitbook.io/docs/webhooks, lido em 17/11/2026):
// - `x-hubla-token` em toda requisição; o corpo NÃO é assinado (sem HMAC).
// - `x-hubla-sandbox: "true"` no "Testar configuração": registra, não libera.
// - 4xx = a Hubla não tenta de novo (só reenvio manual pelo histórico);
//   5xx = tenta de novo. Por isso falha nossa responde 5xx.
// - Eventos podem chegar fora de ordem. Se o "removido" chegar antes do
//   "concedido", a revogação carimba o marcador e o grant depois recusa
//   (ProductGrantRevokedError) — o resultado final é "sem acesso", o certo.
// - `subscription.id` existe também em pagamento único e é o mesmo nos dois
//   eventos, por isso é a chave da compra: sessionId = `hubla:<subscription.id>`.
// - Assinatura do Club (HUBLA_CLUB_PRODUCT_ID) não vira entitlement: vira tier,
//   via services/hublaClubService.ts. member_added liga, member_removed
//   desliga, `invoice.payment_succeeded` dá os créditos do mês (renovação), uma
//   vez por id de fatura. member_added NÃO dispara na renovação (só quando a
//   assinatura fica ativa ou é reativada), por isso a fatura.
import { createHash, timingSafeEqual } from 'node:crypto';
import { extrairComprador, type CompraHubla } from './hublaCompras.js';

/** Produto da Hubla → SKU do Labs. Só produto listado aqui libera acesso. */
export const HUBLA_PRODUCT_SKUS: Record<string, string> = {
  l5WxBnTjVBoVJwWiIZG1: 'ia-aplicada', // IA Para Designers
  ABPdfoZXp66KtdDXSmpq: 'ebook-metodologia', // e-book, pagamento único
  n7U4EGH0THfVY5wMvQ5B: 'imersao-marca', // e-book, pagamento único
  '2cdlR0D3TekTpWhqhd6W': 'guia-de-call', // e-book, pagamento único
};

/** Assinatura do Visant Club (mensal R$ 49,90 / anual R$ 499). Não é SKU: é tier. */
export const HUBLA_CLUB_PRODUCT_ID = 'iUVlULNrtLYpKbVvBbzW';

/** O que o e-mail de acesso diz e pra onde o link leva. */
export interface Acesso {
  /** Muda o texto do e-mail de compra (services/clubMail.ts). */
  tipo: 'curso' | 'club' | 'ebook';
  titulo: string;
  /** Rota no Club, depois do login pelo link mágico. */
  caminho: string;
  abertura: string;
  onde: string;
  botao: string;
}

const ebook = (sku: string, titulo: string): Acesso => ({
  tipo: 'ebook',
  titulo,
  caminho: `/p/${sku}`,
  abertura: 'Tua compra entrou.',
  onde: 'no e-book',
  botao: 'Abrir o e-book',
});

/** SKU → acesso. Títulos espelham lib/catalogo.mjs do visant-club. */
export const HUBLA_ACESSO: Record<string, Acesso> = {
  'ia-aplicada': {
    tipo: 'curso',
    // O curso virou IA Labs em 20/11/2026 (decisão do dono); o sku não muda.
    titulo: 'IA Labs',
    caminho: '/curso/ia-aplicada',
    abertura: 'Tua compra entrou.',
    onde: 'na primeira aula',
    botao: 'Começar pela primeira aula',
  },
  'ebook-metodologia': ebook('ebook-metodologia', 'Metodologia Visant'),
  'imersao-marca': ebook('imersao-marca', 'A Imersão de Marca'),
  'guia-de-call': ebook('guia-de-call', 'Guia de call da Imersão'),
};

export const CLUB_ACESSO: Acesso = {
  tipo: 'club',
  titulo: 'Visant Club',
  caminho: '/dashboard',
  abertura: 'Tua assinatura entrou.',
  onde: 'no Club',
  botao: 'Entrar no Club',
};

import type { ClubSkipReason } from './hublaClubService.js';
export type { ClubSkipReason };

export interface HublaDeps {
  grantProduct: (input: {
    email: string;
    sku: string;
    sessionId: string;
    source: string;
    name?: string;
  }) => Promise<{ userId: string; granted: boolean; created: boolean; ja?: 'sessao' | 'sku' }>;
  revokeProductGrant: (input: {
    sessionId: string;
  }) => Promise<{ revoked: boolean; already: boolean }>;
  isRevokedError: (err: unknown) => boolean;
  /** Assinatura do Club: ver services/hublaClubService.ts. */
  activateClub: (input: {
    email: string;
    name?: string;
    subscriptionId: string;
    invoiceId?: string;
  }) => Promise<{
    userId: string;
    created: boolean;
    activated: boolean;
    creditsGranted: boolean;
    skipped?: ClubSkipReason;
  }>;
  deactivateClub: (input: {
    subscriptionId: string;
  }) => Promise<{ deactivated: boolean; userId?: string }>;
  renewClubCredits: (input: { subscriptionId: string; invoiceId: string }) => Promise<{
    renewed: boolean;
    already?: boolean;
    noMember?: boolean;
    userId?: string;
  }>;
  /** E-mail com link de uso único que entra logado direto em `acesso.caminho`. */
  sendAccessLink?: (input: {
    userId: string;
    email: string;
    name?: string;
    acesso: Acesso;
  }) => Promise<void>;
  /**
   * Trava de "e-mail desta compra já saiu", por subscription.id (21/11/2026).
   * Com ela, quem JÁ tinha o produto por outra compra (Stripe, liberação
   * manual) também recebe o e-mail desta, e o reenvio da Hubla não duplica.
   * `true` = pegou a trava agora. Sem ela, só a 1ª liberação avisa (comportamento antigo).
   */
  claimAviso?: (subscriptionId: string) => Promise<boolean>;
  /** Solta a trava quando o e-mail falhou, pra um reenvio tentar de novo. */
  releaseAviso?: (subscriptionId: string) => Promise<void>;
  /** Guarda a compra inteira (hubla_compras): o suporte acha a pessoa por e-mail, nome, telefone ou id. Opcional; falha não desfaz nada. */
  recordPurchase?: (c: Omit<CompraHubla, 'createdAt' | 'updatedAt'>) => Promise<void>;
  log: (level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) => void;
}

export interface HublaRequest {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface HublaResponse {
  status: number;
  body: Record<string, unknown>;
}

function header(req: HublaRequest, name: string): string {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) || '';
}

/** Compara em tempo constante. Aceita lista separada por vírgula (troca de token). */
export function tokenMatches(received: string, configured: string | undefined): boolean {
  if (!received || !configured) return false;
  const digest = (s: string) => createHash('sha256').update(s).digest();
  const got = digest(received);
  let ok = false;
  for (const t of configured
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (timingSafeEqual(got, digest(t))) ok = true;
  }
  return ok;
}

export async function handleHublaWebhook(
  req: HublaRequest,
  deps: HublaDeps,
  configuredToken: string | undefined = process.env.HUBLA_WEBHOOK_TOKEN
): Promise<HublaResponse> {
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as any;
  const type: string = typeof body.type === 'string' ? body.type : '';

  // Sem tipo de evento = ping/validação da Hubla ao criar a regra: só confirma
  // que a URL existe. Não toca em nada, então não precisa de token.
  if (!type) return { status: 200, body: { ok: true } };

  if (!tokenMatches(header(req, 'x-hubla-token'), configuredToken)) {
    deps.log('error', '[hubla] token inválido ou HUBLA_WEBHOOK_TOKEN ausente', { type });
    return { status: 401, body: { error: 'invalid token' } };
  }

  const sandbox = header(req, 'x-hubla-sandbox') === 'true';
  const event = body.event || {};
  const productId: string = event.product?.id || '';
  const isClub = productId === HUBLA_CLUB_PRODUCT_ID;
  const sku = HUBLA_PRODUCT_SKUS[productId];
  const isMember = type === 'customer.member_added' || type === 'customer.member_removed';
  const isRenewal = type === 'invoice.payment_succeeded';
  const subscriptionId: string =
    event.subscription?.id || (isRenewal ? event.invoice?.subscriptionId : '') || '';
  const ctx = { type, productId, subscriptionId, sandbox };

  // Fatura só interessa à assinatura do Club (créditos do mês). Produto avulso
  // e curso liberam pelo evento de Membro.
  if (!isMember && !(isRenewal && isClub)) {
    deps.log('info', '[hubla] evento ignorado', ctx);
    return { status: 200, body: { ignored: 'event' } };
  }
  if (!sku && !isClub) {
    deps.log('info', '[hubla] produto sem SKU mapeado', ctx);
    return { status: 200, body: { ignored: 'product' } };
  }
  const alvo = isClub ? 'club' : sku;
  if (sandbox) {
    deps.log('info', '[hubla] teste recebido (sandbox), nada liberado', { ...ctx, sku: alvo });
    return { status: 200, body: { sandbox: true, sku: alvo } };
  }
  if (!subscriptionId) {
    // Sem a chave da compra não dá pra revogar depois; 4xx porque reenviar não muda nada.
    deps.log('error', '[hubla] evento sem subscription.id', ctx);
    return { status: 422, body: { error: 'missing subscription.id' } };
  }

  // Normalizado aqui (21/11/2026): o grant já normalizava, mas o link mágico e o
  // e-mail de compra recebiam o valor cru (" Ana@X.com ").
  const email: string = String(
    event.user?.email || event.subscription?.payer?.email || event.invoice?.payer?.email || ''
  )
    .toLowerCase()
    .trim();
  const name =
    [event.user?.firstName, event.user?.lastName].filter(Boolean).join(' ').trim() || undefined;

  // Sem pedágio: na 1ª liberação manda o e-mail com o link que já entra
  // logado. Falha no e-mail não desfaz a compra (o /entrar cobre).
  const avisar = async (userId: string, acesso: Acesso): Promise<boolean> => {
    if (!deps.sendAccessLink) return false;
    try {
      await deps.sendAccessLink({ userId, email, name, acesso });
      return true;
    } catch (e) {
      deps.log('error', '[hubla] e-mail de acesso falhou', {
        ...ctx,
        sku: alvo,
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  };

  const comprador = extrairComprador(event);
  const registrar = async (status: 'ativa' | 'removida', userId?: string) => {
    if (!deps.recordPurchase) return;
    try {
      await deps.recordPurchase({
        ...comprador,
        email: comprador.email || email.toLowerCase().trim(),
        subscriptionId,
        productId,
        alvo,
        status,
        userId,
        invoiceId: event.invoice?.id || event.subscription?.lastInvoice?.id || undefined,
      });
    } catch (e) {
      deps.log('error', '[hubla] registro da compra falhou', {
        ...ctx,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleProduct = async (productSku: string): Promise<HublaResponse> => {
    const sessionId = `hubla:${subscriptionId}`;
    if (type === 'customer.member_removed') {
      const r = await deps.revokeProductGrant({ sessionId });
      await registrar('removida');
      deps.log('info', '[hubla] acesso removido', { ...ctx, sku: productSku, ...r });
      return { status: 200, body: { revoked: r.revoked, already: r.already } };
    }
    if (!email) {
      deps.log('error', '[hubla] acesso concedido sem e-mail', ctx);
      return { status: 422, body: { error: 'missing user.email' } };
    }
    const r = await deps.grantProduct({ email, sku: productSku, sessionId, source: 'hubla', name });
    deps.log('info', '[hubla] acesso concedido', {
      ...ctx,
      sku: productSku,
      userId: r.userId,
      granted: r.granted,
      accountCreated: r.created,
    });
    await registrar('ativa', r.userId);
    const acesso = HUBLA_ACESSO[productSku];
    let emailed = false;
    if (acesso && deps.claimAviso && (r.granted || r.ja === 'sku')) {
      // Avisa quem liberou agora E quem já tinha o produto por outra compra
      // (pagou de novo e merece o link); a trava por compra barra o reenvio.
      // Trava fora do ar não pode custar o e-mail de quem acabou de liberar:
      // nesse caso vale a regra antiga (avisa a 1ª liberação).
      const pegou = await deps.claimAviso(subscriptionId).catch((e) => {
        deps.log('error', '[hubla] trava do e-mail falhou', {
          ...ctx,
          error: e instanceof Error ? e.message : String(e),
        });
        return r.granted;
      });
      if (pegou) {
        emailed = await avisar(r.userId, acesso);
        if (!emailed && deps.releaseAviso) await deps.releaseAviso(subscriptionId).catch(() => {});
      }
    } else if (acesso && !deps.claimAviso && r.granted) {
      emailed = await avisar(r.userId, acesso);
    }
    return { status: 200, body: { granted: r.granted, created: r.created, emailed } };
  };

  const handleClub = async (): Promise<HublaResponse> => {
    if (type === 'customer.member_removed') {
      const r = await deps.deactivateClub({ subscriptionId });
      await registrar('removida', r.userId);
      deps.log('info', '[hubla] club desativado', { ...ctx, ...r });
      return { status: 200, body: { deactivated: r.deactivated } };
    }

    if (isRenewal) {
      const invoiceId: string = event.invoice?.id || '';
      if (!invoiceId) {
        deps.log('error', '[hubla] fatura sem invoice.id', ctx);
        return { status: 422, body: { error: 'missing invoice.id' } };
      }
      const r = await deps.renewClubCredits({ subscriptionId, invoiceId });
      deps.log('info', '[hubla] créditos do club', { ...ctx, invoiceId, ...r });
      return {
        status: 200,
        body: { renewed: r.renewed, already: !!r.already, noMember: !!r.noMember },
      };
    }

    // member_added. Assinatura que não está ativa no próprio payload não liga nada.
    const status = event.subscription?.status;
    if (status && status !== 'active') {
      deps.log('warn', '[hubla] club: member_added com assinatura não ativa', { ...ctx, status });
      return { status: 200, body: { ignored: 'status' } };
    }
    if (!email) {
      deps.log('error', '[hubla] acesso concedido sem e-mail', ctx);
      return { status: 422, body: { error: 'missing user.email' } };
    }
    const r = await deps.activateClub({
      email,
      name,
      subscriptionId,
      invoiceId: event.subscription?.lastInvoice?.id || undefined,
    });
    await registrar('ativa', r.userId);
    if (r.skipped) {
      // Já paga por outro caminho: não mexe; quem lê o log decide (reembolso).
      deps.log('warn', '[hubla] club NÃO ativado: conta já tem assinatura', { ...ctx, ...r });
      return { status: 200, body: { activated: false, skipped: r.skipped } };
    }
    deps.log('info', '[hubla] club ativado', { ...ctx, ...r });
    const emailed = r.activated ? await avisar(r.userId, CLUB_ACESSO) : false;
    return {
      status: 200,
      body: {
        activated: r.activated,
        created: r.created,
        creditsGranted: r.creditsGranted,
        emailed,
      },
    };
  };

  try {
    return isClub ? await handleClub() : await handleProduct(sku);
  } catch (err) {
    if (deps.isRevokedError(err)) {
      // Compra já reembolsada (o "removido" chegou antes): não libera, e está certo.
      deps.log('warn', '[hubla] grant recusado: compra já revogada', { ...ctx, sku: alvo });
      return { status: 200, body: { granted: false, revoked: true } };
    }
    deps.log('error', '[hubla] falha ao processar', {
      ...ctx,
      sku: alvo,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 500, body: { error: 'processing failed' } };
  }
}

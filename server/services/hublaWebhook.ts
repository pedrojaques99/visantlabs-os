// Webhook da Hubla → entitlement de produto no Labs.
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
import { createHash, timingSafeEqual } from 'node:crypto';

/** Produto da Hubla → SKU do Labs. Só produto listado aqui libera acesso. */
export const HUBLA_PRODUCT_SKUS: Record<string, string> = {
  l5WxBnTjVBoVJwWiIZG1: 'ia-aplicada', // IA Para Designers
};

export interface HublaDeps {
  grantProduct: (input: {
    email: string;
    sku: string;
    sessionId: string;
    source: string;
    name?: string;
  }) => Promise<{ userId: string; granted: boolean; created: boolean }>;
  revokeProductGrant: (input: {
    sessionId: string;
  }) => Promise<{ revoked: boolean; already: boolean }>;
  isRevokedError: (err: unknown) => boolean;
  /** E-mail com link de uso único que entra logado direto no curso. */
  sendAccessLink?: (input: {
    userId: string;
    email: string;
    name?: string;
    sku: string;
  }) => Promise<void>;
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
  const subscriptionId: string = event.subscription?.id || '';
  const email: string = event.user?.email || event.subscription?.payer?.email || '';
  const sku = HUBLA_PRODUCT_SKUS[productId];
  const ctx = { type, productId, subscriptionId, sandbox };

  if (type !== 'customer.member_added' && type !== 'customer.member_removed') {
    deps.log('info', '[hubla] evento ignorado', ctx);
    return { status: 200, body: { ignored: 'event' } };
  }
  if (!sku) {
    deps.log('info', '[hubla] produto sem SKU mapeado', ctx);
    return { status: 200, body: { ignored: 'product' } };
  }
  if (sandbox) {
    deps.log('info', '[hubla] teste recebido (sandbox), nada liberado', { ...ctx, sku });
    return { status: 200, body: { sandbox: true, sku } };
  }
  if (!subscriptionId) {
    // Sem a chave da compra não dá pra revogar depois; 4xx porque reenviar não muda nada.
    deps.log('error', '[hubla] evento sem subscription.id', ctx);
    return { status: 422, body: { error: 'missing subscription.id' } };
  }

  const sessionId = `hubla:${subscriptionId}`;

  try {
    if (type === 'customer.member_removed') {
      const r = await deps.revokeProductGrant({ sessionId });
      deps.log('info', '[hubla] acesso removido', { ...ctx, sku, ...r });
      return { status: 200, body: { revoked: r.revoked, already: r.already } };
    }

    if (!email) {
      deps.log('error', '[hubla] acesso concedido sem e-mail', ctx);
      return { status: 422, body: { error: 'missing user.email' } };
    }
    const name =
      [event.user?.firstName, event.user?.lastName].filter(Boolean).join(' ').trim() || undefined;
    const r = await deps.grantProduct({ email, sku, sessionId, source: 'hubla', name });
    deps.log('info', '[hubla] acesso concedido', {
      ...ctx,
      sku,
      userId: r.userId,
      granted: r.granted,
      accountCreated: r.created,
    });
    // Sem pedágio: na 1ª liberação manda o e-mail com o link que já entra
    // logado no curso. Falha no e-mail não desfaz a compra (o /entrar cobre).
    let emailed = false;
    if (r.granted && deps.sendAccessLink) {
      try {
        await deps.sendAccessLink({ userId: r.userId, email, name, sku });
        emailed = true;
      } catch (e) {
        deps.log('error', '[hubla] e-mail de acesso falhou', {
          ...ctx,
          sku,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return { status: 200, body: { granted: r.granted, created: r.created, emailed } };
  } catch (err) {
    if (deps.isRevokedError(err)) {
      // Compra já reembolsada (o "removido" chegou antes): não libera, e está certo.
      deps.log('warn', '[hubla] grant recusado: compra já revogada', { ...ctx, sku });
      return { status: 200, body: { granted: false, revoked: true } };
    }
    deps.log('error', '[hubla] falha ao processar', {
      ...ctx,
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 500, body: { error: 'processing failed' } };
  }
}

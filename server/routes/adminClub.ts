// Admin do Visant Club — superfície MÍNIMA e auditada pra gerir a role do Club.
//
// Por que um router separado em vez de alargar o PUT /admin/users/:id genérico:
// aquele endpoint edita nome, créditos e status de assinatura do SaaS. O Club
// não precisa de nada disso — precisa de UMA operação (trocar a role) feita de
// forma correta e rastreada. Superfície estreita = menos jeito de errar.
//
// Duas regras de negócio que moram aqui e em nenhum outro lugar:
//  1. Acesso ao Club = subscriptionTier ∈ CLUB_TIERS **E** subscriptionStatus
//     === 'active' (ver payments.ts:520). Escrever um sem o outro cria um
//     membro fantasma: aparece como fundador e não entra. Por isso o par é
//     sempre gravado junto, e o cliente escolhe uma ROLE, não dois campos.
//  2. Tier do Labs (starter/pro/enterprise) NÃO é role de Club. O painel do
//     Club nunca pode sobrescrever uma assinatura do SaaS.

import express, { Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { validateAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { isSafeId, ensureString } from '../utils/validation.js';

const router = express.Router();

/**
 * `ensureString` devolve null pra não-string e pra excesso de tamanho. Query
 * param repetido (?q=a&q=b) chega como array — sem este normalizador, um .trim()
 * encadeado viraria 500. Aqui excesso/tipo errado colapsa em string vazia.
 */
const asText = (val: unknown, maxLen: number): string => (ensureString(val, maxLen) ?? '').trim();

const clubLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests to club admin endpoints, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(clubLimiter);

/**
 * Role do Club → par (tier, status) gravado no usuário.
 * SSoT desta tradução. O cliente manda `role`; nunca tier/status soltos.
 */
const ROLE_TO_STATE = {
  fundador: { subscriptionTier: 'fundador', subscriptionStatus: 'active' },
  visantista: { subscriptionTier: 'visantista', subscriptionStatus: 'active' },
  club: { subscriptionTier: 'club', subscriptionStatus: 'active' },
  none: { subscriptionTier: 'free', subscriptionStatus: 'free' },
} as const;

type ClubRole = keyof typeof ROLE_TO_STATE;

/** Tiers que dão acesso ao Club — espelha CLUB_TIERS do visant-club. */
const CLUB_TIERS = new Set(['club', 'fundador', 'visantista']);

/** Tiers pagos do SaaS. Intocáveis por este router. */
const LABS_TIERS = new Set(['starter', 'pro', 'enterprise']);

const MEMBER_FIELDS = {
  id: true,
  email: true,
  name: true,
  picture: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  stripeSubscriptionId: true,
  createdAt: true,
  updatedAt: true,
} as const;

type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  stripeSubscriptionId: string | null;
  entitlements?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

/** Deriva a role a partir do estado gravado. 'none' = sem acesso ao Club. */
function roleOf(tier: string, status: string): ClubRole | 'labs' | 'none' {
  const t = (tier || '').toLowerCase();
  if (LABS_TIERS.has(t)) return 'labs';
  if (!CLUB_TIERS.has(t)) return 'none';
  // Tier de Club com assinatura inativa não dá acesso — não mentir na listagem.
  if ((status || '').toLowerCase() !== 'active') return 'none';
  return t as ClubRole;
}

/** Só o que o painel precisa de cada produto comprado: sku, origem e quando. */
export function produtosDe(
  raw: unknown
): Array<{ sku: string; source: string | null; grantedAt: string | null }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e === 'object' && typeof (e as any).sku === 'string')
    .map((e: any) => ({
      sku: String(e.sku),
      source: typeof e.source === 'string' ? e.source : null,
      grantedAt: typeof e.grantedAt === 'string' ? e.grantedAt : null,
    }));
}

/**
 * Projeção enxuta pro cliente. Nunca serializa o usuário cru: o doc tem chaves
 * de API criptografadas, tokens e reset de senha. Aqui sai só o necessário —
 * e o id da assinatura do Stripe vira um booleano.
 */
function toPublic(u: MemberRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    role: roleOf(u.subscriptionTier, u.subscriptionStatus),
    tier: u.subscriptionTier,
    status: u.subscriptionStatus,
    stripeManaged: !!u.stripeSubscriptionId,
    produtos: produtosDe(u.entitlements),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/*
 * Quem aparece (23/11/2026, pedido do dono: "todos os compradores e assinantes"):
 *   pagantes    (padrão) assinante ativo do Club OU dono de algum produto
 *   club        só assinante ativo
 *   compradores só quem tem produto (curso, e-book, mentoria)
 *   all         a base inteira do SaaS, só com busca (>= 3 letras)
 * `produto=<sku>` restringe a quem tem aquele sku; `ordem` escolhe a ordenação.
 * Driver nativo: o Prisma no MongoDB não filtra dentro de campo Json, e
 * `entitlements` é Json.
 */
const ESCOPOS = ['pagantes', 'club', 'compradores', 'all'] as const;
type Escopo = (typeof ESCOPOS)[number];
const ORDENS = {
  recentes: { createdAt: -1 },
  antigos: { createdAt: 1 },
  nome: { name: 1, email: 1 },
  email: { email: 1 },
  atualizados: { updatedAt: -1 },
} as const;
type Ordem = keyof typeof ORDENS;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ASSINANTE = { subscriptionTier: { $in: [...CLUB_TIERS] }, subscriptionStatus: 'active' };
const COMPRADOR = { 'entitlements.0': { $exists: true } };

/** O filtro do Mongo pra cada pedido. Exportado pro teste. */
export function filtroMembros(scope: Escopo, q: string, produto: string): Record<string, unknown> {
  const e: Record<string, unknown>[] = [];
  if (scope === 'club') e.push(ASSINANTE);
  if (scope === 'compradores') e.push(COMPRADOR);
  if (scope === 'pagantes') e.push({ $or: [ASSINANTE, COMPRADOR] });
  if (produto) e.push({ 'entitlements.sku': { $regex: `^${escapeRegex(produto)}$`, $options: 'i' } });
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: 'i' };
    e.push({ $or: [{ email: rx }, { name: rx }] });
  }
  return e.length ? { $and: e } : {};
}

router.get('/members', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const q = asText(req.query.q, 200);
    const escopoPedido = asText(req.query.scope, 20) as Escopo;
    const scope: Escopo = ESCOPOS.includes(escopoPedido) ? escopoPedido : 'pagantes';
    const ordemPedida = asText(req.query.ordem, 20);
    const ordem: Ordem = Object.hasOwn(ORDENS, ordemPedida) ? (ordemPedida as Ordem) : 'recentes';
    const produto = asText(req.query.produto, 60).toLowerCase();
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);

    // scope=all sem busca listaria a base inteira do SaaS dentro do painel do
    // Club. Exigir o termo mantém o padrão "pagantes por padrão, resto sob demanda".
    if (scope === 'all' && q.length < 3) {
      return res
        .status(400)
        .json({ error: 'Busque por ao menos 3 caracteres para procurar fora do Club' });
    }

    const filtro = filtroMembros(scope, q, produto);
    await connectToMongoDB();
    const users = getDb().collection('users');
    const projection = {
      email: 1,
      name: 1,
      picture: 1,
      subscriptionTier: 1,
      subscriptionStatus: 1,
      stripeSubscriptionId: 1,
      entitlements: 1,
      createdAt: 1,
      updatedAt: 1,
    };
    const [docs, total] = await Promise.all([
      users
        .find(filtro, { projection })
        .sort(ORDENS[ordem] as any)
        .collation({ locale: 'pt', strength: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      users.countDocuments(filtro),
    ]);

    const rows: MemberRow[] = docs.map((d: any) => ({
      id: String(d._id),
      email: d.email,
      name: d.name ?? null,
      picture: d.picture ?? null,
      subscriptionTier: d.subscriptionTier ?? 'free',
      subscriptionStatus: d.subscriptionStatus ?? 'free',
      stripeSubscriptionId: d.stripeSubscriptionId ?? null,
      entitlements: d.entitlements,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    return res.json({ members: rows.map(toPublic), total, page, limit, scope, ordem });
  } catch (error) {
    console.error('Failed to list club members:', error);
    return res.status(500).json({ error: 'Failed to list club members' });
  }
});

// PUT /members/:id/role — a ÚNICA escrita deste router.
router.put('/members/:id/role', validateAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!isSafeId(id)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const role = asText(req.body?.role, 40).toLowerCase() as ClubRole;
    if (!Object.prototype.hasOwnProperty.call(ROLE_TO_STATE, role)) {
      return res.status(400).json({ error: 'Invalid club role' });
    }

    const reason = asText(req.body?.reason, 500);
    const force = req.body?.force === true;

    const target = (await prisma.user.findUnique({
      where: { id },
      select: MEMBER_FIELDS,
    })) as MemberRow | null;
    if (!target) return res.status(404).json({ error: 'User not found' });

    const currentTier = (target.subscriptionTier || '').toLowerCase();

    // Guarda 1: assinatura do SaaS não é role de Club. Sem exceção, sem force.
    if (LABS_TIERS.has(currentTier)) {
      return res.status(409).json({
        error: 'Este usuário tem assinatura do Visant Labs. Ajuste pelo painel do Labs.',
        code: 'labs_subscription',
      });
    }

    // Guarda 2: quem paga pelo Stripe é gerido pelo webhook — uma escrita manual
    // dura até o próximo evento e depois volta sozinha. Exige intenção explícita.
    if (target.stripeSubscriptionId && !force) {
      return res.status(409).json({
        error: 'Assinatura ativa no Stripe. O webhook vai sobrescrever a mudança manual.',
        code: 'stripe_managed',
      });
    }

    const next = ROLE_TO_STATE[role];
    const before = { tier: target.subscriptionTier, status: target.subscriptionStatus };

    // No-op explícito: não gera escrita nem linha de auditoria.
    if (before.tier === next.subscriptionTier && before.status === next.subscriptionStatus) {
      return res.json({ success: true, unchanged: true, member: toPublic(target) });
    }

    const updated = (await prisma.user.update({
      where: { id },
      data: next,
      select: MEMBER_FIELDS,
    })) as MemberRow;

    // Auditoria: mexer em role é mexer em acesso pago. Sem rastro de quem fez o
    // quê, não há como responder "por que essa pessoa perdeu acesso em julho".
    // Coleção dedicada no Mongo — schemaless, sem migration.
    try {
      await connectToMongoDB();
      await getDb()
        .collection('club_role_audit')
        .insertOne({
          at: new Date(),
          actorId: req.userId ?? null,
          actorEmail: req.userEmail ?? null,
          targetId: target.id,
          targetEmail: target.email,
          role,
          before,
          after: { tier: next.subscriptionTier, status: next.subscriptionStatus },
          reason: reason || null,
          forced: force,
        });
    } catch (auditError) {
      // A escrita principal já passou; falhar a resposta faria o admin repetir a
      // ação e divergir do que está no banco. Loga alto e segue.
      console.error('club_role_audit write failed:', auditError);
    }

    return res.json({ success: true, member: toPublic(updated) });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Failed to update club role:', error);
    return res.status(500).json({ error: 'Failed to update club role' });
  }
});

export default router;

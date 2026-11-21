// A mesa de suporte do Club (19/11/2026): resolver acesso sem abrir o banco.
//
// O caso que motivou: pagou na Hubla com o e-mail A, entrou no Club com B, não
// vê o curso. Antes não havia botão pra isso em lugar nenhum: o admin do Club
// só trocava a role. Aqui ficam as ações, cada uma com motivo obrigatório e uma
// linha em `suporte_audit` (quem fez, o quê, de onde pra onde).
//
//   GET  /busca?q=        contas da Labs + compras da Hubla que batem
//   POST /transferir      { subscriptionId, para (e-mail ou id), motivo }
//   POST /liberar         { email, sku, motivo }   grant manual (cortesia, compra por fora)
//   POST /reenviar-acesso { userId, caminho? }      link mágico de 72h pro e-mail da conta
//   PUT  /email           { userId, novoEmail, motivo }
//
// Montado em /api/admin/suporte (app.ts), só admin.
import express, { Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { validateAdmin } from '../middleware/adminAuth.js';
import { AuthRequest } from '../middleware/auth.js';
import { isSafeId, ensureString } from '../utils/validation.js';
import { CLUB_BASE_URL } from '../lib/mcp-constants.js';
import { toEntitlements } from '../lib/entitlements.js';
import {
  buscarCompras,
  transferirCompra,
  auditar,
  TransferenciaError,
} from '../services/hublaCompras.js';
import { HUBLA_ACESSO, type Acesso } from '../services/hublaWebhook.js';

const router = express.Router();
const texto = (v: unknown, max: number) => (ensureString(v, max) ?? '').trim();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.use(
  rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }),
  validateAdmin
);

const CONTA = {
  id: true,
  email: true,
  name: true,
  picture: true,
  googleId: true,
  password: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  createdAt: true,
} as const;

/** Nunca serializa o usuário cru: senha vira "tem senha", Google vira "entra com Google". */
function contaPublica(u: any) {
  const ext = u as any;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    picture: u.picture,
    entraCom: [u.password ? 'senha' : null, u.googleId ? 'google' : null, 'link'].filter(Boolean),
    tier: u.subscriptionTier,
    status: u.subscriptionStatus,
    clubSource: ext.clubSource ?? null,
    hublaSubscriptionId: ext.hublaSubscriptionId ?? null,
    entitlements: toEntitlements(ext.entitlements).map((e) => ({
      sku: e.sku,
      source: e.source,
      sessionId: e.sessionId,
      grantedAt: e.grantedAt,
    })),
    createdAt: u.createdAt,
  };
}

async function acharConta(para: string) {
  if (isSafeId(para)) {
    const porId = await prisma.user.findUnique({ where: { id: para } }).catch(() => null);
    if (porId) return porId;
  }
  return prisma.user.findUnique({ where: { email: para.toLowerCase().trim() } });
}

// GET /busca?q= — o termo vale pra conta (e-mail, nome) e pra compra (e-mail, nome, telefone, id, cpf4).
router.get('/busca', async (req: AuthRequest, res: Response) => {
  const q = texto(req.query.q, 200);
  if (q.length < 3) return res.status(400).json({ error: 'Busque por ao menos 3 caracteres' });
  try {
    await connectToMongoDB();
    const db = getDb();
    const compras = await buscarCompras(db, q);
    // As contas que batem com o termo E as contas onde as compras achadas estão.
    const idsDasCompras = compras
      .map((c) => c.userId)
      .filter((id): id is string => !!id && isSafeId(id));
    const emailsDasCompras = compras.map((c) => c.email).filter(Boolean);
    const contas = await prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          ...(idsDasCompras.length ? [{ id: { in: idsDasCompras } }] : []),
          ...(emailsDasCompras.length ? [{ email: { in: emailsDasCompras } }] : []),
        ],
      },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });
    return res.json({
      contas: contas.map(contaPublica),
      compras: compras.map((c) => ({
        subscriptionId: c.subscriptionId,
        alvo: c.alvo,
        status: c.status,
        email: c.email,
        nome: c.nome ?? null,
        telefone: c.telefone ?? null,
        cpf4: c.cpf4 ?? null,
        userId: c.userId ?? null,
        createdAt: c.createdAt,
      })),
    });
  } catch (e) {
    console.error('suporte/busca falhou:', e);
    return res.status(500).json({ error: 'Falha na busca' });
  }
});

// POST /transferir — move uma compra da Hubla pra outra conta (por e-mail ou id).
router.post('/transferir', async (req: AuthRequest, res: Response) => {
  const subscriptionId = texto(req.body?.subscriptionId, 100);
  const para = texto(req.body?.para, 200);
  const motivo = texto(req.body?.motivo, 500);
  if (!subscriptionId || !para || !motivo)
    return res.status(400).json({ error: 'Compra, destino e motivo são obrigatórios' });
  try {
    const destino = await acharConta(para);
    if (!destino)
      return res.status(404).json({
        error:
          'Não achei a conta de destino. A pessoa precisa entrar no Club uma vez com esse e-mail.',
      });
    await connectToMongoDB();
    const db = getDb();
    const t = await transferirCompra(db, subscriptionId, destino.id);
    await auditar(db, {
      acao: 'transferir',
      actorId: req.userId ?? null,
      actorEmail: req.userEmail ?? null,
      ...t,
      paraEmail: destino.email,
      motivo,
    });
    return res.json({ ok: true, ...t, paraEmail: destino.email });
  } catch (e) {
    if (e instanceof TransferenciaError)
      return res.status(409).json({ error: e.message, code: e.code });
    console.error('suporte/transferir falhou:', e);
    return res.status(500).json({ error: 'Falha ao transferir' });
  }
});

// POST /liberar — grant manual de SKU. Não é compra da Hubla: sessionId próprio, revogável à parte.
router.post('/liberar', async (req: AuthRequest, res: Response) => {
  const email = texto(req.body?.email, 200).toLowerCase();
  const sku = texto(req.body?.sku, 80);
  const motivo = texto(req.body?.motivo, 500);
  if (!EMAIL_RE.test(email) || !sku || !motivo)
    return res.status(400).json({ error: 'E-mail, produto e motivo são obrigatórios' });
  try {
    const { grantProduct } = await import('../services/productGrantService.js');
    const r = await grantProduct({
      email,
      sku,
      sessionId: `manual:${randomUUID()}`,
      source: 'manual',
    });
    await connectToMongoDB();
    await auditar(getDb(), {
      acao: 'liberar',
      actorId: req.userId ?? null,
      actorEmail: req.userEmail ?? null,
      email,
      sku,
      userId: r.userId,
      criouConta: r.created,
      motivo,
    });
    return res.json({ ok: true, userId: r.userId, granted: r.granted, created: r.created });
  } catch (e) {
    console.error('suporte/liberar falhou:', e);
    return res.status(500).json({ error: 'Falha ao liberar' });
  }
});

// POST /reenviar-acesso — o mesmo e-mail de acesso da compra, com link novo de 72h.
router.post('/reenviar-acesso', async (req: AuthRequest, res: Response) => {
  const userId = texto(req.body?.userId, 64);
  const sku = texto(req.body?.sku, 80);
  if (!isSafeId(userId)) return res.status(400).json({ error: 'Conta inválida' });
  try {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) return res.status(404).json({ error: 'Conta não existe' });
    const { criarLinkMagico } = await import('../services/magicLinkService.js');
    const { enviarEmailDeCompra, podeAvisarCompra } = await import('../services/clubMail.js');
    if (!podeAvisarCompra())
      return res.status(503).json({ error: 'E-mail da Labs não configurado' });
    const acesso: Acesso = HUBLA_ACESSO[sku] ?? {
      tipo: 'club',
      titulo: 'Visant Club',
      caminho: '/dashboard',
      abertura: 'Teu acesso está aqui.',
      onde: 'no Club',
      botao: 'Entrar no Club',
    };
    const horas = 72;
    const token = await criarLinkMagico(u.id, u.email, horas * 60);
    await enviarEmailDeCompra({
      email: u.email,
      nome: u.name,
      loginUrl: `${CLUB_BASE_URL}/entrar/link?token=${token}&next=${encodeURIComponent(acesso.caminho)}`,
      horas,
      acesso,
    });
    await connectToMongoDB();
    await auditar(getDb(), {
      acao: 'reenviar-acesso',
      actorId: req.userId ?? null,
      actorEmail: req.userEmail ?? null,
      userId,
      email: u.email,
      sku: sku || null,
    });
    return res.json({ ok: true, email: u.email });
  } catch (e) {
    console.error('suporte/reenviar-acesso falhou:', e);
    return res.status(500).json({ error: 'Falha ao reenviar' });
  }
});

// PUT /email — corrige o e-mail da conta (digitou errado na Hubla, trocou de e-mail).
router.put('/email', async (req: AuthRequest, res: Response) => {
  const userId = texto(req.body?.userId, 64);
  const novoEmail = texto(req.body?.novoEmail, 200).toLowerCase();
  const motivo = texto(req.body?.motivo, 500);
  if (!isSafeId(userId) || !EMAIL_RE.test(novoEmail) || !motivo)
    return res.status(400).json({ error: 'Conta, e-mail novo e motivo são obrigatórios' });
  try {
    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) return res.status(404).json({ error: 'Conta não existe' });
    const ocupado = await prisma.user.findUnique({ where: { email: novoEmail } });
    if (ocupado && ocupado.id !== userId) {
      return res.status(409).json({
        error:
          'Já existe outra conta com esse e-mail. Transfira a compra pra ela em vez de trocar.',
        code: 'email-ocupado',
        contaId: ocupado.id,
      });
    }
    // Sem e-mail verificado: o próximo link mágico prova a posse do endereço novo.
    await prisma.user.update({
      where: { id: userId },
      data: { email: novoEmail, emailVerified: false } as any,
    });
    await connectToMongoDB();
    await auditar(getDb(), {
      acao: 'trocar-email',
      actorId: req.userId ?? null,
      actorEmail: req.userEmail ?? null,
      userId,
      de: u.email,
      para: novoEmail,
      motivo,
    });
    return res.json({ ok: true, de: u.email, para: novoEmail });
  } catch (e) {
    console.error('suporte/email falhou:', e);
    return res.status(500).json({ error: 'Falha ao trocar o e-mail' });
  }
});

export default router;

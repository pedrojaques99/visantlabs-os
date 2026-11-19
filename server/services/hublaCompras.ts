// O registro da compra da Hubla, inteiro (19/11/2026).
//
// Antes, o webhook guardava só `entitlements[].sessionId` e `hublaSubscriptionId`
// dentro do usuário, e jogava fora telefone e CPF. Quando a pessoa pagava com um
// e-mail e entrava no Club com outro, não sobrava por onde achar a compra: o
// e-mail era a única chave. Aqui cada compra vira uma linha em `hubla_compras`,
// achável por e-mail, nome, telefone, id da compra ou os 4 últimos do CPF.
//
// LGPD: o CPF NUNCA é guardado inteiro, só os 4 últimos dígitos (pra confirmar
// identidade no suporte). Telefone inteiro, só dígitos (é a busca que mais acha
// quem errou o e-mail).
//
// Também mora aqui o motor de TRANSFERIR uma compra de uma conta pra outra, que
// o admin (routes/adminSuporte.ts) e o autoatendimento usam. A compra continua
// sendo a mesma (`sessionId`/`hublaSubscriptionId`), então reembolso e
// cancelamento seguem achando ela na conta nova.
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';

export const COLECAO_COMPRAS = 'hubla_compras';
export const COLECAO_AUDITORIA = 'suporte_audit';

export interface Comprador {
  email: string;
  nome?: string;
  telefone?: string;
  cpf4?: string;
}

export interface CompraHubla extends Comprador {
  subscriptionId: string;
  productId: string;
  /** SKU do produto, ou 'club' pra assinatura. */
  alvo: string;
  status: 'ativa' | 'removida';
  userId?: string;
  invoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const soDigitos = (s: unknown) => (typeof s === 'string' || typeof s === 'number' ? String(s) : '').replace(/\D/g, '');

/** O que dá pra tirar do payload da Hubla sobre quem comprou. Campos defensivos: o payload varia por evento. */
export function extrairComprador(event: any): Comprador {
  const u = event?.user || {};
  const payer = event?.subscription?.payer || event?.invoice?.payer || {};
  const email = String(u.email || payer.email || '').toLowerCase().trim();
  const nome = [u.firstName || payer.firstName, u.lastName || payer.lastName].filter(Boolean).join(' ').trim() || u.name || payer.name || undefined;
  const telefone = soDigitos(u.phone || u.phoneNumber || payer.phone || payer.phoneNumber) || undefined;
  const doc = soDigitos(u.document || u.cpf || u.documentNumber || payer.document || payer.cpf || payer.documentNumber);
  return { email, nome, telefone, cpf4: doc.length >= 4 ? doc.slice(-4) : undefined };
}

export async function registrarCompra(
  db: Db,
  c: Omit<CompraHubla, 'createdAt' | 'updatedAt'>,
  now = new Date()
): Promise<void> {
  const { subscriptionId, ...resto } = c;
  // Campo vazio não apaga o que um evento anterior já trouxe (o "removido" vem magro).
  const set: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(resto)) if (v !== undefined && v !== '') set[k] = v;
  await db
    .collection(COLECAO_COMPRAS)
    .updateOne({ subscriptionId }, { $set: set, $setOnInsert: { createdAt: now } }, { upsert: true });
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Busca por qualquer coisa: e-mail, nome, telefone (só dígitos, 8+), id da compra ou 4 últimos do CPF. */
export async function buscarCompras(db: Db, q: string, limite = 30): Promise<CompraHubla[]> {
  const termo = q.trim();
  if (termo.length < 3) return [];
  const re = new RegExp(escapar(termo), 'i');
  const digitos = soDigitos(termo);
  const ou: Record<string, unknown>[] = [{ email: re }, { nome: re }, { subscriptionId: termo }, { invoiceId: termo }];
  if (digitos.length >= 8) ou.push({ telefone: new RegExp(escapar(digitos.slice(-8)) + '$') });
  if (digitos.length === 4) ou.push({ cpf4: digitos });
  return (await db
    .collection(COLECAO_COMPRAS)
    .find({ $or: ou })
    .sort({ createdAt: -1 })
    .limit(limite)
    .toArray()) as unknown as CompraHubla[];
}

function filtroUsuario(id: string) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };
}

export class TransferenciaError extends Error {
  constructor(public readonly code: 'sem-compra' | 'mesma-conta' | 'destino-inexistente' | 'destino-com-assinatura', msg: string) {
    super(msg);
    this.name = 'TransferenciaError';
  }
}

export interface Transferencia {
  subscriptionId: string;
  alvo: string;
  deUserId: string;
  paraUserId: string;
}

/**
 * Move UMA compra da Hubla da conta onde ela está pra `paraUserId`.
 * - Produto: tira o entitlement com `sessionId = hubla:<id>` da origem e põe no destino.
 * - Club: leva tier/status/créditos/`hublaSubscriptionId` pro destino e zera a origem.
 * Recusa destino que já assina por outro caminho (mesma regra do activateHublaClub).
 */
export async function transferirCompra(db: Db, subscriptionId: string, paraUserId: string): Promise<Transferencia> {
  const users = db.collection('users');
  const destino: any = await users.findOne(filtroUsuario(paraUserId));
  if (!destino) throw new TransferenciaError('destino-inexistente', 'Conta de destino não existe');
  const sessionId = `hubla:${subscriptionId}`;

  const origemProduto: any = await users.findOne({ 'entitlements.sessionId': sessionId });
  if (origemProduto) {
    const deUserId = String(origemProduto._id);
    if (deUserId === String(destino._id)) throw new TransferenciaError('mesma-conta', 'A compra já está nessa conta');
    const ent = (origemProduto.entitlements as any[]).find((e) => e?.sessionId === sessionId);
    // Destino primeiro: se cair no meio, a pessoa fica com acesso nas duas, nunca em nenhuma.
    await users.updateOne({ _id: destino._id }, { $push: { entitlements: { ...ent, transferidoDe: deUserId, transferidoEm: new Date() } } as any });
    await users.updateOne({ _id: origemProduto._id }, { $pull: { entitlements: { sessionId } } as any });
    await db.collection(COLECAO_COMPRAS).updateOne({ subscriptionId }, { $set: { userId: String(destino._id), updatedAt: new Date() } });
    return { subscriptionId, alvo: ent?.sku ?? '?', deUserId, paraUserId: String(destino._id) };
  }

  const origemClub: any = await users.findOne({ hublaSubscriptionId: subscriptionId, clubSource: 'hubla' });
  if (!origemClub) throw new TransferenciaError('sem-compra', 'Não achei essa compra em nenhuma conta');
  const deUserId = String(origemClub._id);
  if (deUserId === String(destino._id)) throw new TransferenciaError('mesma-conta', 'A compra já está nessa conta');
  const ativo = String(destino.subscriptionStatus || '').toLowerCase() === 'active';
  const tierDestino = String(destino.subscriptionTier || 'free').toLowerCase();
  if (ativo && tierDestino !== 'free') {
    throw new TransferenciaError('destino-com-assinatura', 'A conta de destino já tem uma assinatura ativa');
  }
  const campos = ['subscriptionTier', 'subscriptionStatus', 'clubSource', 'hublaSubscriptionId', 'monthlyCredits', 'creditsUsed', 'creditsResetDate'];
  const set: Record<string, unknown> = {};
  for (const k of campos) if (origemClub[k] !== undefined) set[k] = origemClub[k];
  await users.updateOne({ _id: destino._id }, { $set: set });
  await users.updateOne(
    { _id: origemClub._id },
    { $set: { subscriptionTier: 'free', subscriptionStatus: 'free' }, $unset: { clubSource: '', hublaSubscriptionId: '' } }
  );
  await db.collection(COLECAO_COMPRAS).updateOne({ subscriptionId }, { $set: { userId: String(destino._id), updatedAt: new Date() } });
  return { subscriptionId, alvo: 'club', deUserId, paraUserId: String(destino._id) };
}

/** Toda compra da Hubla que hoje está na conta `userId` (pelo entitlement ou pela assinatura). */
export async function comprasDaConta(db: Db, userId: string): Promise<string[]> {
  const u: any = await db.collection('users').findOne(filtroUsuario(userId), { projection: { entitlements: 1, hublaSubscriptionId: 1, clubSource: 1 } });
  if (!u) return [];
  const ids = (Array.isArray(u.entitlements) ? u.entitlements : [])
    .map((e: any) => (typeof e?.sessionId === 'string' && e.sessionId.startsWith('hubla:') ? e.sessionId.slice(6) : null))
    .filter(Boolean) as string[];
  if (u.clubSource === 'hubla' && u.hublaSubscriptionId) ids.push(u.hublaSubscriptionId);
  return ids;
}

export async function auditar(db: Db, linha: Record<string, unknown>): Promise<void> {
  try {
    await db.collection(COLECAO_AUDITORIA).insertOne({ at: new Date(), ...linha });
  } catch (e) {
    // A ação já passou; falhar a resposta faria repetir. Loga alto.
    console.error('suporte_audit write failed:', e);
  }
}

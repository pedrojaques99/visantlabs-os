// Autoatendimento: "paguei com o e-mail A, entrei no Club com B" (19/11/2026).
//
// A conta B (logada) pede as compras da Hubla que estão na conta A. A Labs manda
// um link pro e-mail A; quem clica prova que manda naquela caixa de entrada, e só
// então as compras passam de A pra B pelo mesmo motor da mesa de suporte
// (`transferirCompra`). Sem o clique, nada muda.
//
// - O pedido NUNCA revela se A existe ou tem compra: a resposta é a mesma.
// - Do token só guardamos o sha256; o cru vive no e-mail e em nenhum outro lugar.
// - Vale 24h e uma vez: a confirmação marca `usadoEm` num findOneAndUpdate com
//   `usadoEm: null` no filtro, então clique duplo não transfere duas vezes.
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { createHash, randomBytes } from 'node:crypto';
import { comprasDaConta, transferirCompra, auditar, TransferenciaError } from './hublaCompras.js';

export const COLECAO_VINCULOS = 'vinculos_compra';
export const VALIDADE_HORAS = 24;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type VinculoCode = 'email-invalido' | 'mesmo-email' | 'conta-inexistente' | 'link-invalido';

export class VinculoError extends Error {
  constructor(
    public readonly code: VinculoCode,
    public readonly status: number,
    msg: string
  ) {
    super(msg);
    this.name = 'VinculoError';
  }
}

export interface PedidoDeps {
  /** Manda o e-mail de confirmação pra A. Recebe o token CRU (o banco não tem). */
  enviarEmail: (p: {
    email: string;
    name?: string;
    paraEmail: string;
    token: string;
  }) => Promise<void>;
  now?: () => Date;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function filtroUsuario(id: string) {
  return ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id as any };
}

let indices: Promise<unknown> | null = null;
function garantirIndices(db: Db) {
  indices ??= Promise.all([
    db.collection(COLECAO_VINCULOS).createIndex({ hash: 1 }, { unique: true }),
    // Mongo apaga o pedido vencido sozinho (com folga, pra auditoria do dia).
    db
      .collection(COLECAO_VINCULOS)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }),
  ]).catch((e) => {
    indices = null;
    console.error('vinculos_compra: índices falharam', e);
  });
  return indices;
}

/**
 * B pede as compras do e-mail A. Devolve `enviado` só pra teste e log: a rota
 * responde igual nos dois casos, pra não virar oráculo de "esse e-mail comprou?".
 */
export async function pedirVinculo(
  db: Db,
  paraUserId: string,
  emailBruto: unknown,
  deps: PedidoDeps
): Promise<{ enviado: boolean }> {
  const now = deps.now?.() ?? new Date();
  const email = (typeof emailBruto === 'string' ? emailBruto : '').toLowerCase().trim();
  if (!email || email.length > 200 || !EMAIL_RE.test(email))
    throw new VinculoError('email-invalido', 400, 'E-mail inválido');

  const users = db.collection('users');
  const para: any = await users.findOne(filtroUsuario(paraUserId), {
    projection: { email: 1 },
  });
  if (!para) throw new VinculoError('conta-inexistente', 401, 'Conta não encontrada');
  const paraEmail = String(para.email || '')
    .toLowerCase()
    .trim();
  if (email === paraEmail)
    throw new VinculoError('mesmo-email', 400, 'Esse já é o e-mail desta conta');

  const de: any = await users.findOne({ email }, { projection: { email: 1, name: 1 } });
  if (!de || String(de._id) === String(para._id)) return { enviado: false };
  const compras = await comprasDaConta(db, String(de._id));
  if (compras.length === 0) return { enviado: false };

  await garantirIndices(db);
  const token = randomBytes(32).toString('base64url');
  await db.collection(COLECAO_VINCULOS).insertOne({
    hash: hashToken(token),
    deUserId: String(de._id),
    deEmail: email,
    paraUserId: String(para._id),
    paraEmail,
    createdAt: now,
    expiresAt: new Date(now.getTime() + VALIDADE_HORAS * 3600 * 1000),
    usadoEm: null,
  });
  await deps.enviarEmail({ email, name: de.name ?? undefined, paraEmail, token });
  await auditar(db, {
    acao: 'vincular-pedido',
    deUserId: String(de._id),
    paraUserId: String(para._id),
    paraEmail,
  });
  return { enviado: true };
}

export interface ResultadoVinculo {
  paraEmail: string;
  transferidas: string[];
  falhas: { subscriptionId: string; code: string }[];
}

/** O clique no link do e-mail A. Não exige login: o token é a prova. */
export async function confirmarVinculo(
  db: Db,
  tokenBruto: unknown,
  deps: { now?: () => Date } = {}
): Promise<ResultadoVinculo> {
  const now = deps.now?.() ?? new Date();
  const token = typeof tokenBruto === 'string' ? tokenBruto.trim() : '';
  const invalido = () =>
    new VinculoError(
      'link-invalido',
      410,
      'Esse link expirou ou já foi usado. Peça de novo pelo Club.'
    );
  if (!token || token.length > 100) throw invalido();

  const v: any = await db
    .collection(COLECAO_VINCULOS)
    .findOneAndUpdate(
      { hash: hashToken(token), usadoEm: null, expiresAt: { $gt: now } },
      { $set: { usadoEm: now } },
      { returnDocument: 'after' }
    );
  if (!v) throw invalido();

  const transferidas: string[] = [];
  const falhas: ResultadoVinculo['falhas'] = [];
  for (const id of await comprasDaConta(db, v.deUserId)) {
    try {
      const t = await transferirCompra(db, id, v.paraUserId);
      transferidas.push(t.alvo);
    } catch (e) {
      if (!(e instanceof TransferenciaError)) throw e;
      falhas.push({ subscriptionId: id, code: e.code });
    }
  }
  await auditar(db, {
    acao: 'vincular-confirmado',
    deUserId: v.deUserId,
    paraUserId: v.paraUserId,
    transferidas,
    falhas,
  });
  return { paraEmail: v.paraEmail, transferidas, falhas };
}

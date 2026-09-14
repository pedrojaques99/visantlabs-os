// Link mágico: entrar pelo e-mail, sem senha (14/09/2026).
//
// Existe pra conta que nasce pela compra. Ela não tem senha, e até aqui as
// saídas eram o Google ou o e-mail de "definir senha", que obriga a inventar
// uma senha pra entrar uma vez. O link entra direto.
//
// Segurança, e por que cada escolha:
//  - o token é aleatório (32 bytes) e NÃO é JWT: um JWT de login trafegando em
//    e-mail valeria até expirar, mesmo depois de usado. Aqui só o HASH fica no
//    banco, e o consumo é atômico (`findOneAndUpdate` com `usedAt: null`), então
//    ele serve uma vez;
//  - 15 minutos por padrão: é o tempo de abrir o e-mail, não de guardar o link;
//  - índice TTL em `expiresAt`: o Mongo apaga o que venceu, sem cron.
import crypto from 'crypto';
import { connectToMongoDB, getDb } from '../db/mongodb.js';

const COLECAO = 'magic_link_tokens';

export const MAGIC_LINK_TTL_MIN = Number(process.env.MAGIC_LINK_TTL_MIN || 15);

const hashDo = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

let indicesProntos = false;

async function colecao() {
  await connectToMongoDB();
  const c = getDb().collection(COLECAO);
  if (!indicesProntos) {
    try {
      await c.createIndex({ tokenHash: 1 }, { unique: true });
      await c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      indicesProntos = true;
    } catch (error: any) {
      // Corrida de criação entre instâncias não impede o uso: o insert e o
      // consumo seguem corretos com o índice criado por qualquer uma delas.
      console.warn('[MAGIC-LINK] createIndex falhou (não fatal):', error?.message);
    }
  }
  return c;
}

/** Cria um link de uso único pra esta conta e devolve o token em claro. */
export async function criarLinkMagico(userId: string, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  const c = await colecao();
  const agora = Date.now();
  await c.insertOne({
    tokenHash: hashDo(token),
    userId,
    email,
    createdAt: new Date(agora),
    expiresAt: new Date(agora + MAGIC_LINK_TTL_MIN * 60 * 1000),
    usedAt: null,
  });
  return token;
}

/**
 * Consome o token. Devolve a conta dona dele, ou `null` se ele não existe,
 * venceu ou já foi usado. Os três casos são a mesma resposta de propósito.
 */
export async function consumirLinkMagico(
  token: string
): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  const c = await colecao();
  const agora = new Date();
  const resultado: any = await c.findOneAndUpdate(
    { tokenHash: hashDo(token), usedAt: null, expiresAt: { $gt: agora } },
    { $set: { usedAt: agora } },
    { returnDocument: 'after' }
  );
  // O driver 6 devolve o documento; versões antigas devolviam `{ value }`.
  const doc = resultado && 'value' in resultado ? resultado.value : resultado;
  if (!doc?.userId) return null;
  return { userId: String(doc.userId), email: String(doc.email) };
}

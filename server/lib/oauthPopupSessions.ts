/**
 * Sessões do login com Google em popup (fluxo popup + poll, e o `return:` das
 * telas de OAuth).
 *
 * Moravam num `Map` em memória. Memória é por processo: some no restart ou no
 * deploy, e não é a mesma entre instâncias (Vercel, ou mais de um container).
 * O callback do Google caía numa instância que não conhecia a sessão e o aluno
 * via "Não deu pra entrar" (17/11/2026). Agora ficam no Mongo, que todas as
 * instâncias enxergam.
 *
 *  - `_id` é o sessionId (único por definição);
 *  - índice TTL em `expiresAt` apaga o que venceu. O monitor do TTL roda a cada
 *    ~60 s, então toda leitura também filtra por `expiresAt > agora`;
 *  - o `token` guardado é o JWT de 7 dias do usuário: fica só até o poll ler e
 *    é apagado na entrega (`entregarSessao` é atômico, entrega uma vez só).
 */
import type { Collection } from 'mongodb';
import { connectToMongoDB, getDb } from '../db/mongodb.js';

const COLECAO = 'oauth_popup_sessions';

/** Mesma janela do `Map` antigo: tempo de escolher a conta no Google. */
export const POPUP_SESSION_TTL_MS = 5 * 60 * 1000;

export interface PopupSession {
  _id: string;
  source?: string;
  returnTo?: string;
  token?: string;
  error?: string;
  createdAt: Date;
  expiresAt: Date;
}

let indicesProntos = false;

async function colecao(): Promise<Collection<PopupSession>> {
  await connectToMongoDB();
  const c = getDb().collection<PopupSession>(COLECAO);
  if (!indicesProntos) {
    try {
      await c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      indicesProntos = true;
    } catch (error: any) {
      // Sem o índice só deixa de apagar sozinho; a leitura já filtra o vencido.
      console.warn('[OAUTH-POPUP] createIndex falhou (não fatal):', error?.message);
    }
  }
  return c;
}

const vivo = () => ({ expiresAt: { $gt: new Date() } });

export async function criarSessao(
  id: string,
  dados: { source?: string; returnTo?: string }
): Promise<void> {
  const c = await colecao();
  const agora = Date.now();
  await c.insertOne({
    _id: id,
    ...(dados.source && { source: dados.source }),
    ...(dados.returnTo && { returnTo: dados.returnTo }),
    createdAt: new Date(agora),
    expiresAt: new Date(agora + POPUP_SESSION_TTL_MS),
  });
}

export async function lerSessao(id: string): Promise<PopupSession | null> {
  const c = await colecao();
  return c.findOne({ _id: id, ...vivo() });
}

/** Grava o resultado do callback. Devolve a sessão atualizada, ou null se não existe/venceu. */
export async function atualizarSessao(
  id: string,
  dados: { token: string } | { error: string }
): Promise<PopupSession | null> {
  const c = await colecao();
  return c.findOneAndUpdate({ _id: id, ...vivo() }, { $set: dados }, { returnDocument: 'after' });
}

/** Apaga e devolve o que havia (null se não existia ou venceu). */
export async function apagarSessao(id: string): Promise<PopupSession | null> {
  const c = await colecao();
  const doc = await c.findOneAndDelete({ _id: id });
  return doc && doc.expiresAt > new Date() ? doc : null;
}

/**
 * O que o poll vê. `complete`/`error` apagam a sessão na mesma operação, então
 * dois polls concorrentes (até em instâncias diferentes) não recebem o token
 * duas vezes.
 */
export async function entregarSessao(
  id: string
): Promise<
  | { status: 'complete'; token: string }
  | { status: 'error'; error: string }
  | { status: 'pending' }
  | { status: 'expired' }
> {
  const c = await colecao();
  const pronta = await c.findOneAndDelete({
    _id: id,
    ...vivo(),
    $or: [{ token: { $exists: true } }, { error: { $exists: true } }],
  });
  if (pronta?.error) return { status: 'error', error: pronta.error };
  if (pronta?.token) return { status: 'complete', token: pronta.token };
  return (await lerSessao(id)) ? { status: 'pending' } : { status: 'expired' };
}

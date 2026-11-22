// A sessão de quem entra pelo Club (21/11/2026, pedido do dono: "manter ele
// logado sempre").
//
// Antes, todo JWT de sessão vencia em 7 dias e não havia renovação: quem
// entrou pelo link mágico do e-mail de compra era deslogado na semana
// seguinte e tinha que pedir outro link. Agora a sessão dura 30 dias e o Club
// pede um token novo uma vez por dia (POST /api/auth/renovar), então quem usa
// nunca chega ao fim dos 30.
//
// Só o JWT de sessão "legado" ({ userId, email }) se renova. Token OAuth (MCP,
// com `aud`), chave de API e o token curto do checkout ficam de fora: renovar
// um desses esticaria uma credencial que nasceu pra durar pouco.
import jwt from 'jsonwebtoken';

/** Validade do JWT de sessão. Uma constante só, pra login, link mágico e renovação não divergirem. */
export const SESSAO_TTL = '30d';

export function assinarSessao(user: { id: string; email: string }, secret: string): string {
  return jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: SESSAO_TTL });
}

export type ResultadoRenovar =
  | { ok: true; token: string }
  | {
      ok: false;
      status: 401;
      motivo: 'sem-token' | 'token-invalido' | 'nao-e-sessao' | 'sem-usuario';
    };

/**
 * Troca um JWT de sessão VÁLIDO por um novo, com os mesmos dados e 30 dias a
 * partir de agora. O e-mail vem do banco, não do token velho: se mudou, o
 * token novo já sai certo.
 */
export async function renovarSessao(
  token: string | undefined,
  deps: {
    secret: string;
    acharUsuario: (id: string) => Promise<{ id: string; email: string } | null>;
  }
): Promise<ResultadoRenovar> {
  if (!token) return { ok: false, status: 401, motivo: 'sem-token' };
  let decoded: Record<string, unknown>;
  try {
    decoded = jwt.verify(token, deps.secret) as Record<string, unknown>;
  } catch {
    return { ok: false, status: 401, motivo: 'token-invalido' };
  }
  // Marca de token de outro uso (OAuth `aud`/`sub`, checkout `scope`, troca de
  // senha `type`): esses não viram sessão de 30 dias.
  const outroUso = ['aud', 'sub', 'scope', 'type', 'purpose'].some((k) => decoded[k] !== undefined);
  if (typeof decoded.userId !== 'string' || outroUso) {
    return { ok: false, status: 401, motivo: 'nao-e-sessao' };
  }
  const user = await deps.acharUsuario(decoded.userId);
  if (!user) return { ok: false, status: 401, motivo: 'sem-usuario' };
  return { ok: true, token: assinarSessao(user, deps.secret) };
}

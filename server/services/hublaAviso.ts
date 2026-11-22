// O "avisa quem comprou" da Hubla, montado fora da rota pra ser testável
// (21/11/2026). Antes morava inline em routes/payments.ts, e o formato do link
// (token, `next` pro curso, validade) não tinha teste nenhum.
//
// Link de uso único com 72 h: boleto compensa em dias e a pessoa abre o e-mail
// quando abre. Leva `next` pro caminho do que comprou, então o clique já cai
// logado no curso (Club: /entrar/link respeita `?next=` via `destinoSeguro`).
import type { Acesso } from './hublaWebhook.js';

export const HORAS_DO_LINK_DE_COMPRA = 72;

export interface AvisoDeps {
  criarLinkMagico: (userId: string, email: string, ttlMin: number) => Promise<string>;
  enviarEmailDeCompra: (p: {
    email: string;
    nome?: string | null;
    loginUrl: string;
    horas: number;
    acesso: Acesso;
  }) => Promise<void>;
  podeAvisarCompra: () => boolean;
  /** Origem do Club, sem barra no fim (ex.: https://app.visant.club). */
  base: string;
}

export function linkDeCompra(base: string, token: string, caminho: string): string {
  return `${base.replace(/\/+$/, '')}/entrar/link?token=${encodeURIComponent(token)}&next=${encodeURIComponent(caminho)}`;
}

export function criarAvisoDeCompra(d: AvisoDeps) {
  return async ({
    userId,
    email,
    name,
    acesso,
  }: {
    userId: string;
    email: string;
    name?: string;
    acesso: Acesso;
  }): Promise<void> => {
    if (!d.podeAvisarCompra()) throw new Error('email não configurado');
    const horas = HORAS_DO_LINK_DE_COMPRA;
    const token = await d.criarLinkMagico(userId, email, horas * 60);
    await d.enviarEmailDeCompra({
      email,
      nome: name,
      loginUrl: linkDeCompra(d.base, token, acesso.caminho),
      horas,
      acesso,
    });
  };
}

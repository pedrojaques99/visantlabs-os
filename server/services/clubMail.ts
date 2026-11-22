// E-mail de compra da Hubla com a cara do Visant Club (20/11/2026).
//
// O webhook da Hubla libera o produto aqui no Labs e avisa quem comprou. Até
// 20/11 o aviso saía pelo Resend do Labs, com o layout do Labs. Agora sai pelo
// MillionSend como `Visant Club <club@mail.visant.club>`, no mesmo visual dos
// e-mails do Club (banner, assinatura com o ícone), assinado pelo Pedro e
// puxando pra comunidade. Texto aprovado pelo dono no protótipo v3.
//
// Liga com CLUB_EMAIL_API_KEY (a mesma chave do MillionSend que o Club usa).
// Sem ela, `enviarEmailDeCompra` cai no e-mail antigo do Labs: nada quebra.
//
// Fetch direto na API (compatível com a do Resend) e não o SDK `resend`: o v4
// lê o endereço da API de uma env global, então não dá pra ter Resend e
// MillionSend no mesmo processo.
//
// Desde 21/11/2026 o dono edita estes três e-mails em app.visant.club/admin/emails.
// Na hora de mandar, `buscarModelo` pede ao Club o que ele salvou (GET
// /api/emails/modelo/compra-<tipo>, Bearer EMAIL_MODELO_SECRET), com 1,5 s de
// teto. Qualquer falha (sem env, Club fora, resposta estranha) devolve `null`, e
// o e-mail sai com o texto daqui. O e-mail de compra nunca falha por causa disso.
import { CLUB_BASE_URL } from '../lib/mcp-constants.js';
import { sendPurchaseAccessEmail, isEmailConfigured } from './emailService.js';
import type { Acesso } from './hublaWebhook.js';

const API = (process.env.CLUB_EMAIL_BASE_URL || 'https://api.millionsend.com').replace(/\/+$/, '');
const FROM = process.env.CLUB_EMAIL_FROM || 'Visant Club <club@mail.visant.club>';
const REPLY_TO = process.env.CLUB_EMAIL_REPLY_TO || 'contato@visant.co';

export const isClubMailConfigured = (): boolean => !!process.env.CLUB_EMAIL_API_KEY;

/** Dá pra avisar quem comprou por algum dos dois caminhos? */
export const podeAvisarCompra = (): boolean => isClubMailConfigured() || isEmailConfigured();

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const primeiroNome = (nome?: string | null): string | null => {
  const n = (nome || '').trim().split(/\s+/)[0];
  return n ? n.slice(0, 40) : null;
};

// Cores e imagens espelham lib/emails/textos.ts do visant-club.
const TINTA = '#111';
const FUNDO = '#fff';
const APAGADO = '#666';
const banner = (v: number) =>
  `https://app.visant.club/marca/${v > 0 ? `banner-email-${v}` : 'banner-email'}.png`;
const SELO = 'https://app.visant.club/marca/selo-email.png';

type Corpo = {
  assunto: string;
  paragrafos: string[];
  botao: string;
  convite?: { rotulo: string; url: string; resto: string };
};

/**
 * O que o dono salvou em /admin/emails do Club. Só os campos que ele mudou.
 * Espelha `Override` de lib/emails/modelos.ts do visant-club.
 */
export type ModeloEmail = Partial<{
  assunto: string;
  texto: string;
  botao: string;
  depois: string;
  rodape: string;
  banner: boolean;
  variacao: number;
  assinatura: boolean;
  quem: 'club' | 'pedro';
}>;

const LIMITES = { assunto: 200, texto: 4000, botao: 80, depois: 3000, rodape: 400 } as const;

/** Confere o formato campo a campo. O que não passa fica de fora (vale o padrão). */
export function lerModelo(raw: unknown): ModeloEmail | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const m: ModeloEmail = {};
  for (const k of Object.keys(LIMITES) as (keyof typeof LIMITES)[]) {
    const v = r[k];
    if (typeof v !== 'string' || v.length > LIMITES[k]) continue;
    // Assunto, botão e rodapé são uma linha só (assunto é header de e-mail).
    if (k !== 'texto' && k !== 'depois' && /[\r\n]/.test(v)) continue;
    if (k !== 'depois' && !v.trim()) continue;
    m[k] = v;
  }
  for (const k of ['banner', 'assinatura'] as const)
    if (typeof r[k] === 'boolean') m[k] = r[k] as boolean;
  if (Number.isInteger(r.variacao) && (r.variacao as number) >= 0 && (r.variacao as number) <= 3)
    m.variacao = r.variacao as number;
  if (r.quem === 'club' || r.quem === 'pedro') m.quem = r.quem;
  return Object.keys(m).length ? m : null;
}

/** Pede ao Club o modelo deste tipo de compra. Nunca lança: falhou, `null`. */
export async function buscarModelo(
  tipo: Acesso['tipo'],
  f: typeof fetch = fetch
): Promise<ModeloEmail | null> {
  const segredo = process.env.EMAIL_MODELO_SECRET;
  if (!segredo) return null;
  try {
    const r = await f(`${CLUB_BASE_URL}/api/emails/modelo/compra-${tipo}`, {
      headers: { Authorization: `Bearer ${segredo}` },
      signal: AbortSignal.timeout(1500),
    });
    if (!r.ok) return null;
    const corpo = (await r.json()) as { modelo?: unknown };
    return lerModelo(corpo?.modelo);
  } catch {
    return null;
  }
}

/**
 * Troca `{variavel}` pelo valor. Valor vazio leva junto a vírgula de antes
 * ("Oi, {nome}." sem nome vira "Oi."). Não escapa: quem põe no HTML escapa o
 * texto inteiro. Mesma regra de `substituir` no Club.
 */
export function substituir(s: string, vars: Record<string, string | null | undefined>): string {
  return s.replace(
    /(,[ \t]*)?\{([a-z_]+)\}/g,
    (todo, virgula: string | undefined, nome: string) => {
      if (!(nome in vars)) return todo;
      const v = (vars[nome] ?? '').trim();
      if (!v) return '';
      return `${virgula ?? ''}${v}`;
    }
  );
}

const paragrafos = (s: string) =>
  s
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** O texto por tipo de compra. `titulo` vem do Acesso (IA Labs, Visant Club, nome do e-book). */
function corpo(acesso: Acesso): Corpo {
  if (acesso.tipo === 'club') {
    return {
      assunto: 'Bem-vindo ao Visant Club',
      paragrafos: [
        'Que alegria ter você no Visant Club. Valeu de verdade por entrar.',
        'O Club é uma casa de designers que mostram o que estão fazendo, trocam dúvida e puxam um ao outro pra cima. A partir de hoje, ela é sua também.',
      ],
      botao: acesso.botao,
      convite: {
        rotulo: 'Conhecer os membros',
        url: `${CLUB_BASE_URL}/membros`,
        resto: 'começa se apresentando, todo mundo passou por esse primeiro post.',
      },
    };
  }
  if (acesso.tipo === 'ebook') {
    return {
      assunto: `Seu e-book chegou: ${acesso.titulo}`,
      paragrafos: [
        `Valeu por levar o e-book ${acesso.titulo}. É o jeito que a gente trabalha no estúdio, agora na sua mão.`,
      ],
      botao: acesso.botao,
    };
  }
  return {
    assunto: `Bem-vindo ao ${acesso.titulo}`,
    paragrafos: [
      `Fiquei muito feliz de ver você no ${acesso.titulo}. Valeu de verdade por entrar.`,
      'Você chega numa turma de designers que tá trazendo a IA pro dia a dia do trabalho. Cada um vai no seu ritmo, mas ninguém aprende sozinho: a dúvida de um vira aula pro outro.',
    ],
    botao: acesso.botao,
    convite: {
      rotulo: 'Entrar no grupo da turma',
      url: `${CLUB_BASE_URL}${acesso.caminho}`,
      resto: 'o convite tá na página do curso.',
    },
  };
}

/** Depois do botão: o que tem dentro e o pedido de conversa, por tipo. */
function depois(acesso: Acesso): string[] {
  if (acesso.tipo === 'club')
    return [
      'Lá dentro tem o acervo de aulas e as ferramentas que a gente usa no estúdio. Mas o melhor é a gente.',
      'E se quiser falar comigo direto, responde este e-mail.',
    ];
  if (acesso.tipo === 'ebook')
    return [
      'Ele fica guardado na sua conta do Visant Club, pra você voltar quando precisar.',
      'Quando usar num projeto, me conta como foi. Responde este e-mail, eu leio todos.',
    ];
  return [
    'Embaixo de cada aula tem espaço pra perguntar, e eu respondo ali. Os materiais estão junto das aulas, e no fim tem certificado.',
    'E me conta: o que você faz e o que te trouxe até aqui? Responde este e-mail, eu leio todos.',
  ];
}

export function emailDeCompra(
  p: { nome?: string | null; loginUrl: string; acesso: Acesso },
  modelo?: ModeloEmail | null
): {
  assunto: string;
  html: string;
  texto: string;
} {
  const c = corpo(p.acesso);
  const nome = primeiroNome(p.nome);
  let abertura = [`${nome ? `Oi, ${nome}.` : 'Oi.'} Aqui é o Pedro, da Visant.`, ...c.paragrafos];
  let fim = depois(p.acesso);
  let reserva = `Se o botão não abrir, entre em app.visant.club/entrar com este mesmo e-mail.${
    p.acesso.tipo === 'club' ? ' A cobrança fica na Hubla, em app.hub.la.' : ''
  }`;
  const visual = { banner: true, variacao: 0, assinatura: true, quem: 'pedro' as 'club' | 'pedro' };
  /* O que o dono salvou no Club entra por cima, campo a campo. */
  if (modelo) {
    const vars = { nome, curso: p.acesso.titulo, ebook: p.acesso.titulo };
    const linha = (s: string | undefined, antes: string) =>
      s ? substituir(s, vars).trim() || antes : antes;
    const pars = (s: string) =>
      paragrafos(s)
        .map((t) => substituir(t, vars).trim())
        .filter(Boolean);
    c.assunto = linha(modelo.assunto, c.assunto);
    c.botao = linha(modelo.botao, c.botao);
    reserva = linha(modelo.rodape, reserva);
    if (modelo.texto !== undefined && pars(modelo.texto).length) abertura = pars(modelo.texto);
    if (modelo.depois !== undefined) fim = pars(modelo.depois);
    for (const k of ['banner', 'variacao', 'assinatura', 'quem'] as const)
      if (modelo[k] !== undefined) (visual as Record<string, unknown>)[k] = modelo[k];
  }

  const P = ['margin:0 0 16px', 'font-size:16px', 'line-height:1.5', `color:${TINTA}`].join(';');
  const par = (t: string) => `<p style="${P}">${esc(t)}</p>`;
  const BTN = [
    'display:inline-block',
    `background:${TINTA}`,
    `color:${FUNDO}`,
    'text-decoration:none',
    'padding:12px 20px',
    'border-radius:8px',
    'font-size:16px',
  ].join(';');
  const PEQ = ['margin:24px 0 0', 'font-size:13px', 'line-height:1.5', `color:${APAGADO}`].join(
    ';'
  );
  const IMG_BANNER = [
    'display:block',
    'width:100%',
    'max-width:520px',
    'height:auto',
    'border:0',
    'border-radius:8px',
    'margin:0 0 28px',
  ].join(';');
  const CSS_V = ['width:40px', 'height:40px', `background:${TINTA}`, 'border-radius:6px'].join(';');
  const IMG_V = [
    'display:block',
    'width:40px',
    'height:40px',
    'border:0',
    'border-radius:6px',
  ].join(';');
  const CSS_T = [
    'padding:0 0 0 12px',
    'font-size:13px',
    'line-height:1.45',
    `color:${APAGADO}`,
  ].join(';');

  const convite = c.convite
    ? `<p style="${P}"><a href="${esc(c.convite.url)}" style="color:${TINTA};font-weight:600">${esc(c.convite.rotulo)}</a>: ${esc(c.convite.resto)}</p>`
    : '';

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:${FUNDO};font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
${visual.banner ? `<img src="${banner(visual.variacao)}" width="520" alt="Visant Club" style="${IMG_BANNER}">` : ''}
${par(abertura[0])}
${abertura.slice(1).map(par).join('\n')}
<p style="margin:8px 0 24px"><a href="${esc(p.loginUrl)}" style="${BTN}">${esc(c.botao)}</a></p>
${fim.length ? par(fim[0]) : ''}
${convite}
${fim.slice(1).map(par).join('\n')}
${visual.quem === 'pedro' ? `<p style="${P}">Um abraço,<br>Pedro</p>` : ''}
${
  visual.assinatura
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;border-collapse:collapse"><tr>
<td width="40" height="40" style="${CSS_V}"><img src="${SELO}" width="40" height="40" alt="Visant" style="${IMG_V}"></td>
<td style="${CSS_T}"><b style="color:${TINTA};font-size:14px">Visant Club</b><br>Cursos e ferramentas pra designer<br><a href="https://visant.club" style="color:${APAGADO}">visant.club</a><br>contato@visant.co</td>
</tr></table>`
    : ''
}
<p style="${PEQ}">${esc(reserva)}</p>
</div></body></html>`;

  const texto = [
    ...abertura,
    `${c.botao}: ${p.loginUrl}`,
    ...(fim.length ? [fim[0]] : []),
    ...(c.convite ? [`${c.convite.rotulo}: ${c.convite.url}`] : []),
    ...fim.slice(1),
    ...(visual.quem === 'pedro' ? ['Um abraço,\nPedro'] : []),
    ...(visual.assinatura
      ? ['Visant Club\nCursos e ferramentas pra designer\nvisant.club\ncontato@visant.co']
      : []),
    reserva,
  ].join('\n\n');

  return { assunto: c.assunto, html, texto };
}

async function enviarPeloClub(p: {
  email: string;
  nome?: string | null;
  loginUrl: string;
  acesso: Acesso;
}) {
  const m = emailDeCompra(p, await buscarModelo(p.acesso.tipo));
  const r = await fetch(`${API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLUB_EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [p.email],
      reply_to: REPLY_TO,
      subject: m.assunto,
      html: m.html,
      text: m.texto,
    }),
    // Teto de 10 s (21/11/2026): MillionSend pendurado segurava a resposta do
    // webhook. Estourou, cai no e-mail do Labs logo abaixo.
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) {
    // O corpo do erro do provedor não leva o e-mail de quem comprou.
    const corpoErro = await r.text().catch(() => '');
    throw new Error(`MillionSend ${r.status}: ${corpoErro.slice(0, 300)}`);
  }
}

/**
 * Avisa quem comprou. Com CLUB_EMAIL_API_KEY sai o e-mail da casa; sem ela, ou
 * se o MillionSend falhar, sai o e-mail antigo do Labs, pra ninguém ficar sem acesso.
 */
export async function enviarEmailDeCompra(p: {
  email: string;
  nome?: string | null;
  loginUrl: string;
  horas: number;
  acesso: Acesso;
}): Promise<void> {
  if (isClubMailConfigured()) {
    try {
      await enviarPeloClub(p);
      return;
    } catch (e) {
      if (!isEmailConfigured()) throw e;
      console.error(
        '[clubMail] MillionSend falhou, usando o e-mail do Labs:',
        (e as Error).message
      );
    }
  }
  await sendPurchaseAccessEmail({
    email: p.email,
    name: p.nome ?? undefined,
    loginUrl: p.loginUrl,
    titulo: p.acesso.titulo,
    horas: p.horas,
    abertura: p.acesso.abertura,
    onde: p.acesso.onde,
    botao: p.acesso.botao,
  });
}

/**
 * Página de retorno do OAuth em popup (fluxo popup + poll).
 *
 * SSoT de QUEM abriu o popup. O callback do Google não sabe de onde veio o
 * login — quem sabe é a sessão criada em /auth/google?source=<x>. Sem isso a
 * página fala "volte para o Figma" pra quem entrou pelo Club.
 *
 * Fonte nova = adicionar uma entrada aqui e mandar ?source=<chave>.
 *
 * Os quatro fluxos de auth da casa e quando usar cada um: docs/AUTH_FLOWS.md.
 */

import { buildPopupResultPage } from '../routes/oauth-pages.js';
import { SUPPORT_EMAIL } from './mcp-constants.js';

export type PopupOAuthSource = keyof typeof POPUP_OAUTH_SOURCES;

export const POPUP_OAUTH_SOURCES = {
  plugin: { product: 'Figma', backTo: 'Volte para o Figma' },
  club: { product: 'Visant Club', backTo: 'Volte para o Visant Club' },
  app: { product: 'Visant Labs', backTo: 'Volte para o Visant Labs' },
  cli: { product: 'terminal', backTo: 'Volte para o terminal' },
} as const;

const FALLBACK = { product: 'Visant', backTo: 'Volte para a janela anterior' };

export function isPopupOAuthSource(value: unknown): value is PopupOAuthSource {
  return typeof value === 'string' && value in POPUP_OAUTH_SOURCES;
}

function copyFor(source?: string) {
  return isPopupOAuthSource(source) ? POPUP_OAUTH_SOURCES[source] : FALLBACK;
}

// A casca visual é a mesma das telas de OAuth (tokens do design system, ícone
// Phosphor, tema claro e escuro, fecha sozinho quando é popup).

/** Página de sucesso do popup — o token já foi entregue ao poll. */
export function renderPopupSuccessPage(source?: string): string {
  const { backTo } = copyFor(source);
  return buildPopupResultPage({
    ok: true,
    title: 'Login concluído',
    lead: `${backTo} para continuar.`,
    hint: 'Você já pode fechar esta aba.',
  });
}

/** Página de erro do popup — o poll recebe o erro em paralelo. */
export function renderPopupErrorPage(source?: string): string {
  const { product } = copyFor(source);
  return buildPopupResultPage({
    ok: false,
    title: 'Não deu pra entrar',
    lead: `Feche esta aba e tente de novo pelo ${product}.`,
    hint: `Se insistir, fale com ${SUPPORT_EMAIL}.`,
  });
}

import { colord } from 'colord';

/**
 * Fundo do thumb de logo — escolhido pela MARCA, não pelo tema do app.
 *
 * O avatar pintava `bg-white/5` pra todo mundo, um quase-preto. Logo escuro
 * sumia: no grid, marca com wordmark preto virava um quadradinho vazio, e ela
 * fica visualmente idêntica a marca com asset quebrado.
 *
 * A decisão sai de um dado que já existe e que ninguém estava lendo: a
 * **variante** do logo. Ela é a declaração do designer sobre pra que fundo
 * aquele arquivo foi desenhado.
 *
 *   variant 'light'  → mark claro, feito pra pousar em fundo escuro
 *   variant 'dark'   → mark escuro, feito pra pousar em fundo claro
 *   'primary'/'icon' → sem declaração: cai na cor de fundo da própria marca
 *
 * Nunca inventa matiz. Sem cor cadastrada, devolve `null` e quem chama mantém
 * o neutro — um fundo aleatório seria pior que um fundo apagado.
 */

type LogoLike = { url: string; variant?: string } | null | undefined;
type ColorLike = { hex?: string; role?: string; usageRank?: number } | null | undefined;

export interface AvatarBgInput {
  logos?: LogoLike[] | null;
  colors?: ColorLike[] | null;
  /** URL efetivamente exibida — é ela que diz QUAL variante está na tela. */
  shownUrl?: string;
}

/**
 * Distância mínima de brilho entre as pontas da paleta pra valer a pena pintar.
 * Usa `brightness` (0..1) e não `contrast` de propósito: contraste WCAG mora no
 * plugin a11y do colord, que este bundle não carrega, e aqui a pergunta é mais
 * simples — "essa paleta tem claro e escuro, ou é tudo o mesmo tom?".
 */
const MIN_BRIGHTNESS_DELTA = 0.22;

const hexOf = (c: ColorLike) => (c?.hex || '').trim();

function pick(colors: ColorLike[], roles: string[]): string | null {
  for (const role of roles) {
    const hit = colors.find((c) => (c?.role || '').toLowerCase() === role && hexOf(c));
    if (hit) return hexOf(hit);
  }
  return null;
}

/**
 * @returns hex do fundo, ou null quando não há base pra decidir.
 */
export function brandAvatarBg(input: AvatarBgInput): string | null {
  const logos = (input.logos || []).filter(Boolean) as Array<{ url: string; variant?: string }>;
  const colors = (input.colors || []).filter((c) => hexOf(c)) as ColorLike[];
  if (colors.length === 0 && logos.length === 0) return null;

  const shown = input.shownUrl
    ? logos.find((l) => l.url === input.shownUrl)
    : (logos.find((l) => l.variant === 'icon') ?? logos.find((l) => l.variant === 'primary'));
  const variant = (shown?.variant || '').toLowerCase();

  // Ordenadas por uso: a primeira é a cor que a marca mais usa.
  const ranked = [...colors].sort((a, b) => (a?.usageRank ?? 99) - (b?.usageRank ?? 99));
  const ordered = ranked.map(hexOf).filter((h) => colord(h).isValid());
  if (ordered.length === 0) return null;

  const lightest = [...ordered].sort((a, b) => colord(b).brightness() - colord(a).brightness())[0];
  const darkest = [...ordered].sort((a, b) => colord(a).brightness() - colord(b).brightness())[0];

  // Variante declarada: o fundo é o oposto do mark, e sai da paleta da marca.
  if (variant === 'light') return darkest;
  if (variant === 'dark') return lightest;

  // Sem declaração: usa a cor de fundo da marca se ela existir como papel.
  const declared = pick(ranked, ['background', 'bg', 'surface']);
  if (declared) return declared;

  // Último recurso: a cor mais usada, desde que ela própria não seja o mark.
  // Quando as duas pontas da paleta quase não contrastam entre si, um fundo
  // colorido não resolve nada — melhor devolver null e manter o neutro.
  const delta = colord(lightest).brightness() - colord(darkest).brightness();
  if (delta < MIN_BRIGHTNESS_DELTA) return null;
  return ordered[0];
}

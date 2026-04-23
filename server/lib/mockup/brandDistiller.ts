/**
 * brandDistiller — transforma um BrandGuideline completo em um "brief" curto,
 * acionável, pronto pra virar contexto de prompt de geração de mockup.
 *
 * Por que existe: o BrandGuideline é denso (arquétipos, personas, tokens,
 * dos/donts, médias...). Jogar tudo isso no prompt Gemini satura o contexto
 * e dilui o sinal. Aqui a gente escolhe só o que vira direção de arte.
 *
 * Regras de ouro:
 *  - Texto final ≤ ~500 chars (não explode o prompt).
 *  - Só fatos acionáveis — "use azul-marinho nas cores ambiente" > "a marca valoriza serenidade".
 *  - Zero dependência. Função pura, fácil de testar.
 */

import type { BrandGuideline } from '../../types/brandGuideline.js';

export interface BrandBrief {
  /** Nome da marca (fallback: "the brand"). */
  name: string;
  /** Arquétipos primários (máx 2). */
  archetypes: string[];
  /** Paleta ambiente — hex strings prontas pro prompt (máx 4, ordenadas por prioridade). */
  palette: string[];
  /** Famílias tipográficas relevantes (máx 2). */
  typography: string[];
  /** Voice/tone em uma linha. */
  voice: string | null;
  /** Do's acionáveis (máx 3). */
  dos: string[];
  /** Don'ts acionáveis (máx 3). */
  donts: string[];
  /** Nota curta de imagery (como a marca fotografa). */
  imagery: string | null;
  /** Render final já montado pra colar no prompt Gemini. */
  promptText: string;
}

const take = <T>(arr: T[] | undefined | null, n: number): T[] =>
  Array.isArray(arr) ? arr.slice(0, n) : [];

const clean = (s: string | null | undefined, max = 120): string | null => {
  if (!s) return null;
  const trimmed = s.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed;
};

/**
 * Destila um BrandGuideline em um BrandBrief conciso.
 * Retorna `null` se o input for nulo/vazio — assim o chamador pode tratar
 * "tem brand" vs "não tem brand" com uma única checagem.
 */
export function distillBrandGuideline(
  guideline: BrandGuideline | null | undefined,
): BrandBrief | null {
  if (!guideline) return null;

  const name = clean(guideline.identity?.name) || 'the brand';

  // Arquétipos: prioriza o marcado como 'primary', fallback pros dois primeiros.
  const archetypesRaw = guideline.strategy?.archetypes ?? [];
  const primary = archetypesRaw.find(a => a.role === 'primary');
  const archetypes = [
    ...(primary ? [primary.name] : []),
    ...archetypesRaw.filter(a => a !== primary).map(a => a.name),
  ]
    .filter(Boolean)
    .slice(0, 2);

  // Paleta: prioriza roles "primary"/"accent"/"cta" (os que importam em ambiente).
  const colorsRaw = guideline.colors ?? [];
  const priorityRoles = ['primary', 'accent', 'cta', 'background'];
  const sortedColors = [...colorsRaw].sort((a, b) => {
    const ai = priorityRoles.indexOf((a.role ?? '').toLowerCase());
    const bi = priorityRoles.indexOf((b.role ?? '').toLowerCase());
    const an = ai === -1 ? 99 : ai;
    const bn = bi === -1 ? 99 : bi;
    return an - bn;
  });
  const palette = take(sortedColors, 4).map(c =>
    c.name ? `${c.hex} (${c.name})` : c.hex,
  );

  // Tipografia: máx 2 famílias únicas, prioriza heading/body.
  const typoRaw = guideline.typography ?? [];
  const headings = typoRaw.filter(t => (t.role ?? '').toLowerCase() === 'heading');
  const body = typoRaw.filter(t => (t.role ?? '').toLowerCase() === 'body');
  const typographyFamilies = [...new Set([...headings, ...body, ...typoRaw].map(t => t.family))]
    .filter(Boolean)
    .slice(0, 2);

  // Voice: pega o guidelines.voice direto, ou o primeiro voiceValues.description.
  const voice =
    clean(guideline.guidelines?.voice) ||
    clean(guideline.strategy?.voiceValues?.[0]?.description) ||
    null;

  const dos = take(guideline.guidelines?.dos, 3)
    .map(d => clean(d, 80))
    .filter((x): x is string => !!x);
  const donts = take(guideline.guidelines?.donts, 3)
    .map(d => clean(d, 80))
    .filter((x): x is string => !!x);

  const imagery = clean(guideline.guidelines?.imagery, 140);

  // Monta o promptText — estrutura compacta, multi-linha, ≤ ~500 chars.
  const lines: string[] = [];
  lines.push(`Brand: ${name}.`);
  if (archetypes.length) lines.push(`Archetype: ${archetypes.join(' + ')}.`);
  if (palette.length) lines.push(`Ambient palette: ${palette.join(', ')}.`);
  if (typographyFamilies.length)
    lines.push(`Typography signal: ${typographyFamilies.join(', ')}.`);
  if (voice) lines.push(`Voice: ${voice}.`);
  if (imagery) lines.push(`Imagery rule: ${imagery}.`);
  if (dos.length) lines.push(`DO: ${dos.join('; ')}.`);
  if (donts.length) lines.push(`DON'T: ${donts.join('; ')}.`);

  let promptText = lines.join(' ');
  if (promptText.length > 500) promptText = promptText.slice(0, 499) + '…';

  return {
    name,
    archetypes,
    palette,
    typography: typographyFamilies,
    voice,
    dos,
    donts,
    imagery,
    promptText,
  };
}

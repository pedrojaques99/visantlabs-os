/**
 * Short, bilingual catalogue titles for references — prompt + normaliser,
 * shared by the ingest/enrichment path and the backfill script so both produce
 * the same shape.
 *
 * Why not reuse `describeImage().title`: that helper is a generic image
 * describer and its title is a caption, not a title. It returns things like
 * "Composição Abstrata de Tubos Pretos e Cartão Cinza" — 7 words, useless in a
 * masonry card. A reference title has to survive being read at a glance in a
 * grid, so it is capped hard, in both the prompt and the code.
 *
 * Bilingual costs nothing extra: both languages come back from ONE vision call
 * via the structured-output schema. Storage shape is
 * `name` (EN, canonical — matches the ~4.7k legacy EN names and the English tag
 * vocabulary, and is what the slug derives from) plus `nameI18n: { en, pt }`
 * for the UI to pick by locale.
 */

/** Hard ceilings enforced after the model answers. The prompt asks for less. */
export const TITLE_MAX_WORDS = 5;
export const TITLE_MAX_CHARS = 42;

export type TitleLang = 'en' | 'pt';

export interface BilingualTitle {
  en: string;
  pt: string;
}

export const SHORT_TITLE_PROMPT = `You name design pieces in a visual reference catalogue.

Title this image in BOTH English and Brazilian Portuguese.

Rules:
- Maximum ${TITLE_MAX_WORDS} words per language.
- Name WHAT THE PIECE IS, not what appears in it. "Business card", not "Black cable holding a card".
- No leading article, no trailing period, no quotes.
- No filler adjectives ("beautiful", "modern", "abstract") unless it is the defining trait.
- English: Title Case. Portuguese: sentence case (first word only), except proper nouns.
- The two titles must name the same thing — a translation, not two different readings.

Examples:
  en "Spiral Business Card"      pt "Cartão de visita espiral"
  en "Editorial Book Cover"      pt "Capa de livro editorial"
  en "Grey Gradient"             pt "Gradiente cinza"
  en "Typographic Identity"      pt "Identidade tipográfica"`;

/**
 * Connectors that must never END a title. Truncating "Cartão de visita com
 * suporte" at 5 words yields "...com", which reads as a bug. Same for English
 * ("Business Card On A").
 */
const TRAILING_STOPWORDS: Record<TitleLang, Set<string>> = {
  pt: new Set([
    'de',
    'da',
    'do',
    'das',
    'dos',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'com',
    'sem',
    'para',
    'por',
    'e',
    'a',
    'o',
    'as',
    'os',
    'um',
    'uma',
    'ao',
    'à',
  ]),
  en: new Set(['of', 'in', 'on', 'at', 'for', 'with', 'and', 'the', 'a', 'an', 'to', 'by', 'from']),
};

/** Words English Title Case leaves lowercase when they are not the first word. */
const EN_MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

function trimTrailingStopwords(words: string[], lang: TitleLang): string[] {
  const stop = TRAILING_STOPWORDS[lang];
  const out = [...words];
  while (out.length > 1 && stop.has(out[out.length - 1].toLowerCase())) out.pop();
  return out;
}

/**
 * English catalogue titles are Title Case (matching the ~4.7k legacy names);
 * Portuguese capitalises the first word only. Words the model wrote in all-caps
 * mid-string are left alone — those are brand names, not casing noise.
 */
function applyCase(words: string[], lang: TitleLang): string {
  if (lang === 'pt') {
    const joined = words.join(' ');
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }
  return words
    .map((w, i) => {
      if (w === w.toUpperCase() && w.length > 1) return w; // acronym / brand
      const lower = w.toLowerCase();
      if (i > 0 && EN_MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Enforce the contract the prompt asks for. Models drift — they add periods,
 * quote the answer, or ignore the word cap — so the ceiling lives here too.
 * Truncation is at a word boundary; a clipped word reads as a bug.
 */
export function normalizeTitle(raw?: string | null, lang: TitleLang = 'pt'): string | undefined {
  let t = (raw || '')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[.。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return undefined;

  let words = t.split(' ');
  if (words.length > TITLE_MAX_WORDS) words = words.slice(0, TITLE_MAX_WORDS);
  words = trimTrailingStopwords(words, lang);
  t = applyCase(words, lang);

  if (t.length > TITLE_MAX_CHARS) {
    const cut = t.slice(0, TITLE_MAX_CHARS);
    const lastSpace = cut.lastIndexOf(' ');
    const clipped = (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trim();
    t = applyCase(trimTrailingStopwords(clipped.split(' '), lang), lang);
  }

  return t || undefined;
}

/**
 * Normalise a raw `{ title_en, title_pt }` model answer. Returns undefined
 * unless BOTH languages survive — a half-filled pair would silently leave one
 * locale showing the junk name it was supposed to replace.
 */
export function normalizeBilingual(raw: {
  title_en?: string;
  title_pt?: string;
}): BilingualTitle | undefined {
  const en = normalizeTitle(raw?.title_en, 'en');
  const pt = normalizeTitle(raw?.title_pt, 'pt');
  return en && pt ? { en, pt } : undefined;
}

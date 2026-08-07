/**
 * Reference naming rules — the PURE half, importable by both the browser bundle
 * and the server. No node built-ins here on purpose: `makeSlug` needs crypto,
 * so it lives in server/lib/references/naming.ts, which re-exports this file.
 *
 * One source of truth for "this name carries no information" matters because
 * three places ask the question and used to disagree: ingest wrote `'Reference'`
 * as a fallback, enrichment guarded with `name || analysis.title` (so a truthy
 * placeholder shadowed the AI title forever), and the grid guessed by preferring
 * studio/designer over the name entirely.
 */

/** Ingest-time fallback title. Truthy, which is exactly why it needs catching. */
export const PLACEHOLDER_NAME = 'Reference';

/** Names that carry no information about the image. */
const PLACEHOLDER_EXACT = new Set([
  'reference',
  'references',
  'referencia',
  'referência',
  'untitled',
  'sem titulo',
  'sem título',
  'sem nome',
  'image',
  'imagem',
  'download',
  'unnamed',
  'new',
  'copy',
]);

/** Camera / screenshot / export filenames — a filename is not a title. */
const FILENAME_PATTERNS = [
  /^img[\s_-]*\d+$/i,
  /^dsc[\s_-]*\d+$/i,
  /^dscf?\d+$/i,
  /^photo[\s_-]*\d*$/i,
  /^image[\s_-]*\(?\d+\)?$/i,
  /^screen[\s_-]?shot.*$/i,
  /^captura[\s_-]?de[\s_-]?tela.*$/i,
  /^download[\s_-]*\(?\d*\)?$/i,
  /^untitled[\s_-]*\d*$/i,
  /^pasted[\s_-]?image.*$/i,
  /^[0-9a-f]{8,}$/i, // bare hash / uuid fragment
  /^\d+$/, // bare number
];

/** Legacy internal id-slugs that leaked into `name` (ref_urbanstay_56, club_ref_69…). */
const INTERNAL_SLUG = /^(?:userref[-_]|club[-_]?ref[-_]|ref[-_])(.+)$/i;

/**
 * True when `raw` should be treated as "no name at all" — empty, a placeholder,
 * a filename, or an internal id-slug with nothing human left in it.
 */
export function isPlaceholderName(raw?: string | null): boolean {
  const stripped = (raw || '')
    .trim()
    .replace(/\.(jpe?g|png|webp|gif|avif|tiff?)$/i, '')
    .trim();
  if (!stripped) return true;
  if (stripped.length < 3) return true;
  if (PLACEHOLDER_EXACT.has(stripped.toLowerCase())) return true;
  if (FILENAME_PATTERNS.some((re) => re.test(stripped))) return true;

  const internal = stripped.match(INTERNAL_SLUG);
  if (internal) return !cleanInternalSlug(internal[1]);
  return false;
}

/** Strip the trailing counter off an internal slug; empty when only an id remains. */
function cleanInternalSlug(tail: string): string {
  const cleaned = tail
    .replace(/[-_]\d+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return cleaned && !/^\d+$/.test(cleaned) ? cleaned : '';
}

/**
 * Pick the first meaningful name from candidates, in priority order, skipping
 * placeholders. Falls back to PLACEHOLDER_NAME so a doc always has something.
 */
export function pickName(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    if (!isPlaceholderName(c)) return (c as string).trim();
  }
  return PLACEHOLDER_NAME;
}

/**
 * Lowercase FIRST: some stored dimension values carry junk casing straight from
 * the model ("bacKgRouNd"), and capitalising only the initial letter would
 * preserve the rest of the mess.
 */
export function titleCase(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export interface ComposableRef {
  studio?: string;
  dimensions?: Record<string, string[] | undefined> | null;
  provenance?: { designer?: string } | null;
}

/** First non-empty value across the given dimension keys, in priority order. */
function firstOf(dims: ComposableRef['dimensions'], keys: string[]): string | undefined {
  for (const key of keys) {
    const v = dims?.[key];
    if (v?.length && v[0]?.trim()) return v[0].trim();
  }
  return undefined;
}

/**
 * Compose a title from what enrichment already extracted. Shape:
 *   "<Qualifier> <Artifact> · <Attribution>"
 *
 * Deterministic and free — no model call. Returns undefined when there is
 * nothing to build from, so callers count the doc as needing enrichment rather
 * than inventing a name.
 *
 * Known limitation: `aesthetic[0]` is "minimalist" for a large share of the
 * library, so composed names repeat. Prefer a real AI title when one exists.
 */
export function composeName(row: ComposableRef): string | undefined {
  const dims = row.dimensions;
  const artifact = firstOf(dims, ['brand_artifact', 'mockup_type', 'niche']);
  const qualifier = firstOf(dims, ['aesthetic', 'type_style', 'vibe', 'color_mood']);
  if (!artifact && !qualifier) return undefined;

  const parts: string[] = [];
  if (qualifier) parts.push(titleCase(qualifier));
  // Don't repeat the same word twice ("Editorial Editorial").
  if (artifact && titleCase(artifact) !== parts[0]) parts.push(titleCase(artifact));

  let name = parts.join(' ');
  const attribution = row.provenance?.designer?.trim() || row.studio?.trim();
  if (attribution) name += ` · ${attribution}`;
  return name;
}

export interface NameI18n {
  en?: string;
  pt?: string;
}

export interface LocalizableRef extends ComposableRef {
  name?: string;
  nameI18n?: NameI18n | null;
}

/**
 * The title to show, in the viewer's language.
 *
 * Precedence is name-first ON PURPOSE. The old grid preferred studio/designer
 * because names were junk — which made every Visant-curated row render as
 * "Visant Curated". Now that names are real, attribution is the fallback, not
 * the headline.
 */
export function localizedName(
  item: LocalizableRef,
  locale: string,
  fallback = 'Referência'
): string {
  const lang = locale?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
  const localized = item.nameI18n?.[lang] || item.nameI18n?.[lang === 'pt' ? 'en' : 'pt'];
  if (!isPlaceholderName(localized)) return (localized as string).trim();

  const raw = (item.name || '').trim();
  if (!isPlaceholderName(raw)) {
    const internal = raw.match(INTERNAL_SLUG);
    return internal ? titleCase(cleanInternalSlug(internal[1])) : raw;
  }

  return composeName(item) || item.provenance?.designer?.trim() || item.studio?.trim() || fallback;
}

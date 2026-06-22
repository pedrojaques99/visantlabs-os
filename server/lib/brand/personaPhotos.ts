/**
 * Resolve free stock portraits for brand personas that have no image yet.
 *
 * Reuses the existing visual-search aggregator (Unsplash + Pexels), so it
 * respects API keys, caching and Unsplash's download-trigger attribution
 * requirement. Gender is taken from an explicit `persona.gender` when present,
 * otherwise inferred from the first name with a small heuristic (falls back to a
 * gender-neutral portrait query).
 */
import { aggregateSearch, triggerUnsplashDownload } from '../../services/visualSearchService.js';

export type PersonaGender = 'male' | 'female' | 'neutral';

export interface PersonaLike {
  name?: string;
  age?: number;
  occupation?: string;
  gender?: string;
  image?: string;
  [k: string]: unknown;
}

// Compact lists of very common PT/EN names — high-precision, heuristic fallback
// for anything else. Lowercase, accent-insensitive (see normalize()).
const FEMALE_NAMES = new Set([
  'maria',
  'ana',
  'julia',
  'juliana',
  'beatriz',
  'mariana',
  'carla',
  'camila',
  'fernanda',
  'patricia',
  'sofia',
  'sophia',
  'isabela',
  'isabella',
  'larissa',
  'leticia',
  'gabriela',
  'amanda',
  'bruna',
  'rafaela',
  'luiza',
  'helena',
  'laura',
  'clara',
  'alice',
  'lola',
  'emma',
  'olivia',
  'mia',
  'charlotte',
  'sarah',
  'sara',
  'emily',
  'jessica',
  'jennifer',
  'lisa',
  'anna',
  'elena',
  'nina',
  'paula',
  'renata',
]);
const MALE_NAMES = new Set([
  'joao',
  'jose',
  'pedro',
  'lucas',
  'gabriel',
  'rafael',
  'gustavo',
  'felipe',
  'bruno',
  'rodrigo',
  'ricardo',
  'carlos',
  'paulo',
  'marcos',
  'andre',
  'thiago',
  'tiago',
  'diego',
  'eduardo',
  'fernando',
  'leonardo',
  'matheus',
  'vinicius',
  'daniel',
  'henrique',
  'caio',
  'james',
  'john',
  'robert',
  'michael',
  'william',
  'david',
  'mark',
  'tom',
  'thomas',
  'alex',
  'chris',
  'ryan',
  'kevin',
  'jorge',
  'luiz',
  'luis',
]);

// Combining diacritical marks block (U+0300–U+036F); RegExp ctor keeps source ASCII.
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalize(s: string): string {
  return s.normalize('NFD').replace(DIACRITICS, '').toLowerCase().trim();
}

export function inferGender(persona: PersonaLike): PersonaGender {
  const explicit = (persona.gender || '').toLowerCase();
  if (explicit === 'male' || explicit === 'female' || explicit === 'neutral') return explicit;
  // PT synonyms occasionally stored
  if (['homem', 'masculino', 'm'].includes(explicit)) return 'male';
  if (['mulher', 'feminino', 'f'].includes(explicit)) return 'female';

  const first = normalize(persona.name || '').split(/\s+/)[0];
  if (!first) return 'neutral';
  if (FEMALE_NAMES.has(first)) return 'female';
  if (MALE_NAMES.has(first)) return 'male';
  // PT ending heuristic: names ending in "a" skew female, "o" skew male.
  if (/a$/.test(first)) return 'female';
  if (/o$/.test(first)) return 'male';
  return 'neutral';
}

function buildQuery(persona: PersonaLike, gender: PersonaGender, styleHint?: string): string {
  const who = gender === 'male' ? 'man' : gender === 'female' ? 'woman' : 'person';
  const occ = (persona.occupation || '').toString().trim();
  // "candid portrait / real person" biases toward real headshots over abstract art;
  // the brand styleHint nudges the photographic mood toward the brand's imagery.
  return [
    `candid portrait of a ${who}`,
    occ,
    styleHint || 'natural light',
    'documentary style, real person',
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Derive a short photographic-mood hint from the brand so auto-resolved
 * portraits feel coherent (vs random stock). Prefers the brand's stated imagery
 * direction, falls back to its tone-of-voice words.
 */
export function brandImageryHint(guideline: any): string | undefined {
  const imagery = guideline?.guidelines?.imagery;
  if (typeof imagery === 'string' && imagery.trim()) {
    return imagery.split(/[.\n]/)[0].trim().slice(0, 80);
  }
  const tone = (guideline?.strategy?.voiceValues || [])
    .map((v: any) => v?.title)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  return tone || undefined;
}

export interface ResolvedPortrait {
  imageUrl: string;
  attribution?: { author: string; authorUrl?: string; license: string };
}

/** Resolve a single portrait URL for a persona (or null if none found). */
export async function resolvePersonaPortrait(
  persona: PersonaLike,
  seedOffset = 0,
  styleHint?: string
): Promise<ResolvedPortrait | null> {
  const gender = inferGender(persona);
  const query = buildQuery(persona, gender, styleHint);

  const { results } = await aggregateSearch({
    query,
    intent: 'mixed',
    sources: ['unsplash', 'pexels'],
    limit: 12,
  });

  const photos = results.filter((r) => r.type === 'photo' && r.imageUrl);
  if (photos.length === 0) return null;

  // Spread picks across personas so two personas don't get the same face.
  const pick = photos[seedOffset % photos.length];

  // Unsplash requires a download trigger for attribution compliance.
  if (pick.source === 'unsplash' && pick.metadata?.unsplashDownloadLocation) {
    await triggerUnsplashDownload(pick.metadata.unsplashDownloadLocation);
  }

  return { imageUrl: pick.imageUrl, attribution: pick.attribution };
}

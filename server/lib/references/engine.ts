/**
 * References engine — the SSoT for READING the reference library.
 *
 * Before this module, three surfaces each hand-rolled their own Mongo filter,
 * their own visibility rule and their own projection:
 *   - GET /api/references            (regex + in-memory feed ranking)
 *   - GET /api/community/references/smart (brand embedding → Pinecone)
 *   - MCP reference-search           (Mongo only, no vectors)
 * They disagreed — and only one of them escaped user input before handing it to
 * $regex. Everything that reads references now goes through here.
 *
 * Writes still live in `server/lib/mockup/referenceIngestor.ts`.
 *
 * Storage note: references are NOT a Prisma model. They are Mongo documents in
 * `community_presets` discriminated by `category: 'reference'`, and they are
 * user-scoped — a brand only ever influences RANKING (see feedRanking.ts), never
 * ownership or filtering.
 */

import type { Db } from 'mongodb';
import { normalizeCountry } from '../../../src/lib/references/taxonomy.js';
import { REFERENCE_DIMENSION_KEYS } from '../../../src/constants/referenceDimensions.js';
import { rankReferences, hashToUnit } from './feedRanking.js';

export const REFERENCE_COLLECTION = 'community_presets';
export const REFERENCE_CATEGORY = 'reference';

/**
 * Feed ranking pulls the newest N candidates and scores them in memory. The
 * library is curated (hundreds–low thousands), so this is cheap; if it ever
 * outgrows the cap we log it rather than silently truncate.
 */
/**
 * Ceiling on how many references the in-memory ranker considers per request.
 * Env-tunable so it can grow with the box's memory without a deploy. The pool
 * is stratified (see loadRankingCandidates) so this is a bound on WORK, not a
 * truncation that hides old content.
 */
export const candidateCap = (): number =>
  Math.max(2, parseInt(process.env.REFERENCES_CANDIDATE_CAP || '1500', 10));

/** @deprecated use candidateCap() — kept for callers importing the constant. */
export const CANDIDATE_CAP = 1500;

/**
 * Who can see what. Callers declare intent — the rule itself lives only here.
 *
 * - `public`  — the end-user library: admin-curated OR the uploader opted in.
 * - `curated` — admin-curated only. What the agent-facing surfaces have always
 *               returned, so user uploads stay invisible to them until we
 *               deliberately decide otherwise (that decision is a product call,
 *               not a refactor).
 */
export type ReferenceVisibility = 'public' | 'curated';

export function visibilityFilter(visibility: ReferenceVisibility): Record<string, any> {
  if (visibility === 'curated') {
    return { isAdminCurated: true, hiddenFromPublic: { $ne: true } };
  }
  // Third-party studio mockups live admin-only via hiddenFromPublic.
  return {
    hiddenFromPublic: { $ne: true },
    $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }],
  };
}

/** Public projection — never leak internal Mongo _id or owner internals. */
export const PUBLIC_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  // Bilingual short title + friendly handle (see src/lib/references/naming.ts).
  nameI18n: 1,
  slug: 1,
  studio: 1,
  description: 1,
  referenceImageUrl: 1,
  thumbnailUrl: 1,
  thumbHash: 1,
  dimensions: 1,
  provenance: 1,
  country: 1,
  region: 1,
  sourceUrl: 1,
  tags: 1,
  createdAt: 1,
  // Objective facts — let the grid reserve space and match on real colour.
  width: 1,
  height: 1,
  aspectRatio: 1,
  palette: 1,
  brandGuidelineIds: 1,
} as const;

/** Agent-facing projection — swaps client render fields for the prompt text. */
export const AGENT_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  // Bilingual short title + friendly handle (see src/lib/references/naming.ts).
  nameI18n: 1,
  slug: 1,
  studio: 1,
  description: 1,
  referenceImageUrl: 1,
  dimensions: 1,
  provenance: 1,
  country: 1,
  region: 1,
  sourceUrl: 1,
  tags: 1,
  prompt: 1,
} as const;

/** `#RRGGBB` → [r,g,b], or undefined when the input isn't a usable hex. */
export function normalizeHex(raw?: string): [number, number, number] | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec((raw || '').trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Regexes matching any hex whose channels fall in the same coarse bucket as
 * `rgb` (±1 bucket per channel, 32 levels each). Returned as a $in list so the
 * query stays index-friendly instead of scanning every palette in memory.
 */
export function paletteBucketRegexes(rgb: [number, number, number]): RegExp[] {
  const nibble = (v: number) => Math.min(15, Math.max(0, v >> 4));
  const around = (v: number) => {
    const c = nibble(v);
    return [...new Set([Math.max(0, c - 1), c, Math.min(15, c + 1)])];
  };
  const out: RegExp[] = [];
  for (const r of around(rgb[0])) {
    for (const g of around(rgb[1])) {
      for (const b of around(rgb[2])) {
        out.push(new RegExp(`^#${r.toString(16)}.${g.toString(16)}.${b.toString(16)}.$`, 'i'));
      }
    }
  }
  return out;
}

/** Escape regex metacharacters so user input can't alter the query's shape. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ReferenceFilterParams {
  visibility?: ReferenceVisibility;
  /** Free text across name / description / studio. Escaped before use. */
  search?: string;
  /** Coarse page toggle: refs carrying a brand_artifact vs a mockup_type. */
  kind?: 'all' | 'branding' | 'mockup';
  country?: string;
  region?: string;
  /** Comma-joined or array of tags, matched against the flattened tags array. */
  tag?: string | string[];
  /** Per-dimension filters, keyed by REFERENCE_DIMENSION_KEYS. */
  dimensions?: Record<string, string | string[] | undefined>;
  /** Restrict to one uploader (the `GET /mine` shape). */
  userId?: string;
  isAdminCurated?: boolean;
  /**
   * Only refs tagged with this brand. A soft N:N association — refs are never
   * owned by a brand, so this narrows the shared library rather than scoping it.
   * Orthogonal to `brandTerms`, which only ever RANKS.
   */
  brandGuidelineId?: string;
  /**
   * TEMPORARIO — inspecao de procedencia. Restringe a linhas cujo `sourcePath`
   * comeca com este prefixo, pra conseguir OLHAR uma leva de ingest antes de
   * decidir o que fazer com ela (ex.: `Z:/Jobs 2.0`, ~1100 artefatos de build
   * varridos de uma pasta de trabalho). Remover junto com a decisao.
   */
  sourcePrefix?: string;
  /**
   * Hex (#rrggbb). Restringe a referências cuja paleta dominante contém uma cor
   * PRÓXIMA desta. `palette` é gravada no ingest e, até aqui, nunca era lida —
   * navegar por cor é o gesto nativo de quem procura referência visual.
   *
   * O casamento é por bucket, não por distância: cada canal é quantizado em 3
   * bits e comparado por prefixo de regex, o que o Mongo resolve no índice em
   * vez de trazer a biblioteca inteira pra memória. Grosso de propósito — cor
   * "parecida" é uma faixa, não um ponto.
   */
  color?: string;
}

function toList(value: string | string[] | undefined, lowercase = false): string[] | undefined {
  if (!value) return undefined;
  const parts = (Array.isArray(value) ? value : value.split(','))
    .map((v) => String(v).trim())
    .filter(Boolean)
    .map((v) => (lowercase ? v.toLowerCase() : v));
  return parts.length ? parts : undefined;
}

/**
 * A reference with no image is not a reference — it renders as a hole in the
 * grid. ~900 rows in `community_presets` are a PSD CATALOGUE (`local-*-psd-*`,
 * `source: 'local-ingest'`, a `psdPath` and no preview): an index of the
 * Mockups Soviéticos library. Those belong to the mockup-store, not to the
 * image library, and are deliberately left in place — this filter hides them
 * from the visual feed instead of deleting a catalogue.
 *
 * Written as "has an image", not "is not a PSD", so any future failed ingest is
 * covered by the same rule without anyone remembering to extend a blocklist.
 */
export const HAS_IMAGE = { referenceImageUrl: { $exists: true, $nin: [null, ''] } };

/**
 * PSD mockup scenes are NOT reference images. They are the mockup-store's
 * catalogue (Mockups Soviéticos, `psdPath` pointing at the .psd), and they are
 * browsed there — not in this grid. The rows stay in the collection untouched;
 * only the visual feed excludes them, so nothing the mockup pipeline reads
 * changes.
 *
 * Matched on `psdPath` being a real string: ~1100 rows carry `psdPath: null`
 * from the same local ingest without being PSDs, so `$exists` would over-match.
 */
export const NOT_PSD_SCENE = { psdPath: { $not: { $type: 'string' } } };

/** Rows that belong in the visual grid: has an image, and is not a PSD scene. */
export const BROWSABLE = { ...HAS_IMAGE, ...NOT_PSD_SCENE };

/** Build the Mongo filter for a reference query. The only place that shape exists. */
export function buildReferenceFilter(params: ReferenceFilterParams = {}): Record<string, any> {
  const filter: Record<string, any> = {
    category: REFERENCE_CATEGORY,
    ...BROWSABLE,
    ...visibilityFilter(params.visibility ?? 'public'),
  };

  // `visibilityFilter('public')` already owns a top-level $or, so anything else
  // needing an $or must go through $and to avoid clobbering it.
  const and: Record<string, any>[] = [];

  if (params.userId) filter.userId = String(params.userId);
  if (typeof params.isAdminCurated === 'boolean') filter.isAdminCurated = params.isAdminCurated;
  if (params.brandGuidelineId) filter.brandGuidelineIds = params.brandGuidelineId;

  if (params.kind === 'branding') filter['dimensions.brand_artifact.0'] = { $exists: true };
  else if (params.kind === 'mockup') filter['dimensions.mockup_type.0'] = { $exists: true };

  const country = params.country ? normalizeCountry(params.country) : undefined;
  if (country) filter.country = country;

  const region = params.region?.trim();
  if (region) filter.region = region;

  const color = normalizeHex(params.color);
  if (color) and.push({ palette: { $in: paletteBucketRegexes(color) } });

  const sourcePrefix = params.sourcePrefix?.trim();
  if (sourcePrefix) filter.sourcePath = { $regex: '^' + escapeRegex(sourcePrefix), $options: 'i' };

  const tags = toList(params.tag, true);
  if (tags) filter.tags = { $in: tags };

  for (const key of REFERENCE_DIMENSION_KEYS) {
    const values = toList(params.dimensions?.[key]);
    if (values) filter[`dimensions.${key}`] = { $in: values };
  }

  const search = params.search?.trim();
  if (search) {
    const escaped = escapeRegex(search);
    and.push({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { studio: { $regex: escaped, $options: 'i' } },
      ],
    });
  }

  if (and.length) filter.$and = and;
  return filter;
}

/** Parse comma-joined brand descriptor tokens into a normalized Set. */
export function parseBrandTerms(raw: unknown): Set<string> | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const set = new Set(
    raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2)
      .slice(0, 40)
  );
  return set.size ? set : undefined;
}

/** Derive the user's taste vocabulary + saved-id set from their collections. */
export async function loadUserSignals(
  db: Db,
  userId?: string | number
): Promise<{ tasteValues?: Set<string>; savedIds?: Set<string> }> {
  if (!userId) return {};
  const cols = await db
    .collection('reference_collections')
    .find({ userId: String(userId) })
    .project({ refIds: 1 })
    .toArray();
  const savedIds = new Set<string>(cols.flatMap((c: any) => c.refIds || []));
  if (savedIds.size === 0) return {};

  const docs = await db
    .collection(REFERENCE_COLLECTION)
    .find({ id: { $in: [...savedIds] }, category: REFERENCE_CATEGORY })
    .project({ _id: 0, dimensions: 1 })
    .toArray();
  const tasteValues = new Set<string>();
  for (const d of docs) {
    for (const vals of Object.values((d as any).dimensions || {})) {
      if (Array.isArray(vals)) for (const v of vals) tasteValues.add(String(v).toLowerCase());
    }
  }
  return { tasteValues: tasteValues.size ? tasteValues : undefined, savedIds };
}

export interface SearchReferencesParams extends ReferenceFilterParams {
  page?: number;
  limit?: number;
  /** Session seed → ranked feed. Absent = legacy newest-first. */
  seed?: string;
  /** Comma-joined active-brand tokens; ranking only, never filtering. */
  brandTerms?: string;
  /** Viewer, for taste + novelty signals. Optional — the feed works logged out. */
  viewerId?: string | number;
  projection?: Record<string, 0 | 1>;
  /** Injected for determinism in tests. */
  now?: number;
  /**
   * With a `search` query, rank by MEANING (embed → Pinecone) instead of
   * substring. Falls back to the lexical path when there's no query, the
   * embedding fails, or the vector store returns nothing (incl. mock mode).
   */
  semantic?: boolean;
}

export interface SearchReferencesResult {
  references: any[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * The library feed. Without `seed`, newest-first offset pagination (back-compat).
 * With `seed`, a blended per-session ranking — see feedRanking.ts.
 */
export async function searchReferences(
  db: Db,
  params: SearchReferencesParams = {}
): Promise<SearchReferencesResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(60, Math.max(1, params.limit || 30));
  const skip = (page - 1) * limit;
  const projection = params.projection ?? (PUBLIC_PROJECTION as Record<string, 0 | 1>);
  const filter = buildReferenceFilter(params);
  const seed = params.seed?.slice(0, 32) || '';
  const collection = db.collection(REFERENCE_COLLECTION);

  // Semantic path — rank by meaning. Only enriched refs have vectors, so pending
  // uploads never surface here. Falls through to lexical on any miss.
  if (params.semantic && (params.search || '').trim()) {
    const semantic = await semanticSearch(db, params, page, limit, projection);
    if (semantic) return semantic;
  }

  if (!seed) {
    const [references, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project(projection)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    return { references, total, page, limit, pages: Math.ceil(total / limit) };
  }

  const brandTerms = parseBrandTerms(params.brandTerms);
  const { tasteValues, savedIds } = await loadUserSignals(db, params.viewerId);

  const [candidates, total] = await Promise.all([
    loadRankingCandidates(collection, filter, projection, seed),
    collection.countDocuments(filter),
  ]);

  const ranked = rankReferences(candidates as any[], {
    seed,
    brandTerms,
    tasteValues,
    savedIds,
    now: params.now ?? Date.now(),
  });

  return {
    references: ranked.slice(skip, skip + limit),
    total,
    // pages reflect the ranked candidate pool so infinite scroll stops cleanly.
    pages: Math.ceil(ranked.length / limit),
    page,
    limit,
  };
}

/**
 * Select a bounded, representative candidate pool for ranking.
 *
 * Ranking runs in memory, so the pool must stay bounded — but "newest N" biases
 * the personalized feed against older content, and brand/taste affinity (60% of
 * the score) means a highly relevant OLD reference would never surface. So the
 * pool is stratified:
 *   - half the newest (recency — fresh content always gets a shot)
 *   - half from a session-seeded window over `shuffleKey` (a stable [0,1) key,
 *     `hashToUnit(id)`), so the long tail is represented and every reference has
 *     a chance to appear, while the window stays identical within a session so
 *     offset pagination is consistent.
 *
 * Bounded at CANDIDATE_CAP regardless of library size — this is the shape that
 * survives growth, not "raise the cap until it hurts".
 */
export async function loadRankingCandidates(
  collection: ReturnType<Db['collection']>,
  filter: Record<string, any>,
  projection: Record<string, 0 | 1>,
  seed: string
): Promise<any[]> {
  const half = Math.max(1, Math.floor(candidateCap() / 2));

  // A: newest half.
  const newest = collection
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(half)
    .project(projection)
    .toArray();

  // B: a deterministic window over the shuffle key, rotated by the session seed.
  const start = hashToUnit(seed);
  const window = collection
    .find({ ...filter, shuffleKey: { $gte: start } })
    .sort({ shuffleKey: 1 })
    .limit(half)
    .project(projection)
    .toArray();

  let [newestDocs, windowDocs] = await Promise.all([newest, window]);

  // Wrap around when the window started near the top of the key space.
  if (windowDocs.length < half) {
    const wrap = await collection
      .find({ ...filter, shuffleKey: { $lt: start } })
      .sort({ shuffleKey: 1 })
      .limit(half - windowDocs.length)
      .project(projection)
      .toArray();
    windowDocs = windowDocs.concat(wrap);
  }

  // Union, de-duped by id (a newest doc may also fall in the shuffle window).
  const byId = new Map<string, any>();
  for (const d of newestDocs) byId.set(d.id, d);
  for (const d of windowDocs) if (!byId.has(d.id)) byId.set(d.id, d);
  return [...byId.values()];
}

/**
 * In-memory predicate for the structured filters that aren't applied vector-side
 * (kind, tag, dimensions, brand tag). Vector search does recall + relevance;
 * these narrow the hydrated hits. country/region already went to Pinecone.
 */
function matchesStructuredParams(doc: any, params: ReferenceFilterParams): boolean {
  if (params.kind === 'branding' && !doc.dimensions?.brand_artifact?.length) return false;
  if (params.kind === 'mockup' && !doc.dimensions?.mockup_type?.length) return false;

  if (params.brandGuidelineId) {
    const ids = Array.isArray(doc.brandGuidelineIds) ? doc.brandGuidelineIds : [];
    if (!ids.includes(params.brandGuidelineId)) return false;
  }

  const wantTags = Array.isArray(params.tag)
    ? params.tag
    : typeof params.tag === 'string'
      ? params.tag.split(',')
      : [];
  const tags = wantTags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (tags.length) {
    const docTags = (Array.isArray(doc.tags) ? doc.tags : []).map((t: string) => t.toLowerCase());
    if (!tags.some((t) => docTags.includes(t))) return false;
  }

  for (const key of REFERENCE_DIMENSION_KEYS) {
    const raw = params.dimensions?.[key];
    if (!raw) continue;
    const want = (Array.isArray(raw) ? raw : String(raw).split(','))
      .map((v) => v.trim())
      .filter(Boolean);
    if (!want.length) continue;
    const have: string[] = doc.dimensions?.[key] || [];
    if (!want.some((v) => have.includes(v))) return false;
  }
  return true;
}

/**
 * Semantic search — rank references by meaning. Embeds the query text and finds
 * the nearest reference vectors (which are image+text multimodal, same space),
 * then hydrates and applies the structured filters that don't map to vector
 * metadata. Returns null to signal "fall back to lexical": no vectors, embedding
 * failure, or Pinecone unconfigured (mock mode → empty) all degrade gracefully.
 */
async function semanticSearch(
  db: Db,
  params: SearchReferencesParams,
  page: number,
  limit: number,
  projection: Record<string, 0 | 1>
): Promise<SearchReferencesResult | null> {
  const query = (params.search || '').trim();
  if (!query) return null;

  try {
    const { getMultimodalEmbedding } = await import('../../services/geminiService.js');
    const { vectorService } = await import('../../services/vectorService.js');
    const { withResilience } = await import('../ai-resilience.js');

    const { embedding } = await withResilience('gemini', () =>
      getMultimodalEmbedding([{ text: query }])
    );

    // Recall headroom: pull well beyond one page so residual filters + paging
    // have room. Bounded, so cost/memory stay flat.
    const topK = Math.min(200, Math.max(limit * 4, 60));

    // Only country/region map cleanly to vector metadata (proven by /search-by-image).
    const vectorFilter: Record<string, any> = { feature: 'reference' };
    const country = params.country ? normalizeCountry(params.country) : undefined;
    if (country) vectorFilter.country = { $eq: country };
    if (params.region?.trim()) vectorFilter.region = { $eq: params.region.trim() };

    const matches = await vectorService.query(embedding, topK, vectorFilter);
    if (!matches.length) return null; // mock mode / no hits → lexical fallback

    const hydrated = await hydrateVectorMatches(db, matches, {
      visibility: params.visibility ?? 'public',
      projection,
    });
    const filtered = hydrated.filter((doc) => matchesStructuredParams(doc, params));
    if (filtered.length === 0) return null;

    const total = filtered.length;
    const skip = (page - 1) * limit;
    return {
      references: filtered.slice(skip, skip + limit),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  } catch (err) {
    console.warn('[references] semantic search failed, falling back to lexical:', err);
    return null;
  }
}

/**
 * Hydrate vector-search hits into full public records, preserving similarity
 * order and attaching each score. Shared by /search-by-image, /:id/similar and
 * the brand-smart path — each of which used to re-implement it.
 */
export async function hydrateVectorMatches(
  db: Db,
  matches: Array<{ id: string; score?: number }>,
  opts: {
    visibility?: ReferenceVisibility;
    projection?: Record<string, 0 | 1>;
    excludeId?: string;
    limit?: number;
  } = {}
): Promise<any[]> {
  const ids = matches.map((m) => m.id).filter((id) => id && id !== opts.excludeId);
  if (ids.length === 0) return [];

  const docs = await db
    .collection(REFERENCE_COLLECTION)
    .find({
      id: { $in: ids },
      category: REFERENCE_CATEGORY,
      ...visibilityFilter(opts.visibility ?? 'public'),
    })
    .project(opts.projection ?? (PUBLIC_PROJECTION as Record<string, 0 | 1>))
    .toArray();

  const byId = new Map(docs.map((d: any) => [d.id, d]));
  const scoreById = new Map(matches.map((m) => [m.id, m.score ?? 0]));
  const ordered = ids
    .map((id) => {
      const doc = byId.get(id);
      return doc ? { ...doc, score: scoreById.get(id) ?? 0 } : null;
    })
    .filter(Boolean) as any[];

  return opts.limit ? ordered.slice(0, opts.limit) : ordered;
}

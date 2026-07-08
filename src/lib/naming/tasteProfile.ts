/**
 * Naming Machine — TasteProfile (Self-Learning Loop, camada 1)
 *
 * Lógica pura, sem React, sem rede. Cada swipe atualiza um perfil de gosto
 * local que calibra a próxima leva de nomes. Superlike pesa 3x nos rates.
 *
 * Ver .agent/plans/NAMING-MACHINE.md → "O Self-Learning Loop".
 */

import type { NamingSettings } from './constants';

export interface NamingCard {
  name: string;
  rationale: string;
  riskFlag?: string;
  technique: string;
  territory: string;
}

export type Verdict = 'nope' | 'like' | 'superlike';

interface HistoryEntry {
  name: string;
  verdict: Verdict;
}

export interface TasteProfile {
  likeRateByTerritory: Record<string, number>;
  likeRateByTechnique: Record<string, number>;
  avgLengthLiked: number;
  superliked: NamingCard[];
  liked: NamingCard[];
  rejected: NamingCard[];
  seen: string[];
  /** Ordem dos swipes — usado só para undoLast. */
  history: HistoryEntry[];
}

/* ── Fábrica ──────────────────────────────────────────────────────────────── */

export function emptyProfile(): TasteProfile {
  return {
    likeRateByTerritory: {},
    likeRateByTechnique: {},
    avgLengthLiked: 0,
    superliked: [],
    liked: [],
    rejected: [],
    seen: [],
    history: [],
  };
}

function clone(profile: TasteProfile): TasteProfile {
  return typeof structuredClone === 'function'
    ? structuredClone(profile)
    : JSON.parse(JSON.stringify(profile));
}

/* ── Estatística ponderada ──────────────────────────────────────────────── */

interface KeyStat {
  likes: number; // ponderado (superlike = 3)
  total: number; // ponderado
  nopes: number; // contagem crua de rejeições
  seen: number; // contagem crua de cards vistos
}

/** Agrega stats ponderados por uma chave (território ou técnica). */
function statsBy(profile: TasteProfile, key: (c: NamingCard) => string): Record<string, KeyStat> {
  const map: Record<string, KeyStat> = {};
  const bump = (k: string, likes: number, total: number, nopes: number) => {
    if (!k) return;
    const e = (map[k] ||= { likes: 0, total: 0, nopes: 0, seen: 0 });
    e.likes += likes;
    e.total += total;
    e.nopes += nopes;
    e.seen += 1;
  };
  profile.superliked.forEach((c) => bump(key(c), 3, 3, 0));
  profile.liked.forEach((c) => bump(key(c), 1, 1, 0));
  profile.rejected.forEach((c) => bump(key(c), 0, 1, 1));
  return map;
}

function ratesFrom(stats: Record<string, KeyStat>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, e] of Object.entries(stats)) {
    out[k] = e.total > 0 ? e.likes / e.total : 0;
  }
  return out;
}

function computeAvgLengthLiked(profile: TasteProfile): number {
  let weighted = 0;
  let count = 0;
  profile.liked.forEach((c) => {
    weighted += c.name.trim().length;
    count += 1;
  });
  profile.superliked.forEach((c) => {
    weighted += c.name.trim().length * 3;
    count += 3;
  });
  return count > 0 ? weighted / count : 0;
}

/** Recalcula os campos derivados in-place. */
function recomputeDerived(profile: TasteProfile): void {
  profile.likeRateByTerritory = ratesFrom(statsBy(profile, (c) => c.territory));
  profile.likeRateByTechnique = ratesFrom(statsBy(profile, (c) => c.technique));
  profile.avgLengthLiked = computeAvgLengthLiked(profile);
}

/* ── Mutações ───────────────────────────────────────────────────────────── */

function bucketFor(verdict: Verdict): 'superliked' | 'liked' | 'rejected' {
  return verdict === 'superlike' ? 'superliked' : verdict === 'like' ? 'liked' : 'rejected';
}

export function updateProfile(
  profile: TasteProfile,
  card: NamingCard,
  verdict: Verdict
): TasteProfile {
  const next = clone(profile);
  next[bucketFor(verdict)].push(card);
  if (!next.seen.includes(card.name)) next.seen.push(card.name);
  next.history.push({ name: card.name, verdict });
  recomputeDerived(next);
  return next;
}

export function undoLast(profile: TasteProfile): TasteProfile {
  if (profile.history.length === 0) return profile;
  const next = clone(profile);
  const last = next.history.pop()!;
  const arr = next[bucketFor(last.verdict)];
  const idx = arr.map((c) => c.name).lastIndexOf(last.name);
  if (idx >= 0) arr.splice(idx, 1);
  next.seen = next.seen.filter((n) => n !== last.name);
  recomputeDerived(next);
  return next;
}

/* ── Seleção de territórios (exploitation 70% / exploration 30%) ─────────── */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Escolhe os territórios da próxima leva: ~70% os de maior like-rate já
 * testados + ~30% exploração (territórios pouco/nunca vistos).
 *
 * Regra: território com ≥3 nopes e 0 likes sai da rotação.
 */
export function pickTerritories(
  profile: TasteProfile,
  allTerritories: string[],
  count = 6
): string[] {
  if (allTerritories.length === 0) return [];

  const stats = statsBy(profile, (c) => c.territory);
  const burned = new Set(
    Object.entries(stats)
      .filter(([, e]) => e.likes === 0 && e.nopes >= 3)
      .map(([t]) => t)
  );

  const available = allTerritories.filter((t) => !burned.has(t));
  if (available.length === 0) return allTerritories.slice(0, count);

  const seenCount = (t: string) => stats[t]?.seen ?? 0;
  const rate = (t: string) => {
    const e = stats[t];
    return e && e.total > 0 ? e.likes / e.total : 0;
  };

  const explored = available.filter((t) => seenCount(t) > 0).sort((a, b) => rate(b) - rate(a));
  const unexplored = shuffle(available.filter((t) => seenCount(t) === 0));

  const target = Math.min(count, available.length);
  const exploitN = Math.max(1, Math.round(target * 0.7));
  const exploreN = target - exploitN;

  const picks: string[] = [];
  const push = (t: string) => {
    if (picks.length < target && !picks.includes(t)) picks.push(t);
  };

  explored.slice(0, exploitN).forEach(push);
  unexplored.slice(0, exploreN).forEach(push);
  // Preenche o que faltar sem repetir.
  [...unexplored, ...explored, ...available].forEach(push);

  return picks;
}

/* ── Persistência (localStorage) ────────────────────────────────────────── */

const SESSION_KEY = 'naming-machine-session-v1';

export type NamingPhase = 'briefing' | 'deck';

export interface NamingSession {
  profile: TasteProfile;
  brief: string | null;
  briefObj: Record<string, unknown> | null;
  phase: NamingPhase;
  /** Shortlist é derivada de profile, persistida por conveniência/robustez. */
  shortlist: NamingCard[];
  tasteReading?: string;
  /** Cards ainda não julgados — persistidos para não perder (nem re-pagar) a leva num refresh. */
  deck?: NamingCard[];
  /** Marca existente escolhida no briefing — injeta contexto de marca em toda geração. */
  brandGuidelineId?: string | null;
  /** Configurações avançadas do deck (opcionais). Ausente = defaults inteligentes. */
  settings?: NamingSettings;
}

export function loadSession(): NamingSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NamingSession>;
    if (!parsed.profile) return null;
    // Normaliza para tolerar sessões antigas / parciais.
    const profile: TasteProfile = { ...emptyProfile(), ...parsed.profile };
    return {
      profile,
      brief: parsed.brief ?? null,
      briefObj: parsed.briefObj ?? null,
      phase: parsed.phase ?? 'briefing',
      shortlist: parsed.shortlist ?? [...profile.superliked, ...profile.liked],
      tasteReading: parsed.tasteReading,
      deck: Array.isArray(parsed.deck) ? parsed.deck : [],
      brandGuidelineId: parsed.brandGuidelineId ?? null,
      settings: parsed.settings,
    };
  } catch {
    return null;
  }
}

export function saveSession(session: NamingSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota / privacy mode — ignora */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignora */
  }
}

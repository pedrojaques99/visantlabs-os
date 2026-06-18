/**
 * Seasonal / contextual signal for brand suggestions.
 *
 * Pure, dependency-free: given a date + market locale, returns the commercially
 * relevant moments in the near horizon (next ~8 weeks). Feeds the cheap-text LLM
 * so brand suggestions land on *what's actually coming up* instead of generic
 * "make a post" filler — that's the difference between useful and noise.
 *
 * No network, no SDK — safe to unit-test and to call on every request (cheap).
 */

export type Market = 'BR' | 'US' | 'GLOBAL';

export interface SeasonalEvent {
  /** Stable key for caching/telemetry. */
  key: string;
  /** Human label in the market's language. */
  label: string;
  /** Month (1-12) the moment centers on. */
  month: number;
  /** Day of month it peaks (approx — for ordering only). */
  day: number;
  /** Markets this moment is relevant to. */
  markets: Market[];
  /** One-line angle hint for the LLM (not shown to users verbatim). */
  angle: string;
}

// Curated, commercially-relevant calendar. BR-first (our primary market) plus the
// globally-shared retail moments. Deliberately small + high-signal — not every
// holiday, only the ones brands actually run campaigns for.
const CALENDAR: SeasonalEvent[] = [
  {
    key: 'new-year',
    label: 'Ano Novo / Réveillon',
    month: 1,
    day: 1,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'fresh start, resolutions, renewal',
  },
  {
    key: 'carnaval',
    label: 'Carnaval',
    month: 2,
    day: 16,
    markets: ['BR'],
    angle: 'celebration, color, music, energy, brazilian street culture',
  },
  {
    key: 'valentines-us',
    label: "Valentine's Day",
    month: 2,
    day: 14,
    markets: ['US', 'GLOBAL'],
    angle: 'love, gifting, pairs, warmth',
  },
  {
    key: 'womens-day',
    label: 'Dia da Mulher',
    month: 3,
    day: 8,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'recognition, empowerment, respect',
  },
  {
    key: 'easter',
    label: 'Páscoa',
    month: 4,
    day: 5,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'renewal, family, chocolate/gifting, spring',
  },
  {
    key: 'mothers-day',
    label: 'Dia das Mães',
    month: 5,
    day: 11,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'gratitude, family, gifting, tenderness',
  },
  {
    key: 'valentines-br',
    label: 'Dia dos Namorados',
    month: 6,
    day: 12,
    markets: ['BR'],
    angle: 'romance, gifting, couples (brazilian)',
  },
  {
    key: 'festa-junina',
    label: 'Festa Junina / São João',
    month: 6,
    day: 24,
    markets: ['BR'],
    angle: 'rustic, bonfire, quadrilha, countryside, warm nostalgia',
  },
  {
    key: 'fathers-day-us',
    label: "Father's Day",
    month: 6,
    day: 15,
    markets: ['US', 'GLOBAL'],
    angle: 'gratitude, family, gifting',
  },
  {
    key: 'winter-sale-br',
    label: 'Liquidação de Inverno',
    month: 7,
    day: 10,
    markets: ['BR'],
    angle: 'seasonal sale, cozy, discounts',
  },
  {
    key: 'fathers-day-br',
    label: 'Dia dos Pais',
    month: 8,
    day: 10,
    markets: ['BR'],
    angle: 'gratitude, family, gifting (brazilian)',
  },
  {
    key: 'back-to-school',
    label: 'Volta às Aulas',
    month: 8,
    day: 1,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'organization, fresh start, productivity, youth',
  },
  {
    key: 'independence-br',
    label: 'Independência do Brasil',
    month: 9,
    day: 7,
    markets: ['BR'],
    angle: 'national pride, green-yellow (use brand palette, not flag)',
  },
  {
    key: 'spring-br',
    label: 'Primavera',
    month: 9,
    day: 22,
    markets: ['BR'],
    angle: 'bloom, color, renewal, lightness',
  },
  {
    key: 'childrens-day-br',
    label: 'Dia das Crianças',
    month: 10,
    day: 12,
    markets: ['BR'],
    angle: 'playful, joyful, gifting, color',
  },
  {
    key: 'halloween',
    label: 'Halloween',
    month: 10,
    day: 31,
    markets: ['US', 'GLOBAL', 'BR'],
    angle: 'playful spooky, dark palette, costume culture',
  },
  {
    key: 'black-friday',
    label: 'Black Friday',
    month: 11,
    day: 28,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'urgency, bold discount, high contrast, scarcity',
  },
  {
    key: 'cyber-monday',
    label: 'Cyber Monday',
    month: 12,
    day: 1,
    markets: ['US', 'GLOBAL'],
    angle: 'digital deals, tech, online-first',
  },
  {
    key: 'christmas',
    label: 'Natal',
    month: 12,
    day: 25,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'warmth, family, gifting, festive (use brand palette)',
  },
  {
    key: 'year-end',
    label: 'Retrospectiva / Fim de Ano',
    month: 12,
    day: 31,
    markets: ['BR', 'US', 'GLOBAL'],
    angle: 'recap, gratitude, looking ahead',
  },
];

/** Default the market from the brand's language hint (cheap heuristic, overridable). */
export function marketFromLanguage(language?: string | null): Market {
  const l = (language || '').toLowerCase();
  if (l.startsWith('pt')) return 'BR';
  if (l.startsWith('en')) return 'US';
  return 'GLOBAL';
}

/** Days from `now` to the next occurrence of (month/day), wrapping across year-end. */
function daysUntil(now: Date, month: number, day: number): number {
  const year = now.getUTCFullYear();
  let target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (target < today) target = Date.UTC(year + 1, month - 1, day);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

export interface SeasonalContext {
  market: Market;
  /** Events in the near horizon, soonest first. */
  upcoming: Array<SeasonalEvent & { daysAway: number }>;
}

/**
 * Returns the commercially-relevant moments within `horizonDays` for the market,
 * soonest first. `now` is injected (never `new Date()` internally) so it's pure
 * and unit-testable.
 */
export function getSeasonalContext(
  now: Date,
  market: Market = 'BR',
  horizonDays = 56
): SeasonalContext {
  const upcoming = CALENDAR.filter((e) => e.markets.includes(market))
    .map((e) => ({ ...e, daysAway: daysUntil(now, e.month, e.day) }))
    .filter((e) => e.daysAway <= horizonDays)
    .sort((a, b) => a.daysAway - b.daysAway);
  return { market, upcoming };
}

/**
 * A compact, LLM-ready line summarizing what's coming up — injected into the
 * suggestion prompt. Empty string when nothing is near (lets the caller fall back
 * to evergreen suggestions).
 */
export function seasonalPromptLine(ctx: SeasonalContext): string {
  if (!ctx.upcoming.length) return '';
  const parts = ctx.upcoming
    .slice(0, 3)
    .map((e) => `${e.label} (in ~${e.daysAway}d — angle: ${e.angle})`);
  return `Upcoming commercial moments for the ${ctx.market} market: ${parts.join('; ')}.`;
}

/**
 * Reference Library — geographic provenance taxonomy (SSoT).
 *
 * Single source of truth for the regions/countries used to tag and filter
 * design references by *where the work was made*. Imported by both the
 * frontend (filter UI) and the backend (ingest validation + AI geo inference).
 *
 * Keep this list curated to design-relevant regions — it powers the
 * "ver só design russo / japonês / suíço" experience.
 */

export interface RegionDef {
  /** Stable slug used in queries and storage */
  id: string;
  /** Display label */
  label: string;
  /** Representative countries (display names) that map to this region */
  countries: string[];
}

export const REGIONS: RegionDef[] = [
  {
    id: 'north-america',
    label: 'North America',
    countries: ['United States', 'Canada', 'Mexico'],
  },
  {
    id: 'latin-america',
    label: 'Latin America',
    countries: ['Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Uruguay'],
  },
  {
    id: 'western-europe',
    label: 'Western Europe',
    countries: [
      'United Kingdom',
      'France',
      'Germany',
      'Switzerland',
      'Netherlands',
      'Belgium',
      'Austria',
      'Ireland',
    ],
  },
  {
    id: 'southern-europe',
    label: 'Southern Europe',
    countries: ['Italy', 'Spain', 'Portugal', 'Greece'],
  },
  {
    id: 'nordic',
    label: 'Nordic',
    countries: ['Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland'],
  },
  {
    id: 'eastern-europe',
    label: 'Eastern Europe',
    countries: ['Russia', 'Poland', 'Ukraine', 'Czechia', 'Hungary', 'Romania'],
  },
  {
    id: 'east-asia',
    label: 'East Asia',
    countries: ['Japan', 'China', 'South Korea', 'Taiwan', 'Hong Kong'],
  },
  {
    id: 'south-asia',
    label: 'South Asia',
    countries: ['India', 'Pakistan', 'Bangladesh', 'Sri Lanka'],
  },
  {
    id: 'southeast-asia',
    label: 'Southeast Asia',
    countries: ['Singapore', 'Thailand', 'Indonesia', 'Vietnam', 'Philippines', 'Malaysia'],
  },
  {
    id: 'middle-east',
    label: 'Middle East',
    countries: [
      'United Arab Emirates',
      'Saudi Arabia',
      'Israel',
      'Turkey',
      'Lebanon',
      'Qatar',
      'Egypt',
    ],
  },
  {
    id: 'africa',
    label: 'Africa',
    countries: ['South Africa', 'Nigeria', 'Kenya', 'Morocco', 'Ghana'],
  },
  {
    id: 'oceania',
    label: 'Oceania',
    countries: ['Australia', 'New Zealand'],
  },
];

/** Flat, sorted list of all curated countries (display names). */
export const DESIGN_COUNTRIES: string[] = Array.from(
  new Set(REGIONS.flatMap((r) => r.countries))
).sort((a, b) => a.localeCompare(b));

const COUNTRY_TO_REGION: Record<string, string> = REGIONS.reduce(
  (acc, region) => {
    for (const country of region.countries) {
      acc[country.toLowerCase()] = region.id;
    }
    return acc;
  },
  {} as Record<string, string>
);

/** Resolve a region id from a free-text country name (case/space tolerant). */
export function regionForCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  return COUNTRY_TO_REGION[country.trim().toLowerCase()];
}

/** Normalize a free-text country into a canonical display name when possible. */
export function normalizeCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  const needle = country.trim().toLowerCase();
  if (!needle) return undefined;
  for (const region of REGIONS) {
    const match = region.countries.find((c) => c.toLowerCase() === needle);
    if (match) return match;
  }
  // Unknown country — keep the trimmed original so we never lose provenance.
  return country.trim();
}

export const REGION_LABELS: Record<string, string> = REGIONS.reduce(
  (acc, r) => {
    acc[r.id] = r.label;
    return acc;
  },
  {} as Record<string, string>
);

/** Curated country → ISO 3166-1 alpha-2 (for flag emoji + future i18n). */
const COUNTRY_ISO: Record<string, string> = {
  'united states': 'US',
  canada: 'CA',
  mexico: 'MX',
  brazil: 'BR',
  argentina: 'AR',
  chile: 'CL',
  colombia: 'CO',
  peru: 'PE',
  uruguay: 'UY',
  'united kingdom': 'GB',
  france: 'FR',
  germany: 'DE',
  switzerland: 'CH',
  netherlands: 'NL',
  belgium: 'BE',
  austria: 'AT',
  ireland: 'IE',
  italy: 'IT',
  spain: 'ES',
  portugal: 'PT',
  greece: 'GR',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  iceland: 'IS',
  russia: 'RU',
  poland: 'PL',
  ukraine: 'UA',
  czechia: 'CZ',
  hungary: 'HU',
  romania: 'RO',
  japan: 'JP',
  china: 'CN',
  'south korea': 'KR',
  taiwan: 'TW',
  'hong kong': 'HK',
  india: 'IN',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  singapore: 'SG',
  thailand: 'TH',
  indonesia: 'ID',
  vietnam: 'VN',
  philippines: 'PH',
  malaysia: 'MY',
  'united arab emirates': 'AE',
  'saudi arabia': 'SA',
  israel: 'IL',
  turkey: 'TR',
  lebanon: 'LB',
  qatar: 'QA',
  egypt: 'EG',
  'south africa': 'ZA',
  nigeria: 'NG',
  kenya: 'KE',
  morocco: 'MA',
  ghana: 'GH',
  australia: 'AU',
  'new zealand': 'NZ',
};

/** Country display name → flag emoji (regional indicator pair). '' if unknown. */
export function countryFlag(country?: string | null): string {
  if (!country) return '';
  const iso = COUNTRY_ISO[country.trim().toLowerCase()];
  if (!iso) return '';
  return String.fromCodePoint(...[...iso].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

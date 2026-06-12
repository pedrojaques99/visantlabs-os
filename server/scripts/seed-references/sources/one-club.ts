/**
 * The One Club (TDC + ADC) — the most machine-friendly award archive.
 * Country is a first-class path segment, e.g.:
 *   https://www.oneclub.org/awards/tdcawards/-country/Japan/2024/all/all
 * which makes "design japonês / russo / suíço" trivially scopeable.
 */

import type { SeedSource, SeedItem, CollectOptions } from '../types.js';
import { WINNER_LIST_SCHEMA, type WinnerListResult } from '../firecrawl.js';

const DEFAULT_YEAR = 2024;

function galleryUrl(country: string | undefined, year: number): string {
  const base = 'https://www.oneclub.org/awards/tdcawards';
  if (country) {
    return `${base}/-country/${encodeURIComponent(country)}/${year}/all/all`;
  }
  return `${base}/${year}/all/all/all`;
}

export const oneClub: SeedSource = {
  id: 'one-club',
  label: 'The One Club (TDC + ADC)',
  awardSource: 'The One Club TDC',
  hasNativeGeo: true,
  needsFirecrawl: true,

  async collect({ limit, country, firecrawl, log }: CollectOptions): Promise<SeedItem[]> {
    const url = galleryUrl(country, DEFAULT_YEAR);
    log.info(`one-club → ${url}`);

    const result = await firecrawl.extract<WinnerListResult>({
      prompt:
        `Extract every winning entry shown in this Type Directors Club / ADC winner gallery. ` +
        `For each: the work title, the studio/agency, the country of the entrant, the award year, ` +
        `the highest-resolution work image URL, and the detail-page URL. ` +
        (country ? `All entries are from ${country}. ` : '') +
        `Return up to ${limit} entries.`,
      urls: [url],
      schema: WINNER_LIST_SCHEMA,
    });

    return (result.items || []).slice(0, limit).map((it) => ({
      imageUrl: it.imageUrl,
      sourceUrl: it.sourceUrl,
      awardSource: `The One Club TDC ${it.year || DEFAULT_YEAR}`,
      title: it.title,
      studio: it.studio,
      designer: it.designer,
      country: it.country || country,
      year: it.year || DEFAULT_YEAR,
    }));
  },
};

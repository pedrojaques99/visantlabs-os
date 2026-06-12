/**
 * Fonts In Use — the gold standard for geo-tagged design provenance.
 * Location is a first-class metadata field alongside format (logo, editorial,
 * poster, packaging…). Every entry is a real-world artifact with attribution.
 *
 * Note: Fonts In Use exposes browsing by location; the exact listing URL may
 * need adjusting on first live run (sites evolve). The LLM extractor is told
 * to read whatever gallery is served, so it degrades gracefully.
 */

import type { SeedSource, SeedItem, CollectOptions } from '../types.js';
import { WINNER_LIST_SCHEMA, type WinnerListResult } from '../firecrawl.js';

function listingUrl(country: string | undefined): string {
  // Country-scoped browse when possible, else the global recent-uses gallery.
  if (country) {
    const slug = country.toLowerCase().replace(/\s+/g, '-');
    return `https://fontsinuse.com/in/${slug}`;
  }
  return 'https://fontsinuse.com/uses/';
}

export const fontsInUse: SeedSource = {
  id: 'fonts-in-use',
  label: 'Fonts In Use',
  awardSource: 'Fonts In Use',
  hasNativeGeo: true,
  needsFirecrawl: true,

  async collect({ limit, country, firecrawl, log }: CollectOptions): Promise<SeedItem[]> {
    const url = listingUrl(country);
    log.info(`fonts-in-use → ${url}`);

    const result = await firecrawl.extract<WinnerListResult>({
      prompt:
        `This is a Fonts In Use gallery of real-world typography. Extract each entry: ` +
        `the project title, the studio/designer credited, the country/location where it was made, ` +
        `the year if shown, the highest-resolution image URL, and the entry detail-page URL. ` +
        (country ? `Prefer entries located in ${country}. ` : '') +
        `Skip ads and navigation. Return up to ${limit} entries.`,
      urls: [url],
      schema: WINNER_LIST_SCHEMA,
    });

    return (result.items || []).slice(0, limit).map((it) => ({
      imageUrl: it.imageUrl,
      sourceUrl: it.sourceUrl,
      awardSource: 'Fonts In Use',
      title: it.title,
      studio: it.studio,
      designer: it.designer,
      country: it.country || country,
      year: it.year,
      tags: ['typography', 'editorial'],
    }));
  },
};

/**
 * Pentawards — the world's premier packaging-only award. Country is a
 * first-class search dimension; 5,000+ jury-curated winners since 2007.
 */

import type { SeedSource, SeedItem, CollectOptions } from '../types.js';
import { WINNER_LIST_SCHEMA, type WinnerListResult } from '../firecrawl.js';

const WINNERS_URL = 'https://pentawards.com/directory/en/page/the-winners';

export const pentawards: SeedSource = {
  id: 'pentawards',
  label: 'Pentawards (packaging)',
  awardSource: 'Pentawards',
  hasNativeGeo: true,
  needsFirecrawl: true,

  async collect({ limit, country, firecrawl, log }: CollectOptions): Promise<SeedItem[]> {
    log.info(`pentawards → ${WINNERS_URL}${country ? ` (country: ${country})` : ''}`);

    const result = await firecrawl.extract<WinnerListResult>({
      prompt:
        `This is the Pentawards packaging-design winners directory. Extract each winning entry: ` +
        `the product/project title, the studio/agency, the country, the award year and level, ` +
        `the highest-resolution packaging image URL, and the detail-page URL. ` +
        (country ? `Only entries from ${country}. ` : '') +
        `Return up to ${limit} entries.`,
      urls: [WINNERS_URL],
      schema: WINNER_LIST_SCHEMA,
    });

    return (result.items || []).slice(0, limit).map((it) => ({
      imageUrl: it.imageUrl,
      sourceUrl: it.sourceUrl,
      awardSource: `Pentawards${it.year ? ` ${it.year}` : ''}`,
      title: it.title,
      studio: it.studio,
      designer: it.designer,
      country: it.country || country,
      year: it.year,
      tags: ['packaging'],
    }));
  },
};

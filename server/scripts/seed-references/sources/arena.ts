/**
 * Are.na — FREE seed source (public API, no token, no Firecrawl credits).
 *
 * The platform that inspired this whole feature. We harvest images from curated
 * design channels via the public REST API and re-host + AI-tag them like any
 * other source. Geo is weak on Are.na, so we (a) prefer geo-themed channels
 * (Swiss Design, Japanese branding…) and stamp their country, and (b) let the
 * pipeline's AI geoHint infer the rest as a soft tag.
 *
 * API: https://dev.are.na — GET /v2/channels/{slug}/contents (public, ~30 req/min)
 */

import type { SeedSource, SeedItem, CollectOptions } from '../types.js';

interface ArenaChannel {
  slug: string;
  title: string;
  /** Authoritative country when the channel is geo-themed. */
  country?: string;
  tags?: string[];
}

// Curated, verified channels (slug + length confirmed via the Are.na search API).
const DEFAULT_CHANNELS: ArenaChannel[] = [
  { slug: 'branding-ve2rrptjvou', title: 'Branding', tags: ['branding'] },
  { slug: 'design-branding-xc3_6suincc', title: 'Design / Branding', tags: ['branding'] },
  { slug: 'editorial-design-1524596582', title: 'Editorial Design', tags: ['editorial'] },
  { slug: 'logo-archive-p31bl4adgeu', title: 'Logo Archive', tags: ['logo'] },
  { slug: 'swiss-design-1vonsbyswzy', title: 'Swiss Design', country: 'Switzerland', tags: ['swiss', 'editorial'] },
  { slug: 'japanese-branding', title: 'Japanese Branding', country: 'Japan', tags: ['branding'] },
];

// Country → preferred geo-themed channels, used when --country is passed.
const COUNTRY_CHANNELS: Record<string, ArenaChannel[]> = {
  switzerland: [{ slug: 'swiss-design-1vonsbyswzy', title: 'Swiss Design', country: 'Switzerland', tags: ['swiss', 'editorial'] }],
  japan: [{ slug: 'japanese-branding', title: 'Japanese Branding', country: 'Japan', tags: ['branding'] }],
};

const API = 'https://api.are.na/v2';
const UA = 'VisantLabs-ReferenceSeeder/1.0 (+https://visantlabs.com)';

interface ArenaBlock {
  id: number;
  class: string;
  title?: string;
  generated_title?: string;
  image?: { original?: { url?: string }; display?: { url?: string } };
  source?: { url?: string; title?: string };
}

async function fetchChannelBlocks(slug: string, need: number, log: CollectOptions['log']): Promise<ArenaBlock[]> {
  const blocks: ArenaBlock[] = [];
  const per = 100;
  let page = 1;
  // Walk pages until we have enough image-bearing blocks (cap pages for safety)
  while (blocks.length < need && page <= 10) {
    const resp = await fetch(`${API}/channels/${slug}/contents?per=${per}&page=${page}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    });
    if (!resp.ok) {
      log.warn(`are.na channel "${slug}" → HTTP ${resp.status} (skipping)`);
      break;
    }
    const data = (await resp.json()) as { contents?: ArenaBlock[] };
    const batch = data.contents || [];
    if (batch.length === 0) break;
    blocks.push(...batch.filter((b) => b.image?.original?.url || b.image?.display?.url));
    page++;
    await new Promise((r) => setTimeout(r, 350)); // respect ~30 req/min
  }
  return blocks;
}

export const arena: SeedSource = {
  id: 'arena',
  label: 'Are.na (free API)',
  awardSource: 'Are.na',
  hasNativeGeo: false,
  needsFirecrawl: false,

  async collect({ limit, country, log }: CollectOptions): Promise<SeedItem[]> {
    const channels =
      country && COUNTRY_CHANNELS[country.toLowerCase()]
        ? COUNTRY_CHANNELS[country.toLowerCase()]
        : DEFAULT_CHANNELS;

    // Spread the limit across channels so one channel doesn't dominate.
    const perChannel = Math.max(3, Math.ceil(limit / channels.length));
    const items: SeedItem[] = [];

    for (const ch of channels) {
      if (items.length >= limit) break;
      log.info(`are.na → #${ch.slug} (${ch.title})`);
      const blocks = await fetchChannelBlocks(ch.slug, perChannel, log);

      for (const b of blocks.slice(0, perChannel)) {
        if (items.length >= limit) break;
        const imageUrl = b.image?.original?.url || b.image?.display?.url;
        if (!imageUrl) continue;
        items.push({
          imageUrl,
          // Prefer the original source for attribution; fall back to the Are.na block permalink
          sourceUrl: b.source?.url || `https://www.are.na/block/${b.id}`,
          awardSource: `Are.na · ${ch.title}`,
          title: b.title || b.source?.title || b.generated_title,
          country: ch.country || country,
          tags: ch.tags,
        });
      }
    }

    return items.slice(0, limit);
  },
};

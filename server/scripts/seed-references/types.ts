/**
 * Seed framework — shared types.
 *
 * Design principle: COLLECTION (scraping award galleries) is decoupled from
 * INGESTION (writing to the library). A source produces a list of `SeedItem`s;
 * the ingest core turns them into curated, geo-tagged references — deterministically,
 * idempotently, and testably. Scraping is just one way to fill the manifest;
 * a hand-authored / pre-extracted JSON file works exactly the same.
 */

import type { Firecrawl } from './firecrawl.js';

/** One curated reference candidate, source-agnostic. */
export interface SeedItem {
  /** Original image URL at the source (downloaded + re-hosted on R2 at ingest). */
  imageUrl: string;
  /** Page URL for attribution / dedup key. */
  sourceUrl: string;
  /** Award or archive it came from, e.g. "D&AD 2024", "Fonts In Use". */
  awardSource: string;
  title?: string;
  studio?: string;
  designer?: string;
  /** Authoritative country of origin (from award metadata). */
  country?: string;
  /** Region slug override; auto-derived from country when omitted. */
  region?: string;
  year?: number;
  tags?: string[];
}

export interface Logger {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  ok: (msg: string) => void;
}

export interface CollectOptions {
  /** Max items to collect from this source in this run. */
  limit: number;
  /** Optional ISO-ish country/display name to scope the gallery. */
  country?: string;
  firecrawl: Firecrawl;
  log: Logger;
}

/** A pluggable award/archive adapter. */
export interface SeedSource {
  /** Stable slug used on the CLI (`--source one-club`). */
  id: string;
  /** Human label. */
  label: string;
  /** Default awardSource stamped on items (adapters may refine per item/year). */
  awardSource: string;
  /** Whether this source exposes country as a first-class, filterable field. */
  hasNativeGeo: boolean;
  /** Whether collection requires Firecrawl (credits). Free API sources set false. */
  needsFirecrawl: boolean;
  /** Collect candidate references. */
  collect(opts: CollectOptions): Promise<SeedItem[]>;
}

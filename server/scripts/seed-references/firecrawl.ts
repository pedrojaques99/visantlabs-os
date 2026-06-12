/**
 * Thin wrapper over the Firecrawl CLI (the validated, LLM-resilient scraper).
 *
 * We deliberately use Firecrawl's `agent` (schema-driven autonomous extraction)
 * instead of brittle CSS/HTML parsing: award galleries change layout often, and
 * an LLM extractor against a JSON schema survives those changes. Old-guard
 * robustness, modern tooling.
 *
 * Requires `firecrawl` on PATH + credits (`firecrawl --status`).
 */

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

function run(args: string[], timeoutMs = 300_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'firecrawl',
      args,
      { shell: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr?.toString() || err.message));
        resolve(stdout?.toString() || '');
      }
    );
  });
}

export interface FirecrawlStatus {
  authenticated: boolean;
  creditsRemaining: number;
}

export class Firecrawl {
  /** Parse `firecrawl --status` for an auth + credit pre-flight. */
  async status(): Promise<FirecrawlStatus> {
    const out = await run(['--status'], 30_000).catch(() => '');
    const authenticated = /authenticated/i.test(out);
    // "Credits: 12,345 / 1,000,000" or "Credits: 12,345 remaining"
    const m = out.replace(/,/g, '').match(/Credits:\s*([\d]+)/i);
    const creditsRemaining = m ? parseInt(m[1], 10) : 0;
    return { authenticated, creditsRemaining };
  }

  /**
   * Schema-driven extraction over one or more URLs via `firecrawl agent`.
   * Returns the parsed `data` object matching `schema`.
   */
  async extract<T = any>(opts: {
    prompt: string;
    urls: string[];
    schema: Record<string, unknown>;
    maxCredits?: number;
  }): Promise<T> {
    const tmp = path.join(os.tmpdir(), `fc-extract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    const args = [
      'agent',
      JSON.stringify(opts.prompt),
      '--urls',
      opts.urls.join(','),
      '--schema',
      JSON.stringify(JSON.stringify(opts.schema)), // double-encode: CLI expects a JSON string arg
      '--wait',
      '--json',
      '-o',
      JSON.stringify(tmp),
    ];
    if (opts.maxCredits) args.push('--max-credits', String(opts.maxCredits));

    await run(args);
    const raw = await fs.readFile(tmp, 'utf-8').catch(() => '');
    await fs.unlink(tmp).catch(() => {});
    if (!raw) throw new Error('firecrawl agent produced no output');

    const parsed = JSON.parse(raw);
    // CLI wraps results as { success, data } — unwrap defensively
    return (parsed?.data ?? parsed) as T;
  }

  /** Plain markdown scrape (lighter; for adapters that parse listings themselves). */
  async scrapeMarkdown(url: string): Promise<string> {
    const tmp = path.join(os.tmpdir(), `fc-scrape-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.md`);
    await run(['scrape', JSON.stringify(url), '--only-main-content', '-o', JSON.stringify(tmp)]);
    const raw = await fs.readFile(tmp, 'utf-8').catch(() => '');
    await fs.unlink(tmp).catch(() => {});
    return raw;
  }
}

/** JSON schema shared by adapters that return a list of winner entries. */
export const WINNER_LIST_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Project / work title' },
          studio: { type: 'string', description: 'Studio or agency credited' },
          designer: { type: 'string', description: 'Individual designer if credited' },
          country: { type: 'string', description: 'Country of the studio/entrant' },
          year: { type: 'number', description: 'Award year' },
          imageUrl: { type: 'string', description: 'Direct URL of the work image (highest res available)' },
          sourceUrl: { type: 'string', description: 'URL of the winner detail page' },
        },
        required: ['imageUrl', 'sourceUrl'],
      },
    },
  },
  required: ['items'],
} as const;

export interface WinnerListResult {
  items: Array<{
    title?: string;
    studio?: string;
    designer?: string;
    country?: string;
    year?: number;
    imageUrl: string;
    sourceUrl: string;
  }>;
}

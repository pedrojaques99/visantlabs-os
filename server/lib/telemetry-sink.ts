import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Telemetry sink abstraction.
 *
 * The file-based sink writes to `.agent/telemetry/YYYY-MM-DD.md`, which is
 * perfect for local dev and self-hosted origins but breaks under serverless
 * (Vercel, Cloudflare Workers) where the filesystem is read-only or ephemeral.
 *
 * Sink is selected via env.TELEMETRY_SINK:
 *   • file   (default) — append to local markdown
 *   • memory         — in-process ring buffer, useful for tests
 *   • remote         — POST JSON to env.TELEMETRY_REMOTE_URL
 *   • noop           — drop on the floor (production serverless fallback)
 *
 * Swap implementations here without touching routes/telemetry.ts.
 */
export interface TelemetryEntry {
  /** Markdown body, already formatted by the caller. */
  markdown: string;
  /** Raw structured payload for remote sinks. */
  payload: Record<string, unknown>;
  /** ISO date string (YYYY-MM-DD) — used for file sharding. */
  date: string;
}

export interface TelemetrySink {
  append(entry: TelemetryEntry): Promise<void>;
  /** For tests + debug endpoints. May be empty for sinks that don't retain. */
  read?(date: string): Promise<string>;
}

// ── File sink ────────────────────────────────────────────────────────────────
class FileSink implements TelemetrySink {
  constructor(private readonly dir: string) {}

  async append(entry: TelemetryEntry): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${entry.date}.md`);
    await fs.appendFile(file, entry.markdown + '\n\n', 'utf8');
  }

  async read(date: string): Promise<string> {
    try {
      return await fs.readFile(path.join(this.dir, `${date}.md`), 'utf8');
    } catch {
      return '';
    }
  }
}

// ── Memory sink (tests + stateless preview) ──────────────────────────────────
class MemorySink implements TelemetrySink {
  private buffers = new Map<string, string[]>();
  private readonly maxPerDate = 1000;

  async append(entry: TelemetryEntry): Promise<void> {
    const list = this.buffers.get(entry.date) ?? [];
    list.push(entry.markdown);
    if (list.length > this.maxPerDate) list.shift();
    this.buffers.set(entry.date, list);
  }

  async read(date: string): Promise<string> {
    return (this.buffers.get(date) ?? []).join('\n\n');
  }
}

// ── Remote sink (POST JSON; best-effort, never blocks) ───────────────────────
class RemoteSink implements TelemetrySink {
  constructor(private readonly url: string) {}

  async append(entry: TelemetryEntry): Promise<void> {
    try {
      await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: entry.date, payload: entry.payload }),
      });
    } catch (err) {
      logger.warn({ err }, 'telemetry.remote.failed');
    }
  }
}

// ── Noop ─────────────────────────────────────────────────────────────────────
class NoopSink implements TelemetrySink {
  async append(): Promise<void> {
    /* intentional */
  }
}

// ── Selection ────────────────────────────────────────────────────────────────
let cached: TelemetrySink | null = null;

export function getTelemetrySink(): TelemetrySink {
  if (cached) return cached;

  const choice = env.TELEMETRY_SINK;
  // Serverless safety: refuse file sink when running on Vercel.
  if (choice === 'file' && env.VERCEL) {
    logger.warn(
      { reason: 'serverless-readonly-fs' },
      'telemetry.sink.downgraded: file → memory (set TELEMETRY_SINK=remote to persist)'
    );
    cached = new MemorySink();
    return cached;
  }

  switch (choice) {
    case 'memory':
      cached = new MemorySink();
      break;
    case 'remote':
      if (!env.TELEMETRY_REMOTE_URL) {
        logger.error('TELEMETRY_SINK=remote but TELEMETRY_REMOTE_URL is unset — falling back to noop');
        cached = new NoopSink();
      } else {
        cached = new RemoteSink(env.TELEMETRY_REMOTE_URL);
      }
      break;
    case 'noop':
      cached = new NoopSink();
      break;
    case 'file':
    default:
      cached = new FileSink(path.resolve(process.cwd(), '.agent', 'telemetry'));
  }

  return cached;
}

/** Test-only hook. */
export function _setTelemetrySink(sink: TelemetrySink | null): void {
  cached = sink;
}

/**
 * Brand Asset Analysis — Async Job Queue
 *
 * Mirrors the ImageLab / Content Studio job pattern: Redis-persisted jobs with a
 * TTL, created by a POST (202 + jobId), polled via GET. Lets a large brand
 * (hundreds of assets) be analyzed without a single long HTTP request that the
 * proxy would time out — the client polls for `{ processed, total }` progress.
 *
 * No credit bookkeeping: asset analysis isn't metered (unlike imagelab), so this
 * is a lean progress-tracking job, not a charge→refund job.
 */
import { nanoid } from 'nanoid';
import { redisClient } from './redis.js';

export const ANALYSIS_JOB_TTL_SECONDS = 60 * 60 * 2; // 2h
/** A non-terminal job older than this is treated as orphaned (server restarted). */
const STALE_MS = 10 * 60 * 1000; // 10 min — large brands legitimately take a while

export type AnalysisJobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface BrandAssetAnalysisJob {
  jobId: string;
  guidelineId: string;
  userId: string;
  status: AnalysisJobStatus;
  total: number;
  processed: number;
  analyzed: number;
  /** Assets that were attempted but errored (timeout / provider down / spend-capped). */
  failed?: number;
  signature?: unknown;
  /** Observability: how many assets each provider served, e.g. {gemini: 8, replicate: 24}. */
  providers?: Record<string, number>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

function key(jobId: string): string {
  return `brand-asset-analysis-job:${jobId}`;
}

export async function saveAnalysisJob(job: BrandAssetAnalysisJob): Promise<void> {
  job.updatedAt = Date.now();
  try {
    await redisClient.setex(key(job.jobId), ANALYSIS_JOB_TTL_SECONDS, JSON.stringify(job));
  } catch (err) {
    // Redis down — job tracking degrades (poll will 404) but never crashes a request.
    console.warn('[analysisJob] save failed', (err as any)?.message || err);
  }
}

export async function loadAnalysisJob(jobId: string): Promise<BrandAssetAnalysisJob | null> {
  try {
    const raw = await redisClient.get(key(jobId));
    return raw ? (JSON.parse(raw as string) as BrandAssetAnalysisJob) : null;
  } catch {
    return null; // Redis down / parse error → treat as not found
  }
}

export function createAnalysisJob(params: {
  guidelineId: string;
  userId: string;
}): BrandAssetAnalysisJob {
  const now = Date.now();
  return {
    jobId: nanoid(),
    guidelineId: params.guidelineId,
    userId: params.userId,
    status: 'pending',
    total: 0,
    processed: 0,
    analyzed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Detect an orphaned (server-restarted) job on read: still non-terminal but
 * older than STALE_MS. Mark it failed so a poller gets a coherent terminal
 * status. Partial work is already persisted on the guideline (resumable).
 */
export async function reconcileIfOrphaned(
  job: BrandAssetAnalysisJob
): Promise<BrandAssetAnalysisJob> {
  const isTerminal = job.status === 'done' || job.status === 'error';
  if (isTerminal) return job;
  if (Date.now() - job.updatedAt < STALE_MS) return job;

  job.status = 'error';
  job.error =
    'Analysis was interrupted. Click Analyze again to finish — assets already analyzed are skipped.';
  await saveAnalysisJob(job);
  return job;
}

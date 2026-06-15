/**
 * ImageLab Async Job Queue
 *
 * Mirrors the Content Studio job pattern (server/routes/contentStudio.ts):
 * Redis-persisted jobs with a TTL, created by a POST, polled via GET.
 *
 * Persistence: redisClient.setex with a key prefix + TTL (same infra as Content
 * Studio). The job carries `userId` so the polling endpoint can enforce
 * ownership (403 for other users, 404 for missing/expired).
 *
 * Refund: the worker charges credits up-front and refunds on failure, preserving
 * the Phase 1.3 charge→refund contract from the synchronous path.
 *
 * Orphans: a job is processed in-process. If the server restarts mid-job the
 * job stays in a non-terminal status forever (until TTL). On GET we detect such
 * stale non-terminal jobs (older than STALE_MS), mark them failed, and issue a
 * one-time refund — flipping a `refunded` flag so a re-poll can't double-refund.
 */
import { nanoid } from 'nanoid';
import { redisClient } from './redis.js';
import { refundCreditsWithRetry } from './credits.js';
import type { DeductionSource } from './credits.js';

export const IMAGELAB_JOB_TTL_SECONDS = 60 * 60 * 2; // 2h, same as Content Studio
/** A non-terminal job older than this is treated as orphaned (server restarted). */
const STALE_MS = 5 * 60 * 1000; // 5 min — generous upper bound for a single op

export type ImageLabJobKind = 'generative-expand' | 'inpaint';
export type ImageLabJobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface ImageLabJob {
  jobId: string;
  kind: ImageLabJobKind;
  userId: string;
  status: ImageLabJobStatus;
  createdAt: number;
  updatedAt: number;
  /** Provider result on success (shape matches the synchronous response). */
  result?: unknown;
  error?: string;
  // Credit bookkeeping — mirrors the synchronous charge→refund contract.
  creditsCharged: number;
  deductionSource: DeductionSource;
  /** Guards against double-refund (worker failure + orphan sweep both firing). */
  refunded?: boolean;
}

function key(jobId: string): string {
  return `imagelab-job:${jobId}`;
}

export async function saveJob(job: ImageLabJob): Promise<void> {
  job.updatedAt = Date.now();
  await redisClient.setex(key(job.jobId), IMAGELAB_JOB_TTL_SECONDS, JSON.stringify(job));
}

export async function loadJob(jobId: string): Promise<ImageLabJob | null> {
  const raw = await redisClient.get(key(jobId));
  return raw ? (JSON.parse(raw as string) as ImageLabJob) : null;
}

export function createJob(params: {
  kind: ImageLabJobKind;
  userId: string;
  creditsCharged: number;
  deductionSource: DeductionSource;
}): ImageLabJob {
  const now = Date.now();
  return {
    jobId: nanoid(),
    kind: params.kind,
    userId: params.userId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    creditsCharged: params.creditsCharged,
    deductionSource: params.deductionSource,
  };
}

/** Refund once, flipping the guard. Safe to call from worker + orphan sweep. */
async function refundJobOnce(job: ImageLabJob): Promise<void> {
  if (job.refunded) return;
  if (job.creditsCharged > 0) {
    await refundCreditsWithRetry(job.userId, job.creditsCharged, job.deductionSource).catch(
      () => {}
    );
  }
  job.refunded = true;
}

/**
 * Run the generative operation in the background, updating the persisted job.
 * `op` is the provider call (already bound with its params). On success the job
 * captures the result; on failure it refunds credits (Phase 1.3 contract).
 */
export async function runImageLabJob(job: ImageLabJob, op: () => Promise<unknown>): Promise<void> {
  job.status = 'processing';
  await saveJob(job);

  try {
    const result = await op();
    job.status = 'done';
    job.result = result;
    await saveJob(job);
  } catch (err: any) {
    job.status = 'error';
    job.error = err?.message ?? 'Generation failed';
    await refundJobOnce(job);
    await saveJob(job);
  }
}

/**
 * Detect an orphaned (server-restarted) job on read: still non-terminal but
 * older than STALE_MS. Mark it failed + refund once. Returns the (possibly
 * mutated) job so the caller can serve a coherent terminal status.
 */
export async function reconcileIfOrphaned(job: ImageLabJob): Promise<ImageLabJob> {
  const isTerminal = job.status === 'done' || job.status === 'error';
  if (isTerminal) return job;
  if (Date.now() - job.updatedAt < STALE_MS) return job;

  job.status = 'error';
  job.error = 'Job interrupted (server restarted). Credits were refunded.';
  await refundJobOnce(job);
  await saveJob(job);
  return job;
}

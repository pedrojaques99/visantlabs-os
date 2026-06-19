/**
 * Image generation fallback router.
 *
 * Mockup/image generation used to dispatch to a SINGLE provider and surface a
 * raw 500 whenever that provider was unavailable (e.g. gpt-image-2 on an
 * unverified OpenAI org → 403). This router tries the requested model first,
 * then cascades through the other *configured* providers until one succeeds.
 *
 * Design (deliberately reuses existing infra — see .agent/plans/BRAND-GENERATE-CLARITY.md):
 *  · Per-attempt resilience (retry + circuit breaker) is the caller's `run()`,
 *    which wraps each provider in `withResilience(provider, …)`. We do NOT add a
 *    second cooldown table here.
 *  · `isCircuitOpen(provider)` (ai-resilience) lets us skip a provider whose
 *    breaker is open without paying a failed attempt.
 *  · Error classification splits the existing shouldRetry() semantics into two
 *    questions: is this the user's payload (stop), or this provider's problem
 *    (try the next one)?
 */

import {
  IMAGE_MODEL_REGISTRY,
  DEFAULT_IMAGE_MODEL_ID,
  type ImageModelEntry,
} from '../../../src/constants/imageModelRegistry.js';
import { getCreditsRequired } from '../../../src/utils/creditCalculator.js';
import { isCircuitOpen } from '../ai-resilience.js';
import type { Resolution } from '../../../src/types/types.js';

export type FallbackStrategy = 'cost' | 'quality';

export interface ImageCandidate {
  model: string;
  provider: string;
}

export interface ImageRouterResult {
  base64: string;
  seed?: number;
  modelUsed: string;
  providerUsed: string;
  /** True when the winning model differs from the one originally requested. */
  fellBack: boolean;
  /** Models that were attempted and failed, in order (for logging). */
  failedAttempts: Array<{ model: string; provider: string; error: string }>;
}

export interface ImageRouterParams {
  requestedModel: string;
  requestedProvider: string;
  resolution?: Resolution;
  strategy?: FallbackStrategy;
  /** Providers that are usable right now (system env key OR user BYOK present). */
  usableProviders: Set<string>;
  /**
   * Runs ONE candidate end-to-end (key resolution + provider dispatch), wrapped
   * by the caller in `withResilience(provider, …)`. Throws on failure.
   */
  run: (candidate: ImageCandidate) => Promise<{ base64: string; seed?: number }>;
  /** Optional structured logger. */
  log?: (msg: string, meta?: unknown) => void;
}

/**
 * 400/422-class errors: the user's prompt or payload is the problem. Switching
 * provider will not help — re-running the same prompt elsewhere fails the same
 * way (and may even burn credits). Stop and propagate.
 */
export function isRequestError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (message.includes('400') || message.includes('invalid')) return true;
  if (
    message.includes('422') ||
    message.includes('safety') ||
    message.includes('blocked') ||
    message.includes('content policy') ||
    message.includes('content_policy') ||
    message.includes('moderation')
  ) {
    return true;
  }
  return false;
}

/**
 * Provider-side problems (auth/billing/rate/overload/5xx/circuit-open). Another
 * provider may well succeed — cascade to the next candidate.
 */
export function isProviderError(error: unknown): boolean {
  return !isRequestError(error);
}

/** Quality-first fallback order (curated for brand mockups). Lower = tried earlier. */
const QUALITY_RANK: Record<string, number> = {
  openai: 10,
  gemini: 20,
  imagen: 30,
  ideogram: 40,
  reve: 50,
  seedream: 60,
};

const registryByModel: Map<string, ImageModelEntry> = new Map(
  IMAGE_MODEL_REGISTRY.map((m) => [m.id, m])
);

function providerOf(model: string, fallbackProvider: string): string {
  return registryByModel.get(model)?.provider ?? fallbackProvider;
}

/**
 * Build the ordered candidate list: requested model first, then every other
 * *usable* model ordered by the chosen strategy. The DEFAULT model is always
 * appended as a last-resort anchor (its provider — Gemini — is the platform's
 * base requirement). Deduped by model id.
 */
export function buildCandidates(params: {
  requestedModel: string;
  requestedProvider: string;
  resolution?: Resolution;
  strategy: FallbackStrategy;
  usableProviders: Set<string>;
}): ImageCandidate[] {
  const { requestedModel, requestedProvider, resolution, strategy, usableProviders } = params;

  const others = IMAGE_MODEL_REGISTRY.filter(
    (m) => m.id !== requestedModel && usableProviders.has(m.provider)
  );

  others.sort((a, b) => {
    if (strategy === 'cost') {
      const ca = getCreditsRequired(a.id, resolution, a.provider as any);
      const cb = getCreditsRequired(b.id, resolution, b.provider as any);
      if (ca !== cb) return ca - cb;
    }
    // quality (and cost tie-break): curated provider rank, then stable by id
    const ra = QUALITY_RANK[a.provider] ?? 99;
    const rb = QUALITY_RANK[b.provider] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.id.localeCompare(b.id);
  });

  const ordered: ImageCandidate[] = [
    { model: requestedModel, provider: providerOf(requestedModel, requestedProvider) },
    ...others.map((m) => ({ model: m.id, provider: m.provider })),
  ];

  // Anchor: always have the always-configured default at the end.
  if (!ordered.some((c) => c.model === DEFAULT_IMAGE_MODEL_ID)) {
    ordered.push({
      model: DEFAULT_IMAGE_MODEL_ID,
      provider: providerOf(DEFAULT_IMAGE_MODEL_ID, 'gemini'),
    });
  }

  // Dedup by model id, preserving order.
  const seen = new Set<string>();
  return ordered.filter((c) => (seen.has(c.model) ? false : (seen.add(c.model), true)));
}

export async function generateImageWithFallback(
  params: ImageRouterParams
): Promise<ImageRouterResult> {
  const {
    requestedModel,
    requestedProvider,
    resolution,
    strategy = 'quality',
    usableProviders,
    run,
    log = () => {},
  } = params;

  const candidates = buildCandidates({
    requestedModel,
    requestedProvider,
    resolution,
    strategy,
    usableProviders,
  });

  const failedAttempts: ImageRouterResult['failedAttempts'] = [];

  for (const candidate of candidates) {
    // Skip a provider whose breaker is open — except the originally requested
    // model, which the user explicitly chose (let its half-open probe through).
    const isRequested = candidate.model === requestedModel;
    if (!isRequested && isCircuitOpen(candidate.provider)) {
      log('[imageRouter] skipping open circuit', candidate);
      failedAttempts.push({ ...candidate, error: 'circuit_open' });
      continue;
    }

    try {
      log('[imageRouter] attempting', { ...candidate, strategy });
      const { base64, seed } = await run(candidate);
      return {
        base64,
        seed,
        modelUsed: candidate.model,
        providerUsed: candidate.provider,
        fellBack: candidate.model !== requestedModel,
        failedAttempts,
      };
    } catch (error: any) {
      const msg = error?.message || String(error);
      failedAttempts.push({ ...candidate, error: msg });

      // The user's prompt/payload is the problem — no provider will fix it.
      if (isRequestError(error)) {
        log('[imageRouter] request error — not cascading', { ...candidate, error: msg });
        throw error;
      }

      log('[imageRouter] provider error — cascading', { ...candidate, error: msg });
    }
  }

  const err = new Error(
    'image_generation_unavailable: all configured image providers failed or are unavailable.'
  );
  (err as any).code = 'image_generation_unavailable';
  (err as any).failedAttempts = failedAttempts;
  throw err;
}

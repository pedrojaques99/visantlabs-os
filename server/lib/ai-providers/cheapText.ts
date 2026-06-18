/**
 * Cheap-text router — cost-ordered, multi-provider fallback for lightweight LLM
 * text/JSON completions (brand suggestions, short creative copy, etc.).
 *
 * Why: prod's Gemini key is spend-capped and the VPS can't egress to Replicate
 * (see assetAnalysis saga). A single-provider call is fragile. This cascades
 * across OpenAI-compatible `/chat/completions` providers — cheapest/free first —
 * and returns the first that answers. "Pega algum dos disponíveis de qualquer
 * forma": skip any without a key, skip any in cooldown, try the next.
 *
 * Every provider here (Groq, Cerebras, NVIDIA NIM, OpenRouter, Gemini's
 * OpenAI-compat endpoint, OpenAI) speaks the same `/chat/completions` shape, so
 * there's ONE request path. Mirrors the fail-fast + per-provider cooldown of
 * `brand/assetAnalysis.ts` rather than the slow 3×-retry resilience wrapper —
 * the chain itself IS the resilience.
 */
import { env } from '../../config/env.js';
import { safeFetch } from '../../utils/securityValidation.js';
import { getGeminiApiKey } from '../../utils/geminiApiKey.js';
import { getOpenAiApiKey } from '../../utils/openAiApiKey.js';

export type CheapTextProviderId =
  | 'groq'
  | 'cerebras'
  | 'nvidia'
  | 'openrouter'
  | 'gemini'
  | 'openai';

interface ProviderSpec {
  id: CheapTextProviderId;
  label: string;
  baseUrl: string;
  /** Default model — small/fast/cheap on each platform. */
  model: string;
  /** Lower = cheaper/preferred. Free tiers rank lowest. */
  costRank: number;
  /** Resolve the API key (async for user-aware Gemini/OpenAI; sync for env keys). */
  getKey: (userId?: string) => Promise<string | undefined> | string | undefined;
}

// Cost-benefit order: free/cheapest first, paid last. Models chosen for fast,
// solid JSON adherence at near-zero cost.
const PROVIDERS: ProviderSpec[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    costRank: 10,
    getKey: () => env.GROQ_API_KEY,
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
    costRank: 20,
    getKey: () => env.CEREBRAS_API_KEY,
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    model: 'meta/llama-3.3-70b-instruct',
    costRank: 30,
    getKey: () => env.NVIDIA_API_KEY,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    costRank: 40,
    getKey: () => env.OPENROUTER_API_KEY,
  },
  {
    id: 'gemini',
    label: 'Gemini Flash',
    // Gemini exposes an OpenAI-compatible surface — keeps the single code path.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    costRank: 50,
    getKey: (userId) => getGeminiApiKey(userId),
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    costRank: 60,
    getKey: (userId) => getOpenAiApiKey(userId),
  },
];

// ── Per-provider cooldown (module-scoped, mirrors assetAnalysis) ──────────────
const cooldownUntil = new Map<CheapTextProviderId, number>();
const AUTH_COOLDOWN_MS = 30 * 60 * 1000; // bad/missing key, billing — back off long
const RATE_COOLDOWN_MS = 90 * 1000; // 429 — transient, short
const SERVER_COOLDOWN_MS = 60 * 1000; // 5xx / network / timeout

function inCooldown(id: CheapTextProviderId): boolean {
  return Date.now() < (cooldownUntil.get(id) || 0);
}
function tripCooldown(id: CheapTextProviderId, ms: number, reason: string): void {
  cooldownUntil.set(id, Date.now() + ms);
  console.warn(`[cheapText] ${id} cooling down ${Math.round(ms / 1000)}s — ${reason}`);
}

export interface CheapTextOptions {
  system: string;
  user: string;
  userId?: string;
  /** Ask for a JSON object response (best-effort response_format hint). */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Override the model per provider (rare). */
  modelOverride?: Partial<Record<CheapTextProviderId, string>>;
}

export interface CheapTextResult {
  text: string;
  provider: CheapTextProviderId;
  model: string;
}

/** Ordered provider list, honoring TEXT_GEN_PRIMARY, cheapest-first otherwise. */
function orderedProviders(): ProviderSpec[] {
  const primary = env.TEXT_GEN_PRIMARY as CheapTextProviderId | undefined;
  return [...PROVIDERS].sort((a, b) => {
    if (primary) {
      if (a.id === primary) return -1;
      if (b.id === primary) return 1;
    }
    return a.costRank - b.costRank;
  });
}

async function callProvider(p: ProviderSpec, key: string, opts: CheapTextOptions): Promise<string> {
  const model = opts.modelOverride?.[p.id] || p.model;
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  };

  const res = await safeFetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // OpenRouter attribution headers — harmless elsewhere.
      'HTTP-Referer': 'https://visantlabs.com',
      'X-Title': 'Visant Labs',
    },
    body: JSON.stringify(body),
    timeoutMs: 15_000,
  } as any);

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`${p.id} ${res.status}: ${detail.slice(0, 200)}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }

  const data: any = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error(`${p.id}: empty completion`);
  return text;
}

function classifyAndCooldown(p: ProviderSpec, err: unknown): void {
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403 || status === 402) {
    tripCooldown(p.id, AUTH_COOLDOWN_MS, `auth/billing ${status}`);
  } else if (status === 429) {
    tripCooldown(p.id, RATE_COOLDOWN_MS, 'rate limited (429)');
  } else if (!status || status >= 500) {
    tripCooldown(p.id, SERVER_COOLDOWN_MS, `server/network (${status || 'no response'})`);
  }
  // 4xx other than the above (e.g. 400 bad request) = our payload's fault → no
  // cooldown, but we still cascade so a quirky provider doesn't block the user.
}

/**
 * Run the cost-ordered chain and return the first successful completion.
 * Throws `cheaptext_unavailable: …` only when EVERY provider is unconfigured or
 * down — callers can treat that as "AI suggestions temporarily unavailable".
 */
export async function completeCheapText(opts: CheapTextOptions): Promise<CheapTextResult> {
  const providers = orderedProviders();
  let configured = 0;

  for (const p of providers) {
    if (inCooldown(p.id)) continue;
    const key = await p.getKey(opts.userId);
    if (!key) continue;
    configured++;
    try {
      const text = await callProvider(p, key, opts);
      return { text, provider: p.id, model: opts.modelOverride?.[p.id] || p.model };
    } catch (err) {
      classifyAndCooldown(p, err);
      console.warn(`[cheapText] ${p.id} failed, cascading:`, (err as any)?.message || err);
      // continue to next provider
    }
  }

  const reason = configured === 0 ? 'no provider configured' : 'all providers failed/cooling-down';
  throw new Error(`cheaptext_unavailable: ${reason}`);
}

/** Best-effort JSON parse from an LLM completion (handles ```json fences + prose). */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  try {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenced) return JSON.parse(fenced[1].trim());
    const obj = text.match(/[{[][\s\S]*[}\]]/);
    if (obj) return JSON.parse(obj[0]);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Observability/health: which providers are configured and their cooldown state. */
export async function cheapTextStatus(
  userId?: string
): Promise<Array<{ id: CheapTextProviderId; configured: boolean; coolingDownMs: number }>> {
  return Promise.all(
    orderedProviders().map(async (p) => ({
      id: p.id,
      configured: !!(await p.getKey(userId)),
      coolingDownMs: Math.max(0, (cooldownUntil.get(p.id) || 0) - Date.now()),
    }))
  );
}

/** True when at least one cheap-text provider has a key (sync env check only). */
export function isCheapTextConfigured(): boolean {
  return !!(
    env.GROQ_API_KEY ||
    env.CEREBRAS_API_KEY ||
    env.NVIDIA_API_KEY ||
    env.OPENROUTER_API_KEY ||
    env.GEMINI_API_KEY ||
    env.OPENAI_API_KEY
  );
}

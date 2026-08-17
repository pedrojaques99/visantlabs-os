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
import { recordAiUsage } from '../ai/metered.js';

export type CheapTextProviderId =
  | 'groq'
  | 'cerebras'
  | 'nvidia'
  | 'openrouter'
  | 'gemini'
  | 'openai';

/**
 * `cheap` = sugestões e utilidades grátis. `quality` = geração que o usuário
 * PAGA (naming, copy de marca) — mesma cascata, modelo mais forte por provider.
 * Sem o tier, migrar uma rota paga para cá seria rebaixar o resultado.
 */
export type TextTier = 'cheap' | 'quality';

interface ProviderSpec {
  id: CheapTextProviderId;
  label: string;
  baseUrl: string;
  /** Modelo por tier. Só IDs já em uso neste repo — não inventar. */
  models: Record<TextTier, string>;
  /** Lower = cheaper/preferred. Free tiers rank lowest. */
  costRank: number;
  /** Resolve the API key (async for user-aware Gemini/OpenAI; sync for env keys). */
  getKey: (userId?: string) => Promise<string | undefined> | string | undefined;
  /** Resolve SÓ a chave do usuário (sem cair na da plataforma). */
  getOwnKey?: (userId?: string) => Promise<string | undefined>;
  /** Suporta chave do próprio usuário (BYOK) — afeta a cobrança de crédito. */
  supportsByok?: boolean;
  /**
   * Aceita `response_format: {type:'json_schema'}` (shape GARANTIDO pelo
   * provider). Quem não aceita recebe o schema escrito no prompt — mesma
   * intenção, garantia mais fraca. Ver `buildResponseFormat`.
   */
  supportsJsonSchema?: boolean;
  /**
   * Aceita imagem na mensagem (`content: [{type:'image_url'}]` do shape
   * OpenAI). Quem NÃO declara isto é PULADO quando o caller manda imagem —
   * mandar imagem pra um modelo texto-puro não dá erro barulhento, dá
   * alucinação silenciosa sobre um conteúdo que ele nunca viu.
   */
  supportsVision?: boolean;
}

// Cost-benefit order: free/cheapest first, paid last. Models chosen for fast,
// solid JSON adherence at near-zero cost.
const PROVIDERS: ProviderSpec[] = [
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    // llama-3.3-70b já é modelo forte — serve os dois tiers sem inventar ID novo.
    models: { cheap: 'llama-3.3-70b-versatile', quality: 'llama-3.3-70b-versatile' },
    costRank: 10,
    getKey: () => env.GROQ_API_KEY,
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: { cheap: 'llama-3.3-70b', quality: 'llama-3.3-70b' },
    costRank: 20,
    getKey: () => env.CEREBRAS_API_KEY,
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: {
      cheap: 'meta/llama-3.3-70b-instruct',
      quality: 'meta/llama-3.3-70b-instruct',
    },
    costRank: 30,
    getKey: () => env.NVIDIA_API_KEY,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: {
      cheap: 'meta-llama/llama-3.3-70b-instruct:free',
      quality: 'meta-llama/llama-3.3-70b-instruct:free',
    },
    costRank: 40,
    getKey: () => env.OPENROUTER_API_KEY,
  },
  {
    id: 'gemini',
    label: 'Gemini Flash',
    // Gemini exposes an OpenAI-compatible surface — keeps the single code path.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: { cheap: 'gemini-2.5-flash', quality: 'gemini-3-flash-preview' },
    costRank: 50,
    getKey: (userId) => getGeminiApiKey(userId),
    getOwnKey: (userId) => getGeminiApiKey(userId, { skipFallback: true }),
    supportsByok: true,
    supportsJsonSchema: true,
    // gemini-2.5-flash e gemini-3-flash-preview são multimodais — mesmo ID serve texto e imagem.
    supportsVision: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    // gpt-4o já roda neste projeto (server/routes/campaign.ts) — ID comprovado.
    models: { cheap: 'gpt-4o-mini', quality: 'gpt-4o' },
    costRank: 60,
    getKey: (userId) => getOpenAiApiKey(userId),
    getOwnKey: (userId) => getOpenAiApiKey(userId, { skipFallback: true }),
    supportsByok: true,
    supportsJsonSchema: true,
    // gpt-4o e gpt-4o-mini aceitam image_url — os dois tiers enxergam.
    supportsVision: true,
  },
];

/** Providers que enxergam imagem. Usado na mensagem de erro e em `cheapTextStatus`. */
const VISION_PROVIDERS = PROVIDERS.filter((p) => p.supportsVision).map((p) => p.id);

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
  /** Default 'cheap'. Use 'quality' em geração que o usuário paga. */
  tier?: TextTier;
  /** Tenta este provider primeiro (escolha explícita do usuário). */
  preferProvider?: CheapTextProviderId;
  /**
   * JSON Schema do formato esperado. Substitui o `responseSchema` do Gemini ao
   * migrar rotas para cá. Onde o provider suporta (`supportsJsonSchema`) o
   * shape é GARANTIDO; nos demais o schema entra no prompt — a intenção
   * sobrevive, a garantia não. Implica `json: true`.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /**
   * Chave crua de um provider, vinda do CALLER (não do banco). Existe porque
   * várias funções do `geminiService` recebem `apiKey` por parâmetro em vez de
   * `userId` — sem isto, migrá-las faria o usuário com chave própria consumir a
   * chave da plataforma (e as rotas cobram por `isUserApiKey`, então a conta
   * viraria prejuízo silencioso).
   *
   * O provider dono da chave é tentado PRIMEIRO e marcado como `usedUserKey`.
   * Se ele cair, a cascata segue normalmente nas chaves de plataforma — BYOK e
   * fallback coexistem em vez de um anular o outro.
   */
  apiKeyOverride?: { provider: CheapTextProviderId; key: string };
  /**
   * Imagens (data URI ou base64 cru) a anexar na mensagem do usuário. Quando
   * presente, a cascata só considera providers `supportsVision` — o resto não
   * é "pior", é cego, e um resumo inventado de uma imagem que o modelo não viu
   * é pior que erro.
   */
  images?: string[];
  /** Rótulo do gasto no `usage_record` (ex. 'brand-extract'). Default 'cheap-text'. */
  operation?: string;
  /** Feature de negócio do gasto, pro relatório de custo. */
  feature?: string;
  /** Timeout por tentativa. Default 15s (texto) / 90s (com imagem). */
  timeoutMs?: number;
}

export interface CheapTextResult {
  text: string;
  provider: CheapTextProviderId;
  model: string;
  /**
   * O provider que serviu usou a chave do PRÓPRIO usuário (BYOK). Só gemini e
   * openai suportam. Quem cobra crédito precisa disso: cobrar cheio quem trouxe
   * a própria chave seria cobrar duas vezes pelo mesmo token.
   */
  usedUserKey: boolean;
  /** Total de tokens reportado pelo provider, quando disponível. */
  tokens?: number;
  /** Tokens de entrada e saída separados — `usage_records` precifica diferente. */
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Ordem dos providers: preferência do request > `TEXT_GEN_PRIMARY` > mais barato.
 *
 * `prefer` existe porque escolher um modelo na UI tem que colocar o provider
 * DELE na frente — senão a cascata tenta o mais barato primeiro e a escolha do
 * usuário só valeria por acaso, quando os anteriores falhassem. Preferir é
 * "tenta primeiro", não "só esse": o fallback continua valendo se ele cair.
 */
function orderedProviders(prefer?: CheapTextProviderId, needsVision = false): ProviderSpec[] {
  const primary = prefer || (env.TEXT_GEN_PRIMARY as CheapTextProviderId | undefined);
  const pool = needsVision ? PROVIDERS.filter((p) => p.supportsVision) : PROVIDERS;
  return [...pool].sort((a, b) => {
    if (primary) {
      if (a.id === primary) return -1;
      if (b.id === primary) return 1;
    }
    return a.costRank - b.costRank;
  });
}

/** Modelo efetivo do provider para as opções dadas. */
function modelFor(p: ProviderSpec, opts: CheapTextOptions): string {
  return opts.modelOverride?.[p.id] || p.models[opts.tier ?? 'cheap'];
}

/**
 * `response_format` do provider. Com schema e suporte nativo, o shape é
 * garantido pelo servidor; sem suporte, cai para `json_object` — e aí o schema
 * precisa estar no prompt (ver `systemFor`), senão o modelo devolve QUALQUER
 * JSON válido e o caller quebra no acesso ao campo.
 */
function buildResponseFormat(p: ProviderSpec, opts: CheapTextOptions): unknown | undefined {
  if (opts.jsonSchema && p.supportsJsonSchema) {
    return {
      type: 'json_schema',
      json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: false },
    };
  }
  if (opts.jsonSchema || opts.json) return { type: 'json_object' };
  return undefined;
}

/**
 * System prompt efetivo. Quando o provider NÃO suporta json_schema, o schema é
 * anexado ao prompt — é a única forma de o fallback produzir o mesmo shape que
 * o provider principal produziria por contrato.
 */
function systemFor(p: ProviderSpec, opts: CheapTextOptions): string {
  if (!opts.jsonSchema || p.supportsJsonSchema) return opts.system;
  return [
    opts.system,
    '',
    'Respond ONLY with a JSON object matching this exact JSON Schema:',
    JSON.stringify(opts.jsonSchema.schema),
    'No prose, no markdown fences.',
  ].join('\n');
}

/**
 * Base64 cru vira data URI. Os providers OpenAI-compat só aceitam `image_url`
 * com URL completa; mandar o base64 pelado devolve 400 em todos eles.
 */
function toDataUri(img: string): string {
  return img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
}

/**
 * Conteúdo da mensagem do usuário. String quando é só texto (shape que TODO
 * provider aceita, inclusive os text-only), array de partes quando há imagem.
 */
function userContentFor(opts: CheapTextOptions): unknown {
  const images = opts.images?.filter(Boolean) ?? [];
  if (images.length === 0) return opts.user;
  return [
    { type: 'text', text: opts.user },
    ...images.map((img) => ({ type: 'image_url', image_url: { url: toDataUri(img) } })),
  ];
}

async function callProvider(
  p: ProviderSpec,
  key: string,
  opts: CheapTextOptions
): Promise<{ text: string; tokens?: number; inputTokens?: number; outputTokens?: number }> {
  const model = modelFor(p, opts);
  const responseFormat = buildResponseFormat(p, opts);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemFor(p, opts) },
      { role: 'user', content: userContentFor(opts) },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1024,
    ...(responseFormat ? { response_format: responseFormat } : {}),
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
    // 15s serve pra sugestão curta. Extração multimodal (PDF de marca, 12
    // imagens inline) não cabe nisso — o timeout curto virava "provider caiu"
    // e derrubava a cascata inteira por impaciência.
    timeoutMs: opts.timeoutMs ?? (opts.images?.length ? 90_000 : 15_000),
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
  // Todo provider OpenAI-compat devolve `usage`. Repassar input e output
  // SEPARADOS importa: `usage_records` precifica os dois de forma diferente
  // (saída custa mais), então jogar o total em `outputTokens` inflaria o custo.
  const u = data?.usage;
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    text,
    tokens: num(u?.total_tokens),
    inputTokens: num(u?.prompt_tokens),
    outputTokens: num(u?.completion_tokens),
  };
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
export async function completeText(opts: CheapTextOptions): Promise<CheapTextResult> {
  // Chave do caller manda no provider dela ir primeiro — é a intenção explícita
  // do usuário, acima de custo e de TEXT_GEN_PRIMARY.
  const override = opts.apiKeyOverride;
  const needsVision = !!opts.images?.length;
  const providers = orderedProviders(override?.provider || opts.preferProvider, needsVision);
  let configured = 0;

  for (const p of providers) {
    if (inCooldown(p.id)) continue;
    const isOverridden = override?.provider === p.id;
    // `getKey` pode LANÇAR (getOpenAiApiKey lança quando não há chave nenhuma).
    // Sem este catch, um provider desconfigurado no fim da fila derruba a
    // cascata inteira em vez de ser pulado — o oposto do ponto dela existir.
    let key: string | undefined;
    try {
      key = isOverridden ? override!.key : await p.getKey(opts.userId);
    } catch {
      key = undefined;
    }
    if (!key) continue;
    configured++;
    const model = modelFor(p, opts);
    const meterCtx = {
      provider: p.id,
      model,
      operation: opts.operation ?? 'cheap-text',
      userId: opts.userId,
      feature: opts.feature,
      promptLength: opts.user.length,
      hasInputImage: needsVision,
    } as const;
    try {
      const { text, tokens, inputTokens, outputTokens } = await callProvider(p, key, opts);
      // BYOK só conta se a chave que EFETIVAMENTE serviu é do usuário — comparar
      // com a resolução sem fallback, senão a chave da plataforma passaria por
      // BYOK e o crédito não seria cobrado.
      // Chave passada pelo caller É do usuário por definição.
      let usedUserKey = isOverridden;
      if (!usedUserKey && p.supportsByok && p.getOwnKey && opts.userId) {
        try {
          usedUserKey = (await p.getOwnKey(opts.userId)) === key;
        } catch {
          /* na dúvida, cobra normal */
        }
      }
      // LEI: toda chamada a provedor pago grava um usage_record — inclusive a que
      // falhou, e inclusive a de um provider "grátis" (o tier grátis acaba).
      recordAiUsage(
        { ...meterCtx, apiKeySource: usedUserKey ? 'user' : 'system' },
        { inputTokens, outputTokens },
        'ok'
      );
      return {
        text,
        provider: p.id,
        model,
        usedUserKey,
        tokens,
        inputTokens,
        outputTokens,
      };
    } catch (err) {
      recordAiUsage(meterCtx, {}, 'error', (err as any)?.message || String(err));
      classifyAndCooldown(p, err);
      console.warn(`[cheapText] ${p.id} failed, cascading:`, (err as any)?.message || err);
      // continue to next provider
    }
  }

  const reason =
    configured === 0
      ? needsVision
        ? `no vision-capable provider configured (needs one of: ${VISION_PROVIDERS.join(', ')})`
        : 'no provider configured'
      : 'all providers failed/cooling-down';
  throw new Error(`cheaptext_unavailable: ${reason}`);
}

/**
 * Entrada legada — tier `cheap`. Mantida para os callers existentes
 * (`ai.ts` naming-briefing/insight, `brand-guidelines.ts`) seguirem intactos.
 */
export async function completeCheapText(opts: CheapTextOptions): Promise<CheapTextResult> {
  return completeText({ ...opts, tier: opts.tier ?? 'cheap' });
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
    env.OPENAI_API_KEY ||
    // `getOpenAiApiKey` também aceita OPENAI_KEY; sem isto uma instalação que só
    // tem esse nome se declara "sem provider" e o portão da rota fecha à toa.
    process.env.OPENAI_KEY
  );
}

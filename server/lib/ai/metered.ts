/**
 * Portão de contabilização de IA — LEI: toda chamada que gasta dinheiro grava um `usage_record`.
 *
 * Motivação (7/ago/2026): a fatura do Google trouxe R$ 443,68 num dia em que o app tinha
 * registrado US$ 4,82. O gasto existia em 22 arquivos que instanciavam o SDK por conta própria,
 * livres pra chamar e não contabilizar. Contexto: `.agent/plans/AI-SPEND-ACCOUNTING.md`.
 *
 * Este módulo é o ÚNICO lugar autorizado a instanciar cliente de provedor pago. Ele devolve um
 * cliente *proxied*: a contabilização acontece na chamada, não na disciplina de quem escreve.
 * Ninguém precisa lembrar de gravar nada.
 *
 *   const ai = meteredGemini({ apiKey, operation: 'brand-extract', userId, feature: 'branding' });
 *   const r = await ai.models.generateContent({ ... });   // <- já contabilizado
 *
 * Pra provedor que não tem SDK (REST direto: ideogram, reve, seedream, Veo long-running),
 * embrulhe a chamada em `meteredCall`.
 *
 * Regras:
 * - grava em sucesso E em erro — o provedor cobra a tentativa que falhou depois de gerar;
 * - custo sai de `src/utils/pricing.ts`. `cost: 0` só vale pra modelo grátis;
 * - gravar nunca derruba a chamada: falha de tracking é logada e contida.
 */

import { GoogleGenAI } from '@google/genai';
import { connectToMongoDB, getDb } from '../../db/mongodb.js';
import { computeCost, isFreeModel, type MeteredUsage } from './cost.js';
import type { FeatureType, GenerationSurface } from '../../utils/usageTracking.js';
import { aiCall } from '../ai-wrapper.js';

// Re-export: o custo é calculado em `ai/cost.ts` (fonte única, compartilhada com o caminho legado).
export { computeCost, type MeteredUsage };

export type MeteredProvider = 'gemini' | 'openai' | 'ideogram' | 'reve' | 'seedream';

export interface MeteredContext {
  provider: MeteredProvider;
  model: string;
  /** Nome curto do que está rodando, ex. 'brand-extract', 'mockup-generate'. */
  operation: string;
  userId?: string | null;
  feature?: FeatureType | string;
  surface?: GenerationSurface;
  apiKeySource?: 'user' | 'system';
  brandGuidelineId?: string | null;
  promptLength?: number;
  hasInputImage?: boolean;
  /** Medidas conhecidas antes da chamada (ex.: nº de imagens pedidas). */
  usage?: MeteredUsage;
  /** Chave do circuit breaker, quando o call site já usava uma própria (ex. 'openai-image'). */
  resilienceKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gravação
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grava o `usage_record`. Fire-and-forget e não-lançante por contrato: contabilizar não pode
 * derrubar a geração que o usuário pediu.
 */
export function recordAiUsage(
  ctx: MeteredContext,
  usage: MeteredUsage,
  outcome: 'ok' | 'error',
  errorMessage?: string
): void {
  void (async () => {
    try {
      const cost = computeCost(ctx.model, usage);

      if (cost === 0 && !isFreeModel(ctx.model) && outcome === 'ok') {
        // Não é fatal, mas é o sintoma exato do bug do Veo em dez/2025: gasto real gravado como 0.
        console.warn(
          `[ai-metering] custo 0 num modelo pago — ${ctx.provider}/${ctx.model} em ${ctx.operation}. ` +
            `Medidas: ${JSON.stringify(usage)}`
        );
      }

      await connectToMongoDB();
      await getDb()
        .collection('usage_records')
        .insertOne({
          userId: ctx.userId ?? null,
          imagesGenerated: usage.images ?? 0,
          videosGenerated: usage.videos ?? 0,
          videoSeconds: usage.videoSeconds ?? 0,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          hasInputImage: ctx.hasInputImage ?? false,
          promptLength: ctx.promptLength,
          model: ctx.model,
          provider: ctx.provider,
          operation: ctx.operation,
          cost,
          feature: ctx.feature ?? null,
          apiKeySource: ctx.apiKeySource ?? 'system',
          byok: ctx.apiKeySource === 'user',
          ...(ctx.brandGuidelineId ? { brandGuidelineId: ctx.brandGuidelineId } : {}),
          onBrand: !!ctx.brandGuidelineId,
          surface: ctx.surface ?? 'ui',
          outcome,
          ...(errorMessage ? { error: errorMessage.slice(0, 500) } : {}),
          timestamp: new Date(),
          createdAt: new Date(),
        });
    } catch (err) {
      console.error(`[ai-metering] falhou ao gravar ${ctx.operation}:`, err);
    }
  })();
}

// ─────────────────────────────────────────────────────────────────────────────
// Medição a partir da resposta
// ─────────────────────────────────────────────────────────────────────────────

/** Lê `usageMetadata` e as partes inline do retorno do Gemini. Ambos os SDKs caem aqui. */
export function measureGeminiResponse(result: unknown, declared?: MeteredUsage): MeteredUsage {
  const r = result as Record<string, any> | null | undefined;
  // @google/generative-ai devolve { response }, @google/genai devolve o objeto direto.
  const payload = r?.response ?? r;
  const meta = payload?.usageMetadata;

  const parts =
    payload?.candidates?.[0]?.content?.parts ?? payload?.candidates?.[0]?.content?.[0]?.parts ?? [];
  const inlineImages = Array.isArray(parts)
    ? parts.filter((p: any) => p?.inlineData?.data || p?.inline_data?.data).length
    : 0;

  return {
    ...declared,
    images: inlineImages || declared?.images,
    inputTokens: meta?.promptTokenCount ?? declared?.inputTokens,
    outputTokens:
      (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0) || declared?.outputTokens,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Portão genérico (REST, long-running, provedor sem SDK)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roda `fn` com resiliência + trace e contabiliza o resultado — inclusive quando dá erro.
 *
 * `measure` traduz a resposta em medidas. Sem ele, valem as medidas declaradas em `ctx.usage`.
 */
export async function meteredCall<T>(
  ctx: MeteredContext,
  fn: () => Promise<T>,
  measure?: (result: T) => MeteredUsage
): Promise<T> {
  const resilienceProvider = (ctx.resilienceKey ??
    (ctx.provider === 'gemini' || ctx.provider === 'openai'
      ? ctx.provider
      : 'gemini')) as Parameters<typeof aiCall>[0];

  try {
    const { result } = await aiCall(resilienceProvider, fn, {
      metadata: { operation: ctx.operation, model: ctx.model },
    });
    recordAiUsage(ctx, measure ? measure(result) : (ctx.usage ?? {}), 'ok');
    return result;
  } catch (error) {
    // A tentativa que falhou depois de gerar também é cobrada pelo provedor.
    recordAiUsage(
      ctx,
      ctx.usage ?? {},
      'error',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * Contabiliza uma promessa já em voo — útil pra call site que já tem a própria resiliência
 * e não quer inverter o bloco: `return meterResult(ctx, withResilience('x', async () => {...}))`.
 */
export async function meterResult<T>(
  ctx: MeteredContext,
  promise: Promise<T>,
  measure?: (result: T) => MeteredUsage
): Promise<T> {
  try {
    const result = await promise;
    recordAiUsage(ctx, measure ? measure(result) : (ctx.usage ?? {}), 'ok');
    return result;
  } catch (error) {
    recordAiUsage(
      ctx,
      ctx.usage ?? {},
      'error',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cliente Gemini contabilizado
// ─────────────────────────────────────────────────────────────────────────────

type GeminiCtx = Omit<MeteredContext, 'provider' | 'model'> & {
  apiKey: string;
  /** Modelo default, quando a chamada não informa o seu. */
  model?: string;
};

/**
 * `GoogleGenAI` com `models.generateContent` / `generateContentStream` / `generateVideos`
 * contabilizados. A assinatura é a do SDK — troque `new GoogleGenAI({apiKey})` por isto e pronto.
 */
export function meteredGemini(ctx: GeminiCtx): GoogleGenAI {
  const client = new GoogleGenAI({ apiKey: ctx.apiKey });

  /** Métodos do SDK que gastam dinheiro. Tudo aqui é contabilizado. */
  const BILLABLE = [
    'generateContent',
    'generateContentStream',
    'generateVideos',
    'generateImages',
    'editImage',
    'embedContent',
  ];

  const wrapModels = (models: any) =>
    new Proxy(models, {
      get(target, prop: string) {
        const original = target[prop];
        if (typeof original !== 'function' || !BILLABLE.includes(prop)) {
          return typeof original === 'function' ? original.bind(target) : original;
        }

        return async (...args: any[]) => {
          const req = args[0] ?? {};
          const model = req.model ?? ctx.model ?? 'unknown';
          const kind =
            prop === 'generateVideos'
              ? 'video'
              : prop === 'generateImages' || prop === 'editImage'
                ? 'image'
                : 'content';

          // Imagen declara quantas imagens quer; o custo é conhecido antes da resposta.
          const declared: MeteredUsage =
            kind === 'video'
              ? { videos: 1, videoSeconds: req.config?.numberOfSeconds, ...ctx.usage }
              : kind === 'image'
                ? {
                    images: req.config?.numberOfImages ?? 1,
                    resolution: req.config?.aspectRatio,
                    ...ctx.usage,
                  }
                : (ctx.usage ?? {});

          // `meterResult`, não `meteredCall`: o portão contabiliza, e só. Injetar circuit
          // breaker aqui mudaria o comportamento de falha de todo call site que trocou o
          // `new GoogleGenAI` por este cliente — a LEI é sobre conta, não sobre resiliência.
          return meterResult(
            { ...ctx, provider: 'gemini', model, operation: ctx.operation, usage: declared },
            original.apply(target, args),
            (result) => (kind === 'content' ? measureGeminiResponse(result, ctx.usage) : declared)
          );
        };
      },
    });

  return new Proxy(client, {
    get(target, prop: string) {
      if (prop === 'models') return wrapModels((target as any).models);
      const value = (target as any)[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as GoogleGenAI;
}

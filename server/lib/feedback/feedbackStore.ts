/**
 * feedbackStore — camada única pra persistir feedback de geração.
 *
 * Responsabilidades:
 *  1. Gravar TODO feedback (up ou down) no Mongo (`generation_feedback`)
 *     como audit log universal.
 *  2. Se `rating === 'up'`, gerar embedding do contexto e fazer upsert no
 *     Pinecone (namespace por feature) pra virar exemplo no RAG de geração.
 *  3. Degradar graciosamente se Pinecone não estiver configurado (só Mongo).
 *
 * Qualquer rota de geração usa `feedbackStore.record()` — ninguém toca
 * Mongo/Pinecone direto. Isso é a abstração que torna o feedback universal.
 */

import { connectToMongoDB, getDb } from '../../db/mongodb.js';
import { vectorService } from '../../services/vectorService.js';
import { getMultimodalEmbedding } from '../../services/geminiService.js';
import type {
  GenerationFeedback,
  FeedbackFeature,
  FeedbackContext,
} from './types.js';

const COLLECTION = 'generation_feedback';

/** Namespace Pinecone por feature — mantém retrieval isolado por domínio. */
const pineconeNamespace = (feature: FeedbackFeature): string =>
  `${feature}-examples`;

/**
 * Monta o texto canônico que vira embedding. Inclui brand brief, tags,
 * prompt e rationale — tudo que ajuda a achar geração similar depois.
 */
function buildEmbeddingText(ctx: FeedbackContext): string {
  const parts: string[] = [];
  if (ctx.brandBrief) parts.push(`BRAND: ${ctx.brandBrief}`);
  if (ctx.designType) parts.push(`TYPE: ${ctx.designType}`);
  if (ctx.vibeId) parts.push(`VIBE: ${ctx.vibeId}`);
  if (ctx.tags) {
    const tagLine = Object.entries(ctx.tags)
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([k, v]) => `${k}=[${(v as string[]).join(', ')}]`)
      .join(' ');
    if (tagLine) parts.push(`TAGS: ${tagLine}`);
  }
  if (ctx.prompt) parts.push(`PROMPT: ${ctx.prompt}`);
  return parts.join('\n');
}

/**
 * Serializa context pra metadata Pinecone — aceita só strings/numbers/bools/
 * arrays de strings. Aninhados viram JSON.
 */
function buildPineconeMetadata(
  feedback: GenerationFeedback,
): Record<string, any> {
  const { context } = feedback;
  return {
    generationId: feedback.generationId,
    userId: feedback.userId,
    feature: feedback.feature,
    rating: feedback.rating,
    brandGuidelineId: context.brandGuidelineId ?? '',
    vibeId: context.vibeId ?? '',
    designType: context.designType ?? '',
    aspectRatio: context.aspectRatio ?? '',
    model: context.model ?? '',
    imageUrl: context.imageUrl ?? '',
    prompt: (context.prompt ?? '').slice(0, 1500),
    brandBrief: (context.brandBrief ?? '').slice(0, 800),
    // Arrays planas
    brandingTags: context.tags?.branding ?? [],
    categoryTags: context.tags?.category ?? [],
    locationTags: context.tags?.location ?? [],
    createdAt: feedback.createdAt.toISOString(),
  };
}

export const feedbackStore = {
  /**
   * Persiste um feedback completo.
   *
   * - Sempre grava no Mongo (audit universal).
   * - Se rating=up, tenta vetorizar e upsertar no Pinecone.
   * - Pinecone upsert roda fire-and-forget: falha NÃO quebra o request.
   */
  async record(feedback: GenerationFeedback): Promise<{ persisted: boolean; vectorized: boolean }> {
    await connectToMongoDB();
    const db = getDb();

    // 1. Mongo write (autoridade)
    await db.collection(COLLECTION).insertOne({
      ...feedback,
      createdAt: feedback.createdAt,
    });

    let vectorized = false;

    // 2. Pinecone upsert só pra thumbs up
    if (feedback.rating === 'up') {
      try {
        const text = buildEmbeddingText(feedback.context);
        if (text.trim().length === 0) {
          return { persisted: true, vectorized: false };
        }

        // Parts multimodal: texto sempre, imagem se houver URL acessível
        const parts: any[] = [{ text }];
        // NB: imagem exige fetch + base64; mantemos só texto por ora pra
        // não adicionar latência / ponto de falha. Imagem entra no próximo loop.

        const { embedding } = await getMultimodalEmbedding(parts);
        const metadata = buildPineconeMetadata(feedback);

        // Namespaced id — permite filtrar fácil depois.
        const id = `${feedback.feature}:${feedback.generationId}`;
        await vectorService.upsert(id, embedding, {
          ...metadata,
          namespace: pineconeNamespace(feedback.feature),
        });
        vectorized = true;
      } catch (err) {
        // Degrade gracefully — Mongo já tem o registro.
        console.warn('[feedbackStore] vectorization failed, mongo-only:', err);
      }
    }

    return { persisted: true, vectorized };
  },

  /**
   * Lista feedback recente de um user (Mongo, ordenado por data desc).
   * Útil pra debug, admin dashboard e futuros "undo" handlers.
   */
  async listRecent(
    userId: string,
    feature?: FeedbackFeature,
    limit = 20,
  ): Promise<GenerationFeedback[]> {
    await connectToMongoDB();
    const db = getDb();
    const query: any = { userId };
    if (feature) query.feature = feature;
    const docs = await db
      .collection(COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return docs as unknown as GenerationFeedback[];
  },

  /**
   * Remove um feedback (soft — também remove o vetor do Pinecone se houver).
   * Usado pelo botão "undo" do thumb.
   */
  async remove(generationId: string, userId: string): Promise<boolean> {
    await connectToMongoDB();
    const db = getDb();

    const doc = await db
      .collection(COLLECTION)
      .findOne({ generationId, userId });
    if (!doc) return false;

    await db.collection(COLLECTION).deleteOne({ generationId, userId });

    if (doc.rating === 'up') {
      try {
        await vectorService.delete(`${doc.feature}:${generationId}`);
      } catch (err) {
        console.warn('[feedbackStore] pinecone delete failed:', err);
      }
    }
    return true;
  },
};

export { pineconeNamespace };

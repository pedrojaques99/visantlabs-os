/**
 * exampleRetriever — busca exemplos similares via Pinecone pra injetar
 * como few-shot no prompt antes da geração.
 *
 * Esse é o "loop de aprendizado" que torna o app cada vez mais certeiro:
 *  1. User gera + dá 👍 → feedbackStore vetoriza e upsertea no Pinecone.
 *  2. Próxima geração consulta Pinecone com embedding do contexto atual.
 *  3. Top-K exemplos viram bloco "LEARNED EXAMPLES" no template.
 *  4. Gemini vê padrões que já funcionaram pra essa marca/user/feature.
 *
 * Função é universal — qualquer feature passa seu `feature` e `queryText`,
 * retrieval funciona por namespace dedicado.
 *
 * Degrada gracefully: se Pinecone offline ou vazio, retorna [] e a geração
 * segue sem RAG.
 */

import { vectorService } from '../../services/vectorService.js';
import { getMultimodalEmbedding } from '../../services/geminiService.js';
import type { FeedbackFeature } from '../feedback/types.js';
import { pineconeNamespace } from '../feedback/feedbackStore.js';

export interface SimilarExample {
  score: number;
  prompt: string;
  brandBrief?: string;
  brandGuidelineId?: string;
  vibeId?: string;
  imageUrl?: string;
  tags?: string[];
}

interface FindSimilarParams {
  feature: FeedbackFeature;
  /** Texto canônico da geração atual — brand brief + tags + user intent. */
  queryText: string;
  /** Filtros hard: userId, brandGuidelineId, designType... */
  filter?: Record<string, any>;
  /** Quantos exemplos retornar (default 3 — mais que isso satura o prompt). */
  topK?: number;
}

export const exampleRetriever = {
  /**
   * Busca exemplos positivos similares. Sempre retorna array — nunca joga.
   */
  async findSimilar({
    feature,
    queryText,
    filter,
    topK = 3,
  }: FindSimilarParams): Promise<SimilarExample[]> {
    const trimmed = (queryText || '').trim();
    if (trimmed.length === 0) return [];

    try {
      const { embedding } = await getMultimodalEmbedding([{ text: trimmed }]);

      // Filtro base: só vetores da feature correta (namespace) e com rating up.
      const mergedFilter = {
        namespace: pineconeNamespace(feature),
        rating: 'up',
        feature,
        ...(filter || {}),
      };

      const matches = await vectorService.query(embedding, topK, mergedFilter);

      return (matches || [])
        .filter((m: any) => m?.metadata)
        .map((m: any): SimilarExample => ({
          score: m.score ?? 0,
          prompt: m.metadata.prompt ?? '',
          brandBrief: m.metadata.brandBrief ?? undefined,
          brandGuidelineId: m.metadata.brandGuidelineId ?? undefined,
          vibeId: m.metadata.vibeId ?? undefined,
          imageUrl: m.metadata.imageUrl ?? undefined,
          tags: (m.metadata.brandingTags ?? []) as string[],
        }));
    } catch (err) {
      // Degradação graciosa — geração segue sem RAG.
      console.warn('[exampleRetriever] findSimilar failed, degrading:', err);
      return [];
    }
  },

  /**
   * Formata exemplos como bloco few-shot pronto pra colar no template Gemini.
   * Bounded: máx 3 exemplos, cada um ≤ 240 chars de prompt.
   */
  formatAsFewShot(examples: SimilarExample[]): string {
    if (!examples.length) return '';
    const bullets = examples.slice(0, 3).map((ex, i) => {
      const prompt = (ex.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 240);
      const brand = ex.brandBrief ? ` [brand: ${ex.brandBrief.slice(0, 80)}]` : '';
      return `  ${i + 1}. (score ${ex.score.toFixed(2)})${brand}\n     → ${prompt}`;
    });
    return bullets.join('\n');
  },
};

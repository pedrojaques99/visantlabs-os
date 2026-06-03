/**
 * referenceEnricher — injeta referências curadas no prompt de qualquer rota de geração.
 *
 * Função pura: recebe prompt, retorna prompt enriquecido.
 * Reusa exampleRetriever (mesmo que generateSmartPrompt usa).
 * Degrada graciosamente — se Pinecone offline, retorna prompt original.
 */

import { exampleRetriever } from './exampleRetriever.js';
import type { FeedbackFeature } from '../feedback/types.js';

export interface EnrichResult {
  prompt: string;
  refsInjected: number;
}

export async function enrichWithCuratedReferences(
  prompt: string,
  queryContext?: string,
  topK = 2
): Promise<EnrichResult> {
  try {
    const queryText = queryContext || prompt.slice(0, 500);

    const refs = await exampleRetriever.findSimilar({
      feature: 'reference' as FeedbackFeature,
      queryText,
      topK,
    });

    if (refs.length === 0) return { prompt, refsInjected: 0 };

    const block = exampleRetriever.formatAsFewShot(refs);
    const enriched = `${prompt}\n\n--- CURATED REFERENCES (world-class mockup techniques — absorb lighting, composition, texture, DO NOT copy verbatim) ---\n${block}`;

    return { prompt: enriched, refsInjected: refs.length };
  } catch {
    return { prompt, refsInjected: 0 };
  }
}

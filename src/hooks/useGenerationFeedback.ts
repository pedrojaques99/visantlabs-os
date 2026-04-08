/**
 * useGenerationFeedback — hook universal pra wire de botões 👍/👎 em
 * QUALQUER tela de geração (mockup, canvas, creative, etc).
 *
 * Uso típico em um card de resultado:
 *
 *   const { rating, submit, reset, isLoading } = useGenerationFeedback({
 *     generationId: result.generationId,
 *     feature: 'mockup',
 *     context: { prompt, imageUrl, tags, brandGuidelineId, brandBrief },
 *   });
 *
 *   <button onClick={() => submit('up')} aria-pressed={rating === 'up'}>
 *     <ThumbsUp />
 *   </button>
 *   <button onClick={() => submit('down')} aria-pressed={rating === 'down'}>
 *     <ThumbsDown />
 *   </button>
 *
 * Estado otimista: marca visualmente antes do server responder. Em erro,
 * reverte e mostra toast (se `sonner` estiver disponível).
 */

import { useCallback, useState } from 'react';
import { feedbackApi, type FeedbackContext, type FeedbackFeature, type FeedbackRating } from '../services/feedbackApi';

export interface UseGenerationFeedbackParams {
  /** UUID da geração — vem do response de generateSmartPrompt ou equivalente. */
  generationId: string | null | undefined;
  feature: FeedbackFeature;
  /** Contexto que será anexado ao feedback. Pode ser factory pra capturar state atual. */
  context: FeedbackContext | (() => FeedbackContext);
  /** Callback opcional após persistência bem-sucedida. */
  onPersisted?: (rating: FeedbackRating) => void;
}

export interface UseGenerationFeedbackReturn {
  rating: FeedbackRating | null;
  isLoading: boolean;
  submit: (rating: FeedbackRating, reason?: string) => Promise<void>;
  reset: () => Promise<void>;
}

const resolveContext = (
  ctx: FeedbackContext | (() => FeedbackContext),
): FeedbackContext => (typeof ctx === 'function' ? ctx() : ctx);

export function useGenerationFeedback(
  params: UseGenerationFeedbackParams,
): UseGenerationFeedbackReturn {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submit = useCallback(
    async (nextRating: FeedbackRating, reason?: string) => {
      if (!params.generationId) {
        console.warn('[useGenerationFeedback] no generationId yet — ignoring click');
        return;
      }

      // Toggle: clicar no mesmo thumb de novo = remover.
      if (rating === nextRating) {
        return reset();
      }

      const previous = rating;
      setRating(nextRating); // optimistic
      setIsLoading(true);

      try {
        const result = await feedbackApi.submit({
          generationId: params.generationId,
          feature: params.feature,
          rating: nextRating,
          reason,
          context: resolveContext(params.context),
        });

        if (!result.success) {
          setRating(previous);
        } else {
          params.onPersisted?.(nextRating);
        }
      } catch (err) {
        console.warn('[useGenerationFeedback] submit failed:', err);
        setRating(previous);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rating, params.generationId, params.feature],
  );

  const reset = useCallback(async () => {
    if (!params.generationId) return;
    const previous = rating;
    setRating(null); // optimistic
    setIsLoading(true);
    try {
      const res = await feedbackApi.remove(params.generationId);
      if (!res.success) setRating(previous);
    } catch {
      setRating(previous);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating, params.generationId]);

  return { rating, isLoading, submit, reset };
}

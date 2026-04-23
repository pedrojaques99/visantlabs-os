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
 * Estado otimista: marca visualmente antes do server responder. Em sucesso
 * ou erro, dispara toast via sonner. Suporta modo controlled (parent owns
 * state via `controlledRating` + `onRatingChange`) para sync cross-view.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { feedbackApi, type FeedbackContext, type FeedbackFeature, type FeedbackRating } from '../services/feedbackApi';

export interface UseGenerationFeedbackParams {
  /** UUID da geração — vem do response de generateSmartPrompt ou equivalente. */
  generationId: string | null | undefined;
  feature: FeedbackFeature;
  /** Contexto que será anexado ao feedback. Pode ser factory pra capturar state atual. */
  context: FeedbackContext | (() => FeedbackContext);
  /** Callback opcional após persistência bem-sucedida. */
  onPersisted?: (rating: FeedbackRating) => void;
  /** Controlled rating — single source of truth from parent. */
  controlledRating?: FeedbackRating | null;
  /** Called when rating changes (for lifting state up). */
  onRatingChange?: (rating: FeedbackRating | null) => void;
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
  const isControlled = params.controlledRating !== undefined;
  const [internalRating, setInternalRating] = useState<FeedbackRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Controlled mode: parent owns the state. Uncontrolled: local state.
  const rating = isControlled ? (params.controlledRating ?? null) : internalRating;

  const updateRating = useCallback((next: FeedbackRating | null) => {
    if (isControlled) {
      params.onRatingChange?.(next);
    } else {
      setInternalRating(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, params.onRatingChange]);

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
      updateRating(nextRating); // optimistic
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
          updateRating(previous);
          toast.error('Failed to send feedback', { duration: 2000 });
        } else {
          toast.success(nextRating === 'up' ? 'Thanks for the feedback! 👍' : 'Thanks for the feedback! 👎', { duration: 2000 });
          params.onPersisted?.(nextRating);
        }
      } catch (err) {
        console.warn('[useGenerationFeedback] submit failed:', err);
        updateRating(previous);
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rating, params.generationId, params.feature, updateRating],
  );

  const reset = useCallback(async () => {
    if (!params.generationId) return;
    const previous = rating;
    updateRating(null); // optimistic
    setIsLoading(true);
    try {
      const res = await feedbackApi.remove(params.generationId);
      if (!res.success) {
        updateRating(previous);
      } else {
        toast.success('Feedback removed', { duration: 2000 });
      }
    } catch {
      updateRating(previous);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating, params.generationId, updateRating]);

  return { rating, isLoading, submit, reset };
}

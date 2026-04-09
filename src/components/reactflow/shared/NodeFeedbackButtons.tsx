import React from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeButton } from './node-button';
import { useGenerationFeedback } from '@/hooks/useGenerationFeedback';
import type { FeedbackContext, FeedbackFeature, FeedbackRating } from '@/services/feedbackApi';

interface NodeFeedbackButtonsProps {
  /** UUID da geração — sem isso, os botões ficam disabled. */
  generationId?: string | null;
  /** Feature tag pro backend de feedback. */
  feature: FeedbackFeature;
  /** Contexto adicional (prompt, imageUrl, tags...). */
  context?: FeedbackContext | (() => FeedbackContext);
  /** Rating persistido no node data (source of truth). */
  rating?: FeedbackRating | null;
  /** Called to persist rating change in node data. */
  onRatingChange: (rating: FeedbackRating | null) => void;
}

/**
 * Thumbs up/down buttons pro RAG loop. Controlled pelo `nodeData` do
 * node — o rating persiste via `onUpdateData` e volta sincronizado na
 * próxima sessão via canvas save (single source of truth no servidor).
 */
export const NodeFeedbackButtons: React.FC<NodeFeedbackButtonsProps> = ({
  generationId,
  feature,
  context,
  rating,
  onRatingChange,
}) => {
  const feedback = useGenerationFeedback({
    generationId,
    feature,
    context: context ?? {},
    controlledRating: rating ?? null,
    onRatingChange,
  });

  const disabled = !generationId || feedback.isLoading;

  return (
    <div className="flex items-center gap-0.5 rounded-md bg-neutral-900/50 border border-neutral-700/30 backdrop-blur-sm p-0.5 nodrag nopan">
      <NodeButton
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); feedback.submit('up'); }}
        onMouseDown={(e) => e.stopPropagation()}
        title={generationId ? (feedback.rating === 'up' ? 'Remover feedback' : 'Valeu! (Melhora o modelo)') : 'Sem generationId'}
        className={cn(
          'transition-colors',
          feedback.rating === 'up' && '!text-green-400 !bg-green-400/10',
        )}
      >
        <ThumbsUp size={12} className={cn(feedback.rating === 'up' && 'fill-current')} />
      </NodeButton>
      <NodeButton
        variant="ghost"
        size="xs"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); feedback.submit('down'); }}
        onMouseDown={(e) => e.stopPropagation()}
        title={generationId ? (feedback.rating === 'down' ? 'Remover feedback' : 'Ruim (Reportar)') : 'Sem generationId'}
        className={cn(
          'transition-colors',
          feedback.rating === 'down' && '!text-red-400 !bg-red-400/10',
        )}
      >
        <ThumbsDown size={12} className={cn(feedback.rating === 'down' && 'fill-current')} />
      </NodeButton>
    </div>
  );
};

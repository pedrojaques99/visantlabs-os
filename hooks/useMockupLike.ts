import { useCallback } from 'react';
import { toast } from 'sonner';
import { mockupApi } from '../services/mockupApi';
import { useTranslation } from './useTranslation';

interface UseMockupLikeOptions {
  mockupId: string | null | undefined;
  isLiked: boolean;
  onLikeStateChange?: (newIsLiked: boolean) => void;
  translationKeyPrefix?: string;
}

export const useMockupLike = ({
  mockupId,
  isLiked,
  onLikeStateChange,
  translationKeyPrefix = 'canvasNodes.imageNode',
}: UseMockupLikeOptions) => {
  const { t } = useTranslation();

  const toggleLike = useCallback(async () => {
    // Check if mockupId is a valid MongoDB ObjectId (24 hex characters)
    const isValidObjectId = mockupId && /^[0-9a-fA-F]{24}$/.test(mockupId);
    const newLikedState = !isLiked;

    // Update local state immediately for responsive UI
    if (onLikeStateChange) {
      onLikeStateChange(newLikedState);
    }

    if (!mockupId || !isValidObjectId) {
      // If not saved yet or has temporary ID, just update local state - will be saved with like status when saved
      return;
    }

    // Update in backend only if we have a valid ObjectId
    try {
      console.log(`[Like] Updating like status for mockup ${mockupId}: isLiked=${newLikedState}`);
      await mockupApi.update(mockupId, { isLiked: newLikedState });
      console.log(`[Like] Successfully updated like status for mockup ${mockupId}`);
      
      const addKey = translationKeyPrefix === 'canvasNodes.imageNode' 
        ? 'canvasNodes.imageNode.addToFavorites'
        : 'canvas.addedToFavorites';
      const removeKey = translationKeyPrefix === 'canvasNodes.imageNode'
        ? 'canvasNodes.imageNode.removeFromFavorites'
        : 'canvas.removedFromFavorites';
      
      toast.success(newLikedState ? t(addKey) : t(removeKey), { duration: 2000 });
    } catch (error: any) {
      console.error('[Like] Failed to update like status:', {
        mockupId,
        isLiked: newLikedState,
        error: error?.message || error,
        stack: error?.stack,
      });
      
      // Revert local state on error
      if (onLikeStateChange) {
        onLikeStateChange(isLiked);
      }
      
      const errorKey = translationKeyPrefix === 'canvasNodes.imageNode'
        ? 'canvasNodes.imageNode.failedToUpdateLikeStatus'
        : 'canvasNodes.outputNode.failedToUpdateLikeStatus';
      
      toast.error(t(errorKey), { duration: 3000 });
    }
  }, [mockupId, isLiked, onLikeStateChange, translationKeyPrefix, t]);

  return { toggleLike, isLiked };
};


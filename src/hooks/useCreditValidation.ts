import { useCallback, useMemo } from 'react';
import { useLayout } from './useLayout';
import { getCreditsRequired } from '@/utils/creditCalculator';
import { toast } from 'sonner';
import { useTranslation } from './useTranslation';
import { isLocalDevelopment } from '@/utils/env';
import type { GeminiModel, Resolution } from '@/types/types';

/**
 * Hook that provides credit validation functions
 * Unifies hasEnoughCredits (sync) and validateAuthAndSubscription (async) logic
 * 
 * @param mockupCount - Number of mockups to generate (for batch operations)
 * @param onCreditPackagesModalOpen - Callback to open credit packages modal
 * 
 * @returns Object with:
 *   - hasEnoughCredits(creditsNeeded): boolean - Synchronous check
 *   - validateCredits(options): Promise<boolean> - Async validation with toasts
 * 
 * @example
 * const { hasEnoughCredits, validateCredits } = useCreditValidation(2, onCreditPackagesModalOpen);
 * 
 * // Sync check
 * if (!hasEnoughCredits(5)) return;
 * 
 * // Async validation
 * if (!(await validateCredits({ model: 'gemini-3-pro-image-preview', resolution: '4K' }))) return;
 */
export const useCreditValidation = (
  mockupCount: number = 1,
  onCreditPackagesModalOpen?: () => void
) => {
  const { subscriptionStatus, isAuthenticated } = useLayout();
  const { t } = useTranslation();

  /**
   * Synchronous check if user has enough credits
   * Does not show toasts or open modals
   */
  const hasEnoughCredits = useCallback((creditsNeeded: number): boolean => {
    // In local development, always allow operations
    if (isLocalDevelopment()) {
      return true;
    }

    // If no subscription status available, consider as no credits
    if (!subscriptionStatus) {
      return false;
    }

    // Check if user has enough credits
    const totalCredits = subscriptionStatus.totalCredits || 0;

    // Block if user has 0 credits available
    if (totalCredits === 0) {
      return false;
    }

    return totalCredits >= creditsNeeded;
  }, [subscriptionStatus]);

  /**
   * Async validation with authentication check and credit validation
   * Shows toasts and opens modals on error
   */
  const validateCredits = useCallback(async (
    options?: {
      creditsNeeded?: number;
      model?: GeminiModel | null;
      resolution?: Resolution;
    }
  ): Promise<boolean> => {
    const { creditsNeeded, model, resolution } = options || {};
    
    // Calculate credits needed
    let actualCreditsNeeded = creditsNeeded;
    if (actualCreditsNeeded === undefined && model) {
      const creditsPerImage = getCreditsRequired(model, resolution);
      actualCreditsNeeded = mockupCount * creditsPerImage;
    } else if (actualCreditsNeeded === undefined) {
      actualCreditsNeeded = 1;
    }

    // Skip validation in local development
    if (isLocalDevelopment()) {
      return true;
    }

    // Check authentication
    if (isAuthenticated !== true) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return false;
    }

    // Check credits
    if (subscriptionStatus) {
      // totalCredits already includes both earned credits (purchased) and monthly credits remaining
      // So we should use it directly for both subscribed and free users
      const totalCredits = subscriptionStatus.totalCredits || 0;
      const remaining = totalCredits;

      // Only show error if user has no credits available
      if (remaining < actualCreditsNeeded) {
        const resetDate = subscriptionStatus.creditsResetDate 
          ? new Date(subscriptionStatus.creditsResetDate).toLocaleDateString() 
          : t('messages.yourNextBillingCycle');
        
        const message = subscriptionStatus.hasActiveSubscription
          ? t('messages.needCreditsSubscription', {
            creditsNeeded: actualCreditsNeeded,
            plural: actualCreditsNeeded > 1 ? 's' : '',
            remaining,
            pluralRemaining: remaining > 1 ? 's' : '',
            resetDate
          })
          : t('messages.needCreditsButHave', {
            creditsNeeded: actualCreditsNeeded,
            plural: actualCreditsNeeded > 1 ? 's' : '',
            remaining,
            pluralRemaining: remaining > 1 ? 's' : ''
          });

        toast.error(message, { duration: 5000 });
        // Open credit packages modal first (default for users without credits)
        onCreditPackagesModalOpen?.();
        return false;
      }
    } else {
      // If no subscription status available, assume user has no credits
      toast.error(t('messages.needCredits', { 
        creditsNeeded: actualCreditsNeeded, 
        plural: actualCreditsNeeded > 1 ? 's' : '' 
      }), { duration: 5000 });
      // Open credit packages modal first (default for users without credits)
      onCreditPackagesModalOpen?.();
      return false;
    }

    return true;
  }, [subscriptionStatus, mockupCount, isAuthenticated, t, onCreditPackagesModalOpen]);

  return {
    hasEnoughCredits,
    validateCredits,
  };
};

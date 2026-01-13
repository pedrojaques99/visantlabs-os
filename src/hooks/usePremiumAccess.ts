import { useState, useEffect } from 'react';
import { useLayout } from './useLayout';
import { authService } from '../services/authService';

export interface PremiumAccessResult {
  hasAccess: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if user has premium access
 * Returns hasAccess: true if user is admin (including free admins), has active subscription, or is a tester
 * 
 * IMPORTANT: Admin users and testers have access regardless of their subscription status (free, premium, etc.)
 * This means admin users or testers with subscriptionStatus = 'free' will still have access.
 */
export const usePremiumAccess = (): PremiumAccessResult => {
  const { isAuthenticated, isCheckingAuth, subscriptionStatus } = useLayout();
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAccess = async () => {
      // If still checking auth, wait
      if (isCheckingAuth || isAuthenticated === null) {
        setIsLoading(true);
        return;
      }

      // If not authenticated, no access
      if (isAuthenticated === false) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      // User is authenticated, check admin status, subscription, and tester category
      try {
        const user = await authService.verifyToken();
        // Check admin status first - admins have access regardless of subscription status
        const isAdmin = user?.isAdmin === true;
        // Check if user is a tester
        const isTester = user?.userCategory === 'tester';
        // Check if user has active subscription (for non-admin, non-tester users)
        const hasActiveSubscription = subscriptionStatus?.hasActiveSubscription || false;

        // Admin users (including free admins), testers, OR users with active subscription have access
        setHasAccess(isAdmin || isTester || hasActiveSubscription);
      } catch (error) {
        console.error('Error checking premium access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [isAuthenticated, isCheckingAuth, subscriptionStatus]);

  return { hasAccess, isLoading };
};






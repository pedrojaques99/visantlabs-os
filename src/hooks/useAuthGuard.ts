import { useCallback } from 'react';
import { useLayout } from './useLayout';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { useTranslation } from './useTranslation';

/**
 * Hook that provides authentication guard function
 * Encapsulates the common pattern of checking authentication before operations
 * 
 * @returns Object with requireAuth function that returns Promise<boolean>
 *          - Returns true if user is authenticated
 *          - Returns false and shows error toast if not authenticated
 * 
 * @example
 * const { requireAuth } = useAuthGuard();
 * 
 * const handleOperation = async () => {
 *   if (!(await requireAuth())) return;
 *   // Proceed with operation...
 * }
 */
export const useAuthGuard = () => {
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const { t } = useTranslation();

  const requireAuth = useCallback(async (): Promise<boolean> => {
    // Check authentication using context state first
    if (isAuthenticated === false) {
      toast.error(t('messages.authenticationRequired'), { duration: 5000 });
      return false;
    }

    // If still checking auth, verify with cache
    if (isAuthenticated === null || isCheckingAuth) {
      try {
        const user = await authService.verifyToken(); // Use verifyToken with cache
        if (!user) {
          toast.error(t('messages.authenticationRequired'), { duration: 5000 });
          return false;
        }
      } catch (error) {
        toast.error(t('messages.authenticationError'), { duration: 5000 });
        return false;
      }
    }

    // isAuthenticated === true, safe to proceed
    return true;
  }, [isAuthenticated, isCheckingAuth, t]);

  return { requireAuth };
};

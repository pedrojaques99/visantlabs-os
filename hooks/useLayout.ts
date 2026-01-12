import { useContext } from 'react';
import { LayoutContext, type LayoutContextValue } from '../components/Layout';

// Default fallback values when context is not available
const defaultContextValue: LayoutContextValue = {
  subscriptionStatus: null,
  isAuthenticated: null,
  isCheckingAuth: true,
  onSubscriptionModalOpen: () => {
    console.warn('onSubscriptionModalOpen called but Layout context is not available');
  },
  onCreditPackagesModalOpen: () => {
    console.warn('onCreditPackagesModalOpen called but Layout context is not available');
  },
  setSubscriptionStatus: () => {
    console.warn('setSubscriptionStatus called but Layout context is not available');
  },
  registerUnsavedOutputsHandler: () => {
    console.warn('registerUnsavedOutputsHandler called but Layout context is not available');
  },
  registerResetHandler: () => {
    console.warn('registerResetHandler called but Layout context is not available');
  },
};

export const useLayout = (): LayoutContextValue => {
  const context = useContext(LayoutContext);
  if (!context) {
    console.warn('useLayout called outside Layout component, using default values');
    return defaultContextValue;
  }
  return context;
};


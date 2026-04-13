import { useCallback } from 'react';
import { useFigmaMessages } from './useFigmaMessages';
import { usePluginStore } from '../store';

export function useBrandIntelligence() {
  const { send } = useFigmaMessages();
  const store = usePluginStore();

  const syncFromFigma = useCallback(async () => {
    try {
      store.showToast('Scanning design for brand elements...', 'info');
      send({
        type: 'SYNC_BRAND_INTELLIGENCE'
      } as any);
    } catch (err) {
      console.error('Failed to sync brand intelligence:', err);
      store.showToast('Failed to scan brand elements', 'error');
    }
  }, [send, store]);

  return { syncFromFigma };
}

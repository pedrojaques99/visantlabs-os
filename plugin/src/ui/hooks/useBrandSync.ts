import { useCallback } from 'react';
import { useApi } from './useApi';
import { usePluginStore } from '../store';
import type { BrandGuideline } from '@/lib/figma-types';

export function useBrandSync() {
  const { call } = useApi();
  const { authToken } = usePluginStore();
  const store = usePluginStore();

  const saveBrandGuideline = useCallback(
    async (guideline: BrandGuideline) => {
      try {
        const response = await call('/api/brand-guidelines', {
          method: 'POST',
          body: JSON.stringify(guideline)
        });
        if (response?.id) {
          store.setBrandGuideline(response);
          store.showToast('Brand guideline saved', 'success');
          return response;
        }
      } catch (err) {
        console.error('Failed to save brand guideline:', err);
        store.showToast('Failed to save brand guideline', 'error');
      }
    },
    [call, store]
  );

  const loadBrandGuidelines = useCallback(async () => {
    try {
      const response = await call('/api/brand-guidelines');
      if (Array.isArray(response)) {
        usePluginStore.setState({ savedGuidelineIds: response.map((g: any) => g.id) });
        return response;
      }
    } catch (err) {
      console.error('Failed to load brand guidelines:', err);
    }
  }, [call]);

  return { saveBrandGuideline, loadBrandGuidelines };
}

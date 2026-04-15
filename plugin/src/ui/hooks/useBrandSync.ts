import { useCallback } from 'react';
import { useApi } from './useApi';
import { usePluginStore } from '../store';
import type { BrandGuideline } from '@/lib/figma-types';
import {
  parseBrandGuidelineList,
  unwrapGuidelineResponse,
  BrandGuidelineSchema
} from '@/lib/brandGuidelineSchema';

export function useBrandSync() {
  const { call } = useApi();
  const { authToken } = usePluginStore();
  const store = usePluginStore();

  const saveBrandGuideline = useCallback(
    async (guideline: BrandGuideline) => {
      try {
        const payload = BrandGuidelineSchema.safeParse(guideline);
        if (!payload.success) {
          console.warn('[brandSync] invalid payload, aborting save:', payload.error.issues);
          store.showToast('Invalid guideline data', 'error');
          return;
        }
        const response = await call('/api/brand-guidelines', {
          method: 'POST',
          body: JSON.stringify(payload.data)
        });
        const saved = unwrapGuidelineResponse(response);
        if (saved?.id) {
          store.setBrandGuideline(saved as any);
          store.showToast('Brand guideline saved', 'success');
          return saved;
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
      let guidelines = parseBrandGuidelineList(response);
      // Fallback: if Zod filtered everything but the server returned items, trust the server.
      const rawArr = Array.isArray(response)
        ? response
        : Array.isArray((response as any)?.guidelines)
          ? (response as any).guidelines
          : [];
      if (guidelines.length === 0 && rawArr.length > 0) {
        console.warn('[brandSync] schema filtered all items; using raw list', rawArr);
        guidelines = rawArr;
      }
      usePluginStore.setState({
        savedGuidelineIds: guidelines.map((g) => (g.id ?? g._id) as string).filter(Boolean)
      });
      return guidelines;
    } catch (err) {
      console.error('Failed to load brand guidelines:', err);
      return [];
    }
  }, [call]);

  const updateBrandGuideline = useCallback(
    async (id: string, patch: Partial<BrandGuideline>) => {
      try {
        const response = await call(`/api/brand-guidelines/${id}`, {
          method: 'PUT',
          body: JSON.stringify(patch)
        });
        const saved = unwrapGuidelineResponse(response);
        if (saved?.id || saved?._id) {
          store.setBrandGuideline(saved as any);
          return saved;
        }
      } catch (err) {
        console.error('Failed to update brand guideline:', err);
        store.showToast('Failed to sync changes', 'error');
      }
    },
    [call, store]
  );

  return { saveBrandGuideline, loadBrandGuidelines, updateBrandGuideline };
}

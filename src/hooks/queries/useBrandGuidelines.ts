import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandGuidelineApi, type CodedError } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

export const BRAND_GUIDELINE_KEYS = {
  all: ['brand-guidelines'] as const,
  detail: (id: string) => ['brand-guidelines', id] as const,
  quota: ['brand-quota'] as const,
};
const KEYS = BRAND_GUIDELINE_KEYS;

export function useBrandGuidelines(enabled = true) {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => brandGuidelineApi.getAll(),
    enabled,
  });
}

export function useBrandGuideline(id: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => brandGuidelineApi.getById(id as string),
    enabled: !!id,
    placeholderData: () => {
      const list = qc.getQueryData<BrandGuideline[]>(KEYS.all);
      return list?.find((g) => g.id === id);
    },
  });
}

export function useUpdateGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BrandGuideline> }) =>
      brandGuidelineApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: KEYS.detail(id) });
      await qc.cancelQueries({ queryKey: KEYS.all });

      const previousDetail = qc.getQueryData<BrandGuideline>(KEYS.detail(id));
      const previousList = qc.getQueryData<BrandGuideline[]>(KEYS.all);

      if (previousDetail) {
        qc.setQueryData(KEYS.detail(id), { ...previousDetail, ...data });
      }
      if (previousList) {
        qc.setQueryData(
          KEYS.all,
          previousList.map((g) => (g.id === id ? { ...g, ...data } : g))
        );
      }
      return { previousDetail, previousList };
    },
    onError: (_err, { id }, context) => {
      if (context?.previousDetail) qc.setQueryData(KEYS.detail(id), context.previousDetail);
      if (context?.previousList) qc.setQueryData(KEYS.all, context.previousList);
    },
    onSettled: (_data, _err, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useDeleteGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandGuidelineApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEYS.all });
      const previousList = qc.getQueryData<BrandGuideline[]>(KEYS.all);
      if (previousList) {
        qc.setQueryData(
          KEYS.all,
          previousList.filter((g) => g.id !== id)
        );
      }
      return { previousList };
    },
    onError: (_err, _id, context) => {
      if (context?.previousList) qc.setQueryData(KEYS.all, context.previousList);
    },
    onSuccess: () => toast.success('Guideline deleted'),
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export interface BrandIngestPayload {
  source: 'pdf' | 'images' | 'url' | string;
  url?: string;
  data?: string;
  images?: string[];
  filename?: string;
}

export function useIngestGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: BrandIngestPayload }) =>
      brandGuidelineApi.ingest(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Re-extraction complete');
    },
  });
}

/** Quota de marcas ativas do plano (used/max/tier) — `max: null` = ilimitado. */
export function useBrandQuota(enabled = true) {
  return useQuery({
    queryKey: KEYS.quota,
    queryFn: () => brandGuidelineApi.getBrandQuota(),
    enabled,
    staleTime: 30_000,
  });
}

/** Muda `status` da marca com optimistic update na lista (padrão do useUpdateGuideline). */
function useSetGuidelineStatus(status: 'active' | 'archived') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      status === 'archived' ? brandGuidelineApi.archive(id) : brandGuidelineApi.unarchive(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: KEYS.all });
      const previousList = qc.getQueryData<BrandGuideline[]>(KEYS.all);
      if (previousList) {
        qc.setQueryData(
          KEYS.all,
          previousList.map((g) =>
            g.id === id
              ? {
                  ...g,
                  status,
                  archivedAt: status === 'archived' ? new Date().toISOString() : undefined,
                }
              : g
          )
        );
      }
      return { previousList };
    },
    onError: (_err, _id, context) => {
      if (context?.previousList) qc.setQueryData(KEYS.all, context.previousList);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: KEYS.quota });
    },
  });
}

export function useArchiveGuideline() {
  return useSetGuidelineStatus('archived');
}

/**
 * Reativar pode estourar a quota (402 `brand_limit`) — o caller passa `onBrandLimit`
 * pra abrir o paywall com contexto em vez do toast genérico.
 */
export function useUnarchiveGuideline() {
  return useSetGuidelineStatus('active');
}

/** True quando o erro é o 402 de limite de marcas do backend. */
export function isBrandLimitError(err: unknown): err is CodedError {
  return err instanceof Error && (err as CodedError).code === 'brand_limit';
}

export function useDuplicateGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandGuidelineApi.duplicate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Guideline duplicated');
    },
    onError: () => {
      toast.error('Failed to duplicate guideline');
    },
  });
}

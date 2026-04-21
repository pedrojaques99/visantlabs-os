import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { toast } from 'sonner';
import type { BrandGuideline } from '@/lib/figma-types';

const KEYS = {
  all: ['brand-guidelines'] as const,
  detail: (id: string) => ['brand-guidelines', id] as const,
};

export function useBrandGuidelines(enabled = true) {
  return useQuery({
    queryKey: KEYS.all,
    queryFn: () => brandGuidelineApi.getAll(),
    enabled,
  });
}

export function useUpdateGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BrandGuideline> }) =>
      brandGuidelineApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteGuideline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandGuidelineApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Guideline deleted');
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Re-extraction complete');
    },
  });
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

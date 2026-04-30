import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { creativeProjectApi, type SaveCreativeProjectInput } from '@/services/creativeProjectApi';
import { toast } from 'sonner';

export const CREATIVE_PROJECT_KEYS = {
  all: ['creative-projects'] as const,
  list: (brandId?: string) => ['creative-projects', 'list', brandId ?? 'all'] as const,
  lists: ['creative-projects', 'list'] as const,
  detail: (id: string) => ['creative-projects', 'detail', id] as const,
};
// Internal alias for brevity below
const KEYS = CREATIVE_PROJECT_KEYS;

export function useCreativeProjects(brandId?: string) {
  return useQuery({
    queryKey: KEYS.list(brandId),
    queryFn: () => creativeProjectApi.list(brandId),
  });
}

export function useCreativeProject(id: string | null | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => creativeProjectApi.get(id as string),
    enabled: !!id,
  });
}

export function useSaveCreativeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCreativeProjectInput) => creativeProjectApi.create(input),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success(`Saved "${project.name}"`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save creative'),
  });
}

export function useUpdateCreativeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SaveCreativeProjectInput> }) =>
      creativeProjectApi.update(id, input),
    // Optimistic UI: paint the change locally before the server confirms; if
    // the request fails the previous snapshot is restored.
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: KEYS.detail(id) });
      const previous = qc.getQueryData(KEYS.detail(id));
      qc.setQueryData(KEYS.detail(id), (old: any) =>
        old ? { ...old, ...input } : old
      );
      return { previous };
    },
    onError: (err: Error, { id }, context) => {
      if (context?.previous) qc.setQueryData(KEYS.detail(id), context.previous);
      toast.error(err.message || 'Failed to update creative');
    },
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.setQueryData(KEYS.detail(project.id), project);
    },
  });
}

export function useDeleteCreativeProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => creativeProjectApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete'),
  });
}

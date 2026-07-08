import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandingApi } from '@/services/brandingApi';
import { toast } from 'sonner';

export const BRANDING_KEYS = {
  all: ['brandings'] as const,
  list: ['brandings', 'list'] as const,
};

/** List the current user's branding projects. */
export function useBrandings(enabled = true) {
  return useQuery({
    queryKey: BRANDING_KEYS.list,
    queryFn: () => brandingApi.getAll(),
    enabled,
  });
}

/** Delete a branding project and refresh the list. */
export function useDeleteBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandingApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BRANDING_KEYS.all }),
    onError: (err: Error) => toast.error(err.message || 'Failed to delete project'),
  });
}

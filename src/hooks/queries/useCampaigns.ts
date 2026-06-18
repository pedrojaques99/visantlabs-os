import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { campaignApi, type UpdateCampaignInput } from '@/services/campaignApi';
import { toast } from 'sonner';

export const CAMPAIGN_KEYS = {
  all: ['campaigns'] as const,
  list: (brandId?: string) => ['campaigns', 'list', brandId ?? 'all'] as const,
  lists: ['campaigns', 'list'] as const,
  detail: (id: string) => ['campaigns', 'detail', id] as const,
};
const KEYS = CAMPAIGN_KEYS;

/** Brand cockpit: list campaigns, optionally scoped to one brand. */
export function useCampaigns(brandId?: string) {
  return useQuery({
    queryKey: KEYS.list(brandId),
    queryFn: () => campaignApi.list(brandId),
  });
}

export function useCampaign(id: string | null | undefined) {
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn: () => campaignApi.get(id as string),
    enabled: !!id,
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCampaignInput }) =>
      campaignApi.update(id, input),
    onSuccess: (campaign) => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.setQueryData(KEYS.detail(campaign.id), campaign);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update campaign'),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => campaignApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Campaign deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete campaign'),
  });
}

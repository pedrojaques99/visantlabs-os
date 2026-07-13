import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import {
  useArchiveGuideline,
  useUnarchiveGuideline,
  isBrandLimitError,
} from '@/hooks/queries/useBrandGuidelines';
import type { BrandGuideline } from '@/lib/figma-types';

export const isArchived = (g: BrandGuideline): boolean => g.status === 'archived';

/**
 * Fluxo compartilhado de arquivar/reativar marca (billing por marca ativa).
 * SSoT entre o grid da BrandGuidelinesPage e o kebab do GuidelinesSidebar:
 * confirm dialog padrão antes de arquivar, e o 402 `brand_limit` do unarchive
 * abre o paywall de assinatura com contexto em vez de um toast genérico.
 *
 * O consumidor renderiza `<ConfirmationModal {...confirmModalProps} />`.
 */
export function useBrandArchiveActions() {
  const { t } = useTranslation();
  const { onSubscriptionModalOpen } = useLayout();
  const archiveMutation = useArchiveGuideline();
  const unarchiveMutation = useUnarchiveGuideline();
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);

  const requestArchive = useCallback((id: string) => setPendingArchiveId(id), []);

  const confirmArchive = useCallback(() => {
    if (!pendingArchiveId) return;
    archiveMutation.mutate(pendingArchiveId, {
      onSuccess: () => toast.success(t('brandQuota.archiveSuccess')),
      onError: () => toast.error(t('brandQuota.archiveError')),
    });
    setPendingArchiveId(null);
  }, [pendingArchiveId, archiveMutation, t]);

  const unarchive = useCallback(
    (id: string) => {
      unarchiveMutation.mutate(id, {
        onSuccess: () => toast.success(t('brandQuota.unarchiveSuccess')),
        onError: (err) => {
          if (isBrandLimitError(err)) {
            onSubscriptionModalOpen({
              reason: 'brand_limit',
              message: t('brandQuota.limitMessage', {
                used: err.used ?? '?',
                max: err.max ?? '?',
              }),
            });
            return;
          }
          toast.error(t('brandQuota.unarchiveError'));
        },
      });
    },
    [unarchiveMutation, onSubscriptionModalOpen, t]
  );

  const confirmModalProps = useMemo(
    () => ({
      isOpen: pendingArchiveId !== null,
      onClose: () => setPendingArchiveId(null),
      onConfirm: confirmArchive,
      title: t('brandQuota.archiveConfirmTitle'),
      message: t('brandQuota.archiveConfirmMessage'),
      confirmText: t('brandQuota.archive'),
      cancelText: t('common.cancel') || 'Cancel',
      variant: 'warning' as const,
    }),
    [pendingArchiveId, confirmArchive, t]
  );

  return {
    requestArchive,
    unarchive,
    confirmModalProps,
    isArchiving: archiveMutation.isPending,
    isUnarchiving: unarchiveMutation.isPending,
  };
}

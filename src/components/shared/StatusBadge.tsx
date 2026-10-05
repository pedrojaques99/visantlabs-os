import React from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';

export type ItemStatus = 'queued' | 'processing' | 'done' | 'error';

export function StatusBadge({ status }: { status: ItemStatus }) {
  const { t } = useTranslation();
  switch (status) {
    case 'queued':
      return <span className="text-2xs text-muted-foreground">{t('common.queued')}</span>;
    case 'processing':
      return (
        <span className="flex items-center gap-1 text-2xs text-foreground">
          <Loader2 size={8} className="animate-spin" /> {t('common.processing')}
        </span>
      );
    case 'done':
      return (
        <span className="flex items-center gap-1 text-2xs text-success">
          <CheckCircle2 size={8} /> {t('common.done')}
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-2xs text-destructive">
          <AlertCircle size={8} /> {t('common.error')}
        </span>
      );
  }
}

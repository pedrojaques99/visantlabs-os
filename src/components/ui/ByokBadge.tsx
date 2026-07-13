import React from 'react';
import { Key, CreditCard } from 'lucide-react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import { Tooltip } from './Tooltip';
import { useTranslation } from '@/hooks/useTranslation';

interface ByokBadgeProps {
  active: boolean;
  showTooltip?: boolean;
  className?: string;
}

/**
 * Badge indicating BYOK (Bring Your Own Key) status
 * Shows whether user is using their own API key or platform credits
 */
export function ByokBadge({ active, showTooltip = true, className }: ByokBadgeProps) {
  const { t } = useTranslation();
  const badge = (
    <Badge
      className={cn(
        'text-xs gap-1 font-mono',
        active
          ? 'bg-success/20 text-success border-success/30 hover:bg-success/30'
          : 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30 hover:bg-neutral-500/30',
        className
      )}
    >
      {active ? (
        <>
          <Key size={12} />
          BYOK
        </>
      ) : (
        <>
          <CreditCard size={12} />
          Credits
        </>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip
      position="bottom"
      content={
        active ? (
          <div className="space-y-1">
            <p className="font-medium text-success">{t('brandQuota.byok.activeTitle')}</p>
            <p className="text-xs text-neutral-400">{t('brandQuota.byok.activeDesc')}</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium">{t('brandQuota.byok.inactiveTitle')}</p>
            <p className="text-xs text-neutral-400">{t('brandQuota.byok.inactiveDesc')}</p>
          </div>
        )
      }
    >
      {badge}
    </Tooltip>
  );
}

interface ByokCostIndicatorProps {
  isByok: boolean;
  creditsRequired: number;
  estimatedCostUSD?: number;
  className?: string;
}

/**
 * Shows cost indicator before generation
 * Different display for BYOK vs platform credits
 */
export function ByokCostIndicator({
  isByok,
  creditsRequired,
  estimatedCostUSD,
  className,
}: ByokCostIndicatorProps) {
  if (isByok) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-success', className)}>
        <Key size={12} />
        <span>BYOK Active - Charges go to your Google account</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-neutral-400', className)}>
      <CreditCard size={12} />
      <span>
        Cost: {creditsRequired} credit{creditsRequired !== 1 ? 's' : ''}
        {estimatedCostUSD !== undefined && ` (~$${estimatedCostUSD.toFixed(3)})`}
      </span>
    </div>
  );
}

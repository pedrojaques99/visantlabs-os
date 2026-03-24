import React from 'react';
import { Key, CreditCard } from 'lucide-react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';
import {
  Tooltip
} from './Tooltip';

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
  const badge = (
    <Badge
      className={cn(
        'text-xs gap-1 font-mono',
        active
          ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30'
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
            <p className="font-medium text-green-400">BYOK Mode Active</p>
            <p className="text-xs text-neutral-400">
              Using your own API key. Charges go directly to Google.
              No credits deducted from Visant.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="font-medium">Using Platform Credits</p>
            <p className="text-xs text-neutral-400">
              Each generation deducts credits from your account.
              Add your own API key in Settings for unlimited generations.
            </p>
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
      <div className={cn('flex items-center gap-1.5 text-xs text-green-400', className)}>
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

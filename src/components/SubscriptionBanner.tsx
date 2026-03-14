import React from 'react';
import { CreditCard, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { Button } from '@/components/ui/button'

interface SubscriptionBannerProps {
  subscriptionStatus: SubscriptionStatus;
  onUpgrade: () => void;
  onDismiss?: () => void;
}

export const SubscriptionBanner: React.FC<SubscriptionBannerProps> = ({
  subscriptionStatus,
  onUpgrade,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const { freeGenerationsRemaining, hasActiveSubscription, freeGenerationsUsed } = subscriptionStatus;

  if (hasActiveSubscription) {
    return null; // Don't show banner for active subscribers
  }

  if (freeGenerationsRemaining > 0) {
    return (
      <div className="bg-brand-cyan/10 border border-[brand-cyan]/30 rounded-md p-4 mb-4 relative">
        {onDismiss && (
          <Button variant="ghost" 
            onClick={onDismiss}
            className="absolute top-2 right-2 text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={16} />
          </Button>
        )}
        <div className="flex items-center gap-3">
          <CreditCard size={20} className="text-brand-cyan" />
          <div className="flex-1">
            <p className="text-sm font-mono text-neutral-300">
              {t('subscription.freeGenerationsRemaining', { remaining: freeGenerationsRemaining })}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {t('subscription.subscribeForUnlimited')}
            </p>
          </div>
          <Button variant="brand" 
            onClick={onUpgrade}
            className="px-4 py-2 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs font-mono transition-colors"
          >
            {t('subscription.upgrade')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 mb-4 relative">
      {onDismiss && (
        <Button variant="ghost" 
          onClick={onDismiss}
          className="absolute top-2 right-2 text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <X size={16} />
        </Button>
      )}
      <div className="flex items-center gap-3">
        <CreditCard size={20} className="text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-mono text-red-400 font-semibold">
            {t('subscription.allFreeGenerationsUsed', { used: freeGenerationsUsed })}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            {t('subscription.subscribeToContinue')}
          </p>
        </div>
        <Button variant="brand" 
          onClick={onUpgrade}
          className="px-4 py-2 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs font-mono transition-colors"
        >
          {t('subscription.subscribeNow')}
        </Button>
      </div>
    </div>
  );
};


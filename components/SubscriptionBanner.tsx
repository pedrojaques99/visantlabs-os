import React from 'react';
import { CreditCard, X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import type { SubscriptionStatus } from '../services/subscriptionService';

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
      <div className="bg-[#52ddeb]/10 border border-[#52ddeb]/30 rounded-md p-4 mb-4 relative">
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={16} />
          </button>
        )}
        <div className="flex items-center gap-3">
          <CreditCard size={20} className="text-[#52ddeb]" />
          <div className="flex-1">
            <p className="text-sm font-mono text-zinc-300">
              {t('subscription.freeGenerationsRemaining', { remaining: freeGenerationsRemaining })}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {t('subscription.subscribeForUnlimited')}
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="px-4 py-2 bg-[#52ddeb]/80 hover:bg-[#52ddeb] text-black font-semibold rounded-md text-xs font-mono transition-colors"
          >
            {t('subscription.upgrade')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 mb-4 relative">
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X size={16} />
        </button>
      )}
      <div className="flex items-center gap-3">
        <CreditCard size={20} className="text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-mono text-red-400 font-semibold">
            {t('subscription.allFreeGenerationsUsed', { used: freeGenerationsUsed })}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {t('subscription.subscribeToContinue')}
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="px-4 py-2 bg-[#52ddeb]/80 hover:bg-[#52ddeb] text-black font-semibold rounded-md text-xs font-mono transition-colors"
        >
          {t('subscription.subscribeNow')}
        </button>
      </div>
    </div>
  );
};


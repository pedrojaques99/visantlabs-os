import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { subscriptionService } from '../services/subscriptionService';
import type { SubscriptionStatus as SubscriptionStatusType } from '../services/subscriptionService';

interface SubscriptionStatusProps {
  subscriptionStatus: SubscriptionStatusType;
  onRefresh?: () => void;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
};

export const SubscriptionStatus: React.FC<SubscriptionStatusProps> = ({
  subscriptionStatus,
  onRefresh,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const { url } = await subscriptionService.createPortalSession();
      window.location.href = url;
    } catch (error: any) {
      console.error('Failed to open customer portal:', error);
      alert('Failed to open subscription management. Please try again.');
      setIsLoading(false);
    }
  };

  const { 
    hasActiveSubscription, 
    subscriptionTier, 
    freeGenerationsUsed, 
    freeGenerationsRemaining,
    monthlyCredits,
    creditsUsed,
    creditsRemaining,
    creditsResetDate,
    totalCreditsEarned,
    totalCredits
  } = subscriptionStatus;

  // Calculate total credits available: manual credits + monthly credits remaining
  // Use totalCredits from backend if available, otherwise calculate it
  const totalCreditsAvailable = typeof totalCredits === 'number' 
    ? totalCredits 
    : ((totalCreditsEarned ?? 0) + (creditsRemaining ?? 0));
  const creditsPercentage = monthlyCredits > 0 
    ? Math.round((creditsUsed / monthlyCredits) * 100) 
    : 0;
  const subscriptionProgressStyle = {
    '--progress': `${Math.min(creditsPercentage, 100)}%`,
  } as CSSProperties;

  // Hide subscription information, show only credits
  if (hasActiveSubscription) {
    return (
      <div className="flex flex-col gap-1 text-xs text-zinc-400 font-mono">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-zinc-800 rounded-md h-1.5 overflow-hidden">
            <div 
              className="h-full bg-[#52ddeb] transition-all duration-300 progress-fill"
              style={subscriptionProgressStyle}
            />
          </div>
          <span className="text-zinc-500 whitespace-nowrap">
            {totalCreditsAvailable} credits
          </span>
        </div>
        {creditsResetDate && (
          <span className="text-zinc-600 text-[10px]">
            Resets {formatDate(creditsResetDate)}
          </span>
        )}
      </div>
    );
  }

  return (
      <div className="flex flex-col gap-1 text-xs text-zinc-400 font-mono">
      <div className="flex items-center gap-2">
        <span>Free</span>
        <span className="text-zinc-500">
          ({totalCreditsAvailable} credits)
        </span>
      </div>
      {creditsResetDate && (
        <span className="text-zinc-600 text-[10px]">
          Resets {formatDate(creditsResetDate)}
        </span>
      )}
    </div>
  );
};


import React from 'react';
import { useLayout } from '@/hooks/useLayout';
import { GlassPanel } from './ui/GlassPanel';
import { Button } from './ui/button';
import { Lock } from 'lucide-react';

interface UpgradeGateProps {
  feature: string;
  children: React.ReactNode;
}

export const UpgradeGate: React.FC<UpgradeGateProps> = ({ feature, children }) => {
  const { subscriptionStatus, onSubscriptionModalOpen } = useLayout();

  const isFree = !subscriptionStatus?.hasActiveSubscription ||
    subscriptionStatus?.subscriptionTier === 'free';

  if (!isFree) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 blur-[2px] select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <GlassPanel className="p-6 text-center max-w-xs">
          <Lock className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
          <p className="text-sm font-mono text-neutral-300 mb-4">
            Upgrade para desbloquear <strong>{feature}</strong>
          </p>
          <Button onClick={onSubscriptionModalOpen} variant="brand" className="w-full">
            Ver planos
          </Button>
        </GlassPanel>
      </div>
    </div>
  );
};

import React from 'react';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePremiumAccess } from '@/hooks/usePremiumAccess';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { GlitchLoader } from '@/components/ui/GlitchLoader';

interface PremiumGateProps {
  children: React.ReactNode;
  toolName: string;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({ children, toolName }) => {
  const { hasAccess, isLoading } = usePremiumAccess();
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (isLoading || isCheckingAuth) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
        <GlitchLoader />
      </div>
    );
  }

  if (hasAccess) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 px-6">
      <div className="flex flex-col items-center gap-6 max-w-xs text-center">
        <div className="w-16 h-16 rounded-2xl border border-neutral-800 bg-neutral-900 flex items-center justify-center">
          <Lock size={28} className="text-neutral-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">{toolName}</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">{t('premium.upgradeRequired')}</p>
        </div>
        <div className="flex gap-3">
          {!isAuthenticated && (
            <Button variant="surface" size="sm" onClick={() => navigate('/auth')}>
              {t('auth.signIn')}
            </Button>
          )}
          <Button variant="surface" size="sm" onClick={() => navigate('/pricing')}>
            {t('premium.seePlans')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/apps')}>
            {t('mobile.desktopOnly.backToApps') || 'Back'}
          </Button>
        </div>
      </div>
    </div>
  );
};

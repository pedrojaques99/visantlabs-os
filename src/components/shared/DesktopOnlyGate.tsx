import React from 'react';
import { Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-media-query';
import { useTranslation } from '@/hooks/useTranslation';

interface DesktopOnlyGateProps {
  children: React.ReactNode;
  toolName: string;
}

export const DesktopOnlyGate: React.FC<DesktopOnlyGateProps> = ({ children, toolName }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!isMobile) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950 px-6">
      <div className="flex flex-col items-center gap-6 max-w-xs text-center">
        <div className="w-16 h-16 rounded-2xl border border-neutral-800 bg-neutral-900 flex items-center justify-center">
          <Monitor size={28} className="text-neutral-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">{toolName}</h2>
          <p className="text-xs text-neutral-500 leading-relaxed">
            {t('mobile.desktopOnly.message')}
          </p>
        </div>
        <Button variant="surface" size="sm" onClick={() => navigate('/apps')} className="mt-2">
          {t('mobile.desktopOnly.backToApps')}
        </Button>
      </div>
    </div>
  );
};

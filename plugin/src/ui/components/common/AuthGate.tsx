import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePluginStore } from '../../store';

interface AuthGateProps {
  children: React.ReactNode;
  /** Shown to signed-out users. Defaults to a hint pointing at the Profile tab. */
  fallback?: React.ReactNode;
  /** What the user is being gated out of — used in the default hint. */
  feature?: string;
}

/**
 * Render `children` only for signed-in users.
 *
 * Until now the codebase gated inline (`isAuthenticated ? … : …`, e.g. ProfileTab),
 * which is fine for one call site and duplication for the next. This keeps the rule
 * in one place — the server is the real gate; this is just so the UI doesn't offer
 * what it can't deliver.
 */
export function AuthGate({ children, fallback, feature }: AuthGateProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const setActiveView = usePluginStore((s) => s.setActiveView);
  const featureLabel = feature ?? t('plugin.auth.defaultFeature');

  if (isAuthenticated) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-4 text-center">
      <Lock size={14} className="text-muted-foreground/70" />
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {t('plugin.auth.needsLogin', { feature: featureLabel })}
      </p>
      <button
        onClick={() => setActiveView('profile')}
        className="text-[9px] font-bold uppercase tracking-wider text-brand-cyan hover:underline"
      >
        {t('plugin.auth.signIn')}
      </button>
    </div>
  );
}

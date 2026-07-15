import React from 'react';
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
export function AuthGate({ children, fallback, feature = 'Esta ferramenta' }: AuthGateProps) {
  const { isAuthenticated } = useAuth();
  const setActiveView = usePluginStore((s) => s.setActiveView);

  if (isAuthenticated) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-neutral-900/40 px-3 py-4 text-center">
      <Lock size={14} className="text-neutral-600" />
      <p className="text-[9px] uppercase tracking-wider text-neutral-500">
        {feature} precisa de login
      </p>
      <button
        onClick={() => setActiveView('profile')}
        className="text-[9px] font-bold uppercase tracking-wider text-brand-cyan hover:underline"
      >
        Entrar na Visant
      </button>
    </div>
  );
}

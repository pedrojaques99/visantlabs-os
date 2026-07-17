import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { usePluginStore } from '../../store';
import { isOutOfCredits } from '../../store/types';
import { ProfileTab } from './ProfileTab';
import { DevTab } from './DevTab';

/**
 * What's left of this month, stated plainly.
 *
 * This replaces the header's pickaxe chip, which rendered "0" for anyone logged out (credits
 * default to {used:0, limit:0}, and an object is always truthy), was `cursor-default`, and
 * whose only click was the dev-mode easter egg. A number nobody can act on, shown always.
 * Here it's on the tab you open to check — consultation, not interruption.
 */
function CreditsCard() {
  const { t } = useTranslation();
  const credits = usePluginStore((s) => s.credits);
  const isAuthenticated = !!usePluginStore((s) => s.authToken);

  // With no session there is no quota to report — the sign-in form above already says so.
  if (!isAuthenticated || !credits || credits.limit <= 0) return null;

  const remaining = Math.max(0, credits.limit - credits.used);
  const out = isOutOfCredits(credits);
  const pct = Math.min(100, Math.round((credits.used / credits.limit) * 100));

  return (
    <div className="p-4 border border-border/50 rounded-xl bg-muted/20 space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{t('plugin.profile.creditsTitle')}</span>
        <span className="text-xs font-mono tabular-nums text-foreground">
          {remaining} / {credits.limit}
        </span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${out ? 'bg-destructive' : 'bg-foreground/40'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {out
          ? t('plugin.profile.creditsOut')
          : t(
              remaining === 1
                ? 'plugin.profile.creditsRemainingOne'
                : 'plugin.profile.creditsRemainingOther',
              { count: remaining }
            )}
      </p>
    </div>
  );
}

export function ProfileView() {
  const devMode = usePluginStore((s) => s.devMode);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      <CreditsCard />
      <ProfileTab />
      {devMode && <DevTab />}
    </div>
  );
}

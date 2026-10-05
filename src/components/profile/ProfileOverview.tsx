import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Camera,
  CreditCard,
  ExternalLink,
  Copy,
  Plus,
  UserCog,
  type LucideIcon,
} from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { type User as UserType } from '@/services/authService';
import { type SubscriptionStatus } from '@/services/subscriptionService';
import { referralService, type ReferralStats } from '@/services/referralService';
import { toast } from 'sonner';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Thumb } from '@/components/ui/Thumb';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/utils/localeUtils';
import { copyToClipboard } from '@/utils/clipboard';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { UsageDashboard } from './UsageDashboard';

interface ProfileOverviewProps {
  user: UserType;
  subscriptionStatus: SubscriptionStatus | null;
  /** A leitura da assinatura falhou: mostra erro com retry, não "sem dados". */
  subscriptionError?: boolean;
  onRetrySubscription?: () => void;
  referralStats: ReferralStats | null;
  isLoadingReferral: boolean;
  /** A leitura do referral falhou: erro com retry, nunca spinner eterno. */
  referralError?: boolean;
  onRetryReferral?: () => void;
  onRefreshUserData: () => void;
  onManageSubscription: () => void;
  onBuyCredits: () => void;
  onViewTransactions: () => void;
  onEditProfile: () => void;
  isUploadingPicture?: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  avatarUrl: string;
}

// Shared surface for a card section.
const cardClass = cn('rounded-2xl p-5 sm:p-6 flex flex-col gap-5', glassSurface.panel);
const tileClass = cn('rounded-xl', glassSurface.surface);
const controlClass = cn('rounded-xl', glassSurface.control);

// One navigation row — used for the profile shortcuts. Renders a Link or a button.
const NavRow: React.FC<{
  icon: LucideIcon;
  label: string;
  to?: string;
  onClick?: () => void;
}> = ({ icon: Icon, label, to, onClick }) => {
  const inner = (
    <span className="flex items-center gap-3">
      <Icon size={16} strokeWidth={2} className="text-muted-foreground" />
      <span>{label}</span>
    </span>
  );
  const cls = cn(
    'flex w-full items-center px-4 py-2.5 text-sm font-medium text-foreground',
    controlClass
  );
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
};

// Section header: just the title.
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="border-b border-border pb-4">
    <MicroTitle as="h3" className="text-sm font-semibold text-foreground">
      {title}
    </MicroTitle>
  </div>
);

const StatTile: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className={cn(tileClass, 'p-3')}>
    <MicroTitle as="p" className="mb-1">
      {label}
    </MicroTitle>
    {children}
  </div>
);

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  user,
  subscriptionStatus,
  subscriptionError = false,
  onRetrySubscription,
  referralStats,
  isLoadingReferral,
  referralError = false,
  onRetryReferral,
  onManageSubscription,
  onBuyCredits,
  onViewTransactions,
  onEditProfile,
  isUploadingPicture = false,
  onFileUpload,
  avatarUrl,
}) => {
  const { t } = useTranslation();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [storageUsage, setStorageUsage] = useState<{
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    formatted: { used: string; limit: string; remaining: string };
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);

  useEffect(() => {
    const loadStorage = async () => {
      setIsLoadingStorage(true);
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await fetch('/api/storage/usage', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            setStorageUsage(await response.json());
          }
        }
      } catch (err) {
        console.error('Failed to load storage usage:', err);
      } finally {
        setIsLoadingStorage(false);
      }
    };
    loadStorage();
  }, []);

  const handleCopyReferralLink = async () => {
    if (!referralStats?.referralCode) {
      toast.error(t('referral.noCode'));
      return;
    }
    try {
      await copyToClipboard(referralService.getReferralLink(referralStats.referralCode));
      toast.success(t('referral.linkCopied'));
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error(t('referral.copyFailed'));
    }
  };

  const referralLink = referralStats?.referralCode
    ? referralService.getReferralLink(referralStats.referralCode)
    : '';

  const totalCreditsAvailable = subscriptionStatus
    ? typeof subscriptionStatus.totalCredits === 'number'
      ? subscriptionStatus.totalCredits
      : (subscriptionStatus.totalCreditsEarned ?? 0) + (subscriptionStatus.creditsRemaining ?? 0)
    : 0;

  const hasActiveSubscription = Boolean(subscriptionStatus?.hasActiveSubscription);

  return (
    <div className="grid gap-5 grid-cols-1 lg:grid-cols-2 lg:auto-rows-min animate-in fade-in duration-300">
      {/* ── Identity — tall left column on desktop ─────────────── */}
      <section className={`${cardClass} lg:row-span-2`}>
        <div className="flex flex-col items-center gap-4 pt-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileUpload}
            disabled={isUploadingPicture}
            className="hidden"
          />
          <button
            type="button"
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-muted border border-border overflow-hidden flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingPicture}
            title={t('profile.uploadPicture')}
            aria-label={t('profile.uploadPicture')}
          >
            {isUploadingPicture ? (
              <GlitchLoader size={32} />
            ) : (
              <Thumb
                src={avatarUrl || undefined}
                alt={user.name || t('common.profile')}
                fallbackIcon={User}
                className="w-full h-full object-cover"
              />
            )}
            <span className="absolute bottom-2 right-2 bg-background/90 text-foreground border border-border rounded-lg p-1.5">
              <Camera size={14} />
            </span>
          </button>
          <div className="text-center space-y-1 min-w-0 max-w-full">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">
              {user.name || t('profile.name')}
            </h2>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        {/* Só ações escopadas ao perfil. Meus Mockups / Comunidade viraram grupo
            BIBLIOTECA no rail; API Keys vive no CONTEXTO (rail) da seção. */}
        <div className="flex flex-col gap-2.5">
          <NavRow icon={UserCog} label={t('profile.edit')} onClick={onEditProfile} />
          {user && (user.id || user.email) && (
            <NavRow
              icon={ExternalLink}
              label={t('profile.viewPublicProfile')}
              to={`/profile/${user.username || user.id}`}
            />
          )}
        </div>
      </section>

      {/* ── Credits ─────────────────────────────────────────────── */}
      <section className={cardClass}>
        <SectionHeader title={t('credits.title')} />

        {subscriptionStatus ? (
          <>
            <div className="flex flex-col gap-4 flex-1">
              <div className={cn(tileClass, 'relative p-5')}>
                <Button
                  variant="brand"
                  size="icon-sm"
                  onClick={onBuyCredits}
                  className="absolute top-4 right-4 rounded-lg"
                  title={t('credits.buyCredits')}
                  aria-label={t('credits.buyCredits')}
                >
                  <Plus size={16} />
                </Button>
                <MicroTitle as="p" className="mb-1">
                  {t('credits.available')}
                </MicroTitle>
                <p className="text-4xl font-bold text-foreground font-mono tracking-tight">
                  {totalCreditsAvailable}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile label={t('profile.totalCreditsUsed')}>
                  <p className="text-lg font-bold text-foreground font-mono">
                    {subscriptionStatus.creditsUsed ?? 0}
                  </p>
                </StatTile>
                {isLoadingStorage ? (
                  <div className={cn(tileClass, 'p-3 flex items-center justify-center')}>
                    <GlitchLoader size={16} />
                  </div>
                ) : storageUsage ? (
                  <div className={cn(tileClass, 'p-3')}>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <MicroTitle as="p">{t('credits.storage')}</MicroTitle>
                      <p className="text-2xs text-muted-foreground font-mono">
                        {storageUsage.percentage.toFixed(0)}%
                      </p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mb-1.5">
                      <div
                        className="bg-foreground/70 h-1.5 rounded-full"
                        style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-2xs text-muted-foreground font-mono">
                      {storageUsage.formatted.used} / {storageUsage.formatted.limit}
                    </p>
                  </div>
                ) : (
                  <StatTile label={t('credits.storage')}>
                    <p className="text-sm text-muted-foreground">{t('common.unavailable')}</p>
                  </StatTile>
                )}
              </div>

              {subscriptionStatus.creditsResetDate && (
                <MicroTitle as="p" className="text-center pt-1">
                  {subscriptionStatus.hasActiveSubscription
                    ? t('credits.renews', { date: formatDate(subscriptionStatus.creditsResetDate) })
                    : t('credits.resets', {
                        date: formatDate(subscriptionStatus.creditsResetDate),
                      })}
                </MicroTitle>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button variant="surface" onClick={onViewTransactions} className="w-full text-sm">
                {t('profile.viewAllTransactions')}
              </Button>
              {hasActiveSubscription && subscriptionStatus?.subscriptionStatus !== 'free' && (
                <Button
                  variant="surface"
                  onClick={onManageSubscription}
                  className="w-full text-sm gap-2"
                  title={t('profile.manageSubscription')}
                >
                  <CreditCard size={14} />
                  {t('profile.manageSubscription')}
                </Button>
              )}
            </div>
          </>
        ) : subscriptionError ? (
          <ErrorState onRetry={onRetrySubscription} className="py-8 flex-1" />
        ) : (
          <div className="flex items-center justify-center py-12 flex-1">
            <GlitchLoader size={20} />
          </div>
        )}
      </section>

      {/* ── Referral ────────────────────────────────────────────── */}
      <section className={cardClass}>
        <SectionHeader title={t('referral.title')} />

        {referralStats ? (
          <div className="flex flex-col gap-5 flex-1">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('referral.description')}
            </p>

            <div className="space-y-2">
              <MicroTitle as="label" className="block">
                {t('referral.yourLink')}
              </MicroTitle>
              <div className="relative group">
                <Input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="w-full pr-11 text-muted-foreground font-mono text-xs"
                />
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={handleCopyReferralLink}
                  disabled={!referralStats.referralCode}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md"
                  aria-label={t('referral.copy')}
                  title={t('referral.copy')}
                >
                  {isLoadingReferral ? <GlitchLoader size={12} /> : <Copy size={12} />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div
                className={cn(
                  tileClass,
                  'p-4 flex flex-col items-center justify-center text-center'
                )}
              >
                <p className="text-xl font-bold text-foreground font-mono mb-1">
                  {referralStats.referredUsersCount || 0}
                </p>
                <MicroTitle as="p">{t('referral.friendsReferred')}</MicroTitle>
              </div>
              <div
                className={cn(
                  tileClass,
                  'p-4 flex flex-col items-center justify-center text-center'
                )}
              >
                <p className="text-xl font-bold text-foreground font-mono mb-1">
                  {referralStats.totalCreditsEarned || 0}
                </p>
                <MicroTitle as="p">{t('referral.totalEarned')}</MicroTitle>
              </div>
            </div>
          </div>
        ) : referralError ? (
          <ErrorState onRetry={onRetryReferral} className="py-8 flex-1" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 flex-1">
            <GlitchLoader size={20} />
            <p className="text-sm text-muted-foreground text-center">
              {isLoadingReferral ? t('common.loading') : t('referral.generating')}
            </p>
          </div>
        )}
      </section>

      {/* ── Usage Analytics — full width ─────────────────────────── */}
      <section className={cn(cardClass, 'lg:col-span-2')}>
        <SectionHeader title={t('profile.usageAnalytics')} />
        <UsageDashboard />
      </section>
    </div>
  );
};

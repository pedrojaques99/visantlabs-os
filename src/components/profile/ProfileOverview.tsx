import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Camera,
  CreditCard,
  ExternalLink,
  Share2,
  Copy,
  Users,
  HardDrive,
  Plus,
  ArrowRight,
  UserCog,
  KeyRound,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { type User as UserType } from '@/services/authService';
import { type SubscriptionStatus } from '@/services/subscriptionService';
import { referralService, type ReferralStats } from '@/services/referralService';
import { toast } from 'sonner';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/utils/localeUtils';
import { copyToClipboard } from '@/utils/clipboard';

interface ProfileOverviewProps {
  user: UserType;
  subscriptionStatus: SubscriptionStatus | null;
  referralStats: ReferralStats | null;
  isLoadingReferral: boolean;
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
const cardClass =
  'bg-neutral-900/60 border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col gap-5';

// One navigation row — used for the profile shortcuts. Renders a Link or a button.
const NavRow: React.FC<{
  icon: LucideIcon;
  label: string;
  to?: string;
  onClick?: () => void;
}> = ({ icon: Icon, label, to, onClick }) => {
  const inner = (
    <>
      <span className="flex items-center gap-3">
        <Icon size={16} strokeWidth={2} className="text-neutral-500" />
        <span>{label}</span>
      </span>
      <ArrowRight
        size={14}
        className="text-neutral-600 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0"
      />
    </>
  );
  const cls =
    'group flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm font-mono font-medium text-neutral-300 transition-colors hover:border-white/10 hover:bg-white/[0.04]';
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

// Section header with an icon chip + title.
const SectionHeader: React.FC<{ icon: LucideIcon; title: string }> = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 border-b border-white/5 pb-4">
    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
      <Icon size={16} className="text-neutral-400" />
    </div>
    <MicroTitle as="h3" className="text-sm font-semibold text-neutral-100">
      {title}
    </MicroTitle>
  </div>
);

const StatTile: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
    <MicroTitle as="p" className="mb-1">
      {label}
    </MicroTitle>
    {children}
  </div>
);

export const ProfileOverview: React.FC<ProfileOverviewProps> = ({
  user,
  subscriptionStatus,
  referralStats,
  isLoadingReferral,
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
          <div
            className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-neutral-950 border border-white/10 overflow-hidden flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 group"
            onClick={() => fileInputRef.current?.click()}
            title={t('profile.uploadPicture')}
          >
            {isUploadingPicture ? (
              <GlitchLoader size={32} />
            ) : avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.name || t('common.profile')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <User size={44} className="text-neutral-700" />
            )}
            <span className="absolute bottom-2 right-2 bg-brand-cyan text-black rounded-lg p-1.5 shadow-lg transition-transform group-hover:scale-110">
              <Camera size={14} />
            </span>
          </div>
          <div className="text-center space-y-1 min-w-0 max-w-full">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {user.name || t('profile.name')}
            </h2>
            <p className="text-sm text-neutral-500 font-mono truncate">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <NavRow icon={UserCog} label={t('profile.edit')} onClick={onEditProfile} />
          {user && (user.id || user.email) && (
            <NavRow
              icon={ExternalLink}
              label={t('profile.viewPublicProfile')}
              to={`/profile/${user.username || user.id}`}
            />
          )}
          <NavRow icon={Heart} label={t('profile.myMockups')} to="/my-outputs" />
          <NavRow icon={Users} label={t('communityPresets.title')} to="/community" />
          <NavRow icon={KeyRound} label={t('profile.apiKeys')} to="/settings/api-keys" />
        </div>
      </section>

      {/* ── Credits ─────────────────────────────────────────────── */}
      <section className={cardClass}>
        <SectionHeader icon={CreditCard} title={t('credits.title')} />

        {subscriptionStatus ? (
          <>
            <div className="flex flex-col gap-4 flex-1">
              <div className="relative bg-white/[0.02] border border-white/5 rounded-xl p-5">
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
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-bold text-white font-mono tracking-tight">
                    {totalCreditsAvailable}
                  </p>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded-full border border-brand-cyan/20">
                    {t('credits.active')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatTile label={t('profile.totalCreditsUsed')}>
                  <p className="text-lg font-bold text-neutral-200 font-mono">
                    {subscriptionStatus.creditsUsed ?? 0}
                  </p>
                </StatTile>
                {isLoadingStorage ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-center">
                    <GlitchLoader size={16} />
                  </div>
                ) : storageUsage ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <HardDrive size={10} className="text-neutral-500" />
                        <MicroTitle as="p">{t('credits.storage')}</MicroTitle>
                      </span>
                      <p className="text-[10px] text-neutral-400 font-mono">
                        {storageUsage.percentage.toFixed(0)}%
                      </p>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-1.5 mb-1.5">
                      <div
                        className="bg-brand-cyan h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono">
                      {storageUsage.formatted.used} / {storageUsage.formatted.limit}
                    </p>
                  </div>
                ) : (
                  <StatTile label={t('credits.storage')}>
                    <p className="text-sm text-neutral-600 font-mono">—</p>
                  </StatTile>
                )}
              </div>

              {subscriptionStatus.creditsResetDate && (
                <MicroTitle as="p" className="text-neutral-600 tracking-widest text-center pt-1">
                  {subscriptionStatus.hasActiveSubscription
                    ? t('credits.renews', { date: formatDate(subscriptionStatus.creditsResetDate) })
                    : t('credits.resets', { date: formatDate(subscriptionStatus.creditsResetDate) })}
                </MicroTitle>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Button
                variant="surface"
                onClick={onViewTransactions}
                className="w-full font-mono text-sm"
              >
                {t('profile.viewAllTransactions')}
              </Button>
              {hasActiveSubscription && subscriptionStatus?.subscriptionStatus !== 'free' && (
                <Button
                  variant="surface"
                  onClick={onManageSubscription}
                  className="w-full font-mono text-sm gap-2"
                  title={t('profile.manageSubscription')}
                >
                  <CreditCard size={14} />
                  {t('profile.manageSubscription')}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12 flex-1">
            <p className="text-sm text-neutral-500 font-mono text-center max-w-[200px]">
              {t('profile.noSubscriptionData')}
            </p>
          </div>
        )}
      </section>

      {/* ── Referral ────────────────────────────────────────────── */}
      <section className={cardClass}>
        <SectionHeader icon={Share2} title={t('referral.title')} />

        {referralStats ? (
          <div className="flex flex-col gap-5 flex-1">
            <p className="text-sm text-neutral-400 font-mono leading-relaxed">
              {t('referral.description')}
            </p>

            <div className="space-y-2">
              <MicroTitle as="label" className="block text-neutral-600">
                {t('referral.yourLink')}
              </MicroTitle>
              <div className="relative group">
                <Input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="w-full pr-11 bg-white/[0.02] border-white/10 text-neutral-400 group-hover:text-neutral-200 font-mono text-xs transition-colors"
                />
                <Button
                  variant="surface"
                  size="icon-sm"
                  onClick={handleCopyReferralLink}
                  disabled={!referralStats.referralCode}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md"
                  aria-label={t('referral.linkCopied')}
                >
                  {isLoadingReferral ? <GlitchLoader size={12} /> : <Copy size={12} />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-auto">
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <Users className="text-neutral-500 mb-2" size={20} />
                <p className="text-xl font-bold text-neutral-200 font-mono mb-1">
                  {referralStats.referredUsersCount || 0}
                </p>
                <MicroTitle as="p" className="text-neutral-600 tracking-wide">
                  {t('referral.friendsReferred')}
                </MicroTitle>
              </div>
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                <CreditCard className="text-brand-cyan/60 mb-2" size={20} />
                <p className="text-xl font-bold text-brand-cyan font-mono mb-1">
                  {referralStats.totalCreditsEarned || 0}
                </p>
                <MicroTitle as="p" className="text-neutral-600 tracking-wide">
                  {t('referral.totalEarned')}
                </MicroTitle>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 flex-1">
            <GlitchLoader size={20} />
            <p className="text-sm text-neutral-500 font-mono text-center">
              {isLoadingReferral ? t('common.loading') : t('referral.generating')}
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

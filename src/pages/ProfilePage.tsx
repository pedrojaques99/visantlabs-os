import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { X, Trash2, UserCircle } from '@/lib/ui/icons';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { CreditPackagesModal } from '../components/CreditPackagesModal';
import { TransactionsModal } from '../components/TransactionsModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { PageShell } from '../components/ui/PageShell';
import { authService, type User as UserType } from '../services/authService';
import { subscriptionService, type SubscriptionStatus } from '../services/subscriptionService';
import { referralService, type ReferralStats } from '../services/referralService';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { ApiSettings } from '../components/profile/ApiSettings';
import { SecuritySettings } from '../components/profile/SecuritySettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { ProfileOverview } from '../components/profile/ProfileOverview';
import { UsageHistory } from '../components/profile/UsageHistory';
import { API_BASE } from '@/config/api';
import { useInAppShell } from '@/components/shell/InAppShellContext';
import { cn } from '@/lib/utils';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout();
  const inShell = useInAppShell();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deleteConfirmWord = t('profile.deleteDialog.confirmWord');

  // State
  const [user, setUser] = useState<UserType | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  // Falha de carga ≠ "sem dados" ≠ "carregando": cada um tem a sua tela.
  const [subscriptionError, setSubscriptionError] = useState(false);
  const [referralError, setReferralError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreditPackagesModalOpen, setIsCreditPackagesModalOpen] = useState(false);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [isLoadingReferral, setIsLoadingReferral] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Tab state management
  const [currentTab, setCurrentTab] = useState(searchParams.get('tab') || 'overview');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'history', 'configuration'].includes(tab)) {
      setCurrentTab(tab);
    } else {
      setCurrentTab('overview');
    }
  }, [searchParams]);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      if (isCheckingAuth) return;

      if (isAuthenticated === true) {
        setIsLoading(true);
        setError(null);
        try {
          const currentUser = await authService.verifyToken();

          if (!currentUser) {
            setError(t('common.loadError'));
            setUser(null);
            return;
          }

          setUser(currentUser);
          setAvatarUrl(currentUser.picture || '');

          // Load additional data
          loadSubscriptionStatus();
          loadReferralStats();
        } catch (err: any) {
          console.error('Failed to load user data:', err);
          setError(t('common.loadError'));
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else if (isAuthenticated === false) {
        setUser(null);
        setIsLoading(false);
        setError(null);
      }
    };

    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isCheckingAuth, t, reloadKey]);

  const loadSubscriptionStatus = async () => {
    setSubscriptionError(false);
    try {
      const status = await subscriptionService.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err) {
      console.error('Failed to load subscription status:', err);
      setSubscriptionError(true);
    }
  };

  const loadReferralStats = async () => {
    try {
      setIsLoadingReferral(true);
      setReferralError(false);
      const stats = await referralService.getReferralStats();
      if (!stats.referralCode) {
        try {
          await referralService.generateReferralCode();
          const updatedStats = await referralService.getReferralStats();
          setReferralStats(updatedStats);
        } catch (genErr) {
          console.error('Failed to generate referral code:', genErr);
          setReferralStats(stats);
        }
      } else {
        setReferralStats(stats);
      }
    } catch (err) {
      console.error('Failed to load referral stats:', err);
      setReferralError(true);
    } finally {
      setIsLoadingReferral(false);
    }
  };

  const handleRefreshUserData = () => {
    loadSubscriptionStatus();
    loadReferralStats();
    authService.verifyToken().then((u) => {
      if (u) {
        setUser(u);
        setAvatarUrl(u.picture || '');
      }
    });
  };

  const handleManageSubscription = async () => {
    try {
      const { url } = await subscriptionService.createPortalSession();
      window.open(url, '_blank');
    } catch (error: any) {
      console.error('Failed to create portal session:', error);
      toast.error(t('subscription.portalError'));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('common.selectImageFile'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('common.imageSizeLimit'));
      return;
    }

    setIsUploadingPicture(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const token = localStorage.getItem('auth_token');
          if (!token) throw new Error(t('common.authenticationRequired'));

          const response = await fetch(`${API_BASE}/auth/profile/picture`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ imageBase64: base64String }),
          });

          if (!response.ok) throw new Error(t('common.pictureUploadError'));

          const data = await response.json();
          setAvatarUrl(data.picture);
          setUser(data.user);
          toast.success(t('common.pictureUploadSuccess'));
        } catch (err: any) {
          toast.error(err.message || t('common.pictureUploadError'));
        } finally {
          setIsUploadingPicture(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message || t('common.pictureUploadError'));
      setIsUploadingPicture(false);
    }
  };

  if (isCheckingAuth || isLoading) {
    return (
      <div
        className={cn(
          'bg-background text-muted-foreground flex items-center justify-center',
          inShell ? 'min-h-full pt-6' : 'min-h-screen pt-12 md:pt-14'
        )}
      >
        <GlitchLoader size={32} />
      </div>
    );
  }

  if (!user || isAuthenticated === false) {
    // Logado mas a leitura falhou: é erro com retry, nunca "faça login".
    const loadFailed = isAuthenticated === true && !!error;
    return (
      <PageShell
        pageId="profile-auth-error"
        width="5xl"
        hideHeader
        title={t('common.profile')}
        seoTitle={t('common.profile')}
      >
        {loadFailed ? (
          <ErrorState title={error ?? undefined} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <EmptyState
            icon={UserCircle}
            title={t('common.profile')}
            description={t('common.notAuthenticated')}
            actionLabel={t('auth.signIn')}
            onAction={() => navigate('/login')}
          />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell
      pageId="profile"
      width="5xl"
      seoTitle={t('common.profile')}
      seoDescription={t('profile.seoDescription')}
      title={t('common.profile')}
      hideHeader
      breadcrumb={[{ label: t('apps.home'), to: '/' }, { label: t('common.profile') }]}
    >
      <div className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive flex items-center gap-2">
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label={t('common.dismiss')}
              className="text-destructive/70 hover:text-destructive transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Sub-navegação vive no rail (CONTEXTO da seção profile, SSoT em
            navConfig). Aqui só renderizamos o pane da aba corrente lida de
            ?tab= — sem barra de abas horizontal (era redundante com o rail). */}
        {currentTab === 'overview' && (
          <ProfileOverview
            user={user}
            subscriptionStatus={subscriptionStatus}
            subscriptionError={subscriptionError}
            onRetrySubscription={loadSubscriptionStatus}
            referralStats={referralStats}
            isLoadingReferral={isLoadingReferral}
            referralError={referralError}
            onRetryReferral={loadReferralStats}
            onRefreshUserData={handleRefreshUserData}
            onManageSubscription={handleManageSubscription}
            onBuyCredits={() => setIsCreditPackagesModalOpen(true)}
            onViewTransactions={() => setIsTransactionsModalOpen(true)}
            onEditProfile={() => setIsEditProfileModalOpen(true)}
            isUploadingPicture={isUploadingPicture}
            onFileUpload={handleFileUpload}
            avatarUrl={avatarUrl}
          />
        )}

        {currentTab === 'history' && <UsageHistory isAuthenticated={true} />}

        {currentTab === 'configuration' && (
          <div className="space-y-8">
            <ApiSettings />

            <SecuritySettings totpEnabled={user?.totpEnabled} />

            <div className="p-5 border border-destructive/20 rounded-xl bg-destructive/5">
              <h3 className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                <Trash2 size={14} /> {t('profile.danger.title')}
              </h3>
              <p className="text-xs text-muted-foreground mb-4 max-w-md">
                {t('profile.danger.description')}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {t('profile.danger.deleteAccount')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreditPackagesModal
        isOpen={isCreditPackagesModalOpen}
        onClose={() => setIsCreditPackagesModalOpen(false)}
        subscriptionStatus={subscriptionStatus}
      />
      <TransactionsModal
        isOpen={isTransactionsModalOpen}
        onClose={() => setIsTransactionsModalOpen(false)}
      />
      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        onSuccess={(u) => {
          // Só quem salvou muda o usuário: o modal devolve o registro novo, e o
          // cache do authService cai pra o resto do app (header) reler.
          authService.invalidateCache();
          setUser(u);
          setAvatarUrl(u.picture || '');
        }}
      />
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t('profile.deleteDialog.title')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {t('profile.deleteDialog.description')}{' '}
              <strong className="text-foreground">{deleteConfirmWord}</strong>{' '}
              {t('profile.deleteDialog.toConfirm')}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={t('profile.deleteDialog.placeholder', { word: deleteConfirmWord })}
            className="font-mono"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmText !== deleteConfirmWord || isDeletingAccount}
              onClick={async () => {
                setIsDeletingAccount(true);
                try {
                  await authService.deleteAccount();
                  toast.success(t('profile.deleteDialog.success'));
                  navigate('/');
                } catch (err: any) {
                  toast.error(err.message || t('profile.deleteDialog.error'));
                } finally {
                  setIsDeletingAccount(false);
                  setIsDeleteDialogOpen(false);
                  setDeleteConfirmText('');
                }
              }}
            >
              {isDeletingAccount
                ? t('profile.deleteDialog.deleting')
                : t('profile.deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};
